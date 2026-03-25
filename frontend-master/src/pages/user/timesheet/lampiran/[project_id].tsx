/* eslint-disable react-hooks/exhaustive-deps */

import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import CryptoJS from "crypto-js";
import Layout from "@/src/components/Layout";
import ProgressIndicator from "@/src/components/ProgressIndicator";
import PageLoader from "@/src/components/PageLoader";
import Link from "next/link";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { useRole } from "@/src/context/RoleContext";
import { jwtDecode } from "jwt-decode";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { useSignature } from "@/src/context/SignatureContext";

const SignaturePad = dynamic(() => import("@/src/components/SignaturePad"), {
  ssr: false,
});

interface DecodedToken {
  exp: number;
}

const UploadSP3 = ({ id }: { id: string }) => {
  const router = useRouter();
  const { project_id } = router.query;
  const [token, setToken] = useState<string | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [_idSatuan, setIdSatuan] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>(""); // Display name (without PIC)
  const [projectFullName, setProjectFullName] = useState<string>(""); // Full name for API
  const [formattedDate, setFormattedDate] = useState<string>("");
  const [fileSp3, setFileSp3] = useState<File | null>(null);
  const [jabatan, setJabatan] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [totalTagihan, setTotalTagihan] = useState<number | null>(null);
  const [_id_tran_project, setIdTranProject] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { setId } = useRole();

  const buildLecturerKey = () => {
    let currentUserId = userId;
    if (router.query.student) {
      currentUserId = Array.isArray(router.query.student)
        ? router.query.student[0]
        : router.query.student;
    } else if (router.query.userId) {
      try {
        const encryptedUserId = decodeURIComponent(
          router.query.userId as string,
        );
        currentUserId = CryptoJS.AES.decrypt(
          encryptedUserId,
          secretKey,
        ).toString(CryptoJS.enc.Utf8);
      } catch (e) {}
    }
    if (!projectFullName || !currentUserId || !date) return null;
    const month = date.split("-")[1].padStart(2, "0");
    const raw = `${projectFullName}_${currentUserId}_${month}`;
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  };
  useEffect(() => {}, [router.query.userId, userId]);
  const {
    studentSignature,
    lecturerSignature,
    setLecturerSignature,
    setStudentSignature,
  } = useSignature();
  // (duplikat buildLecturerKey dihapus)

  const [encodedProjectId, setEncodedProjectId] = useState<string | null>(null);
  const [encodedDate, setEncodedDate] = useState<string | null>(null);
  const [encodedUserId, setEncodedUserId] = useState<string | null>(null);

  const secretKey = "my-secret-key";
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;

  useEffect(() => {
    setId(id);
  }, [id, setId]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${ApiEndPoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || "Error refreshing token");
        console.error("Error refreshing token:", error);
      }
    };

    refreshToken();
  }, [ApiEndPoint]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();

    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${ApiEndPoint}/token`, {
              withCredentials: true,
            });
            config.headers.Authorization = `Bearer ${response.data.data.token}`;
            setToken(response.data.data.token);
            const decoded: DecodedToken = jwtDecode(response.data.data.token);
            setExpire(decoded.exp);
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        toast.error(error.response?.data?.message || "Request error");
        return Promise.reject(error);
      },
    );

    return instance;
  }, [token, expire, ApiEndPoint]);

  // Load student signature for the selected user to display to dosen
  useEffect(() => {
    const loadStudentSig = async () => {
      if (!token || !userId) return;
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/student/${userId}`,
        );
        if (res.data?.url) setStudentSignature(res.data.url);
      } catch (e) {
        // ignore if not found
      }
    };
    loadStudentSig();
  }, [token, axiosJWT, ApiEndPoint, userId, setStudentSignature]);

  // Load lecturer signature – uses the resolved endpoint so that frozen
  // snapshots (present when the student is Approved) take priority over the
  // latest user signature, matching the PDF rendering behaviour exactly.
  useEffect(() => {
    const loadLecturerSig = async () => {
      if (!token || !id) return;
      // Can only call the resolved endpoint once we have all required context
      if (!userId || !projectFullName || !date) {
        // Not enough context yet – skip for now; this effect re-runs when they arrive
        return;
      }

      const month = date.split("-")[1];
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/lecturer/resolved`,
          {
            params: {
              nim: userId,
              project: projectFullName,
              month: parseInt(month, 10),
              picId: id, // logged-in user is the PIC
            },
          },
        );
        if (res.data?.url) setLecturerSignature(res.data.url);
      } catch (e) {
        // If resolved endpoint fails, fall back to latest user signature
        try {
          const fallback = await axiosJWT.get(
            `${ApiEndPoint}/api/signature/lecturer/user_${id}`,
          );
          if (fallback.data?.url) setLecturerSignature(fallback.data.url);
        } catch (_) {
          /* ignore */
        }
      }
    };
    loadLecturerSig();
  }, [
    token,
    axiosJWT,
    ApiEndPoint,
    id,
    userId,
    projectFullName,
    date,
    setLecturerSignature,
  ]);

  // Load jabatan from the logged-in user's saved position (from signature page) - this is the priority source
  const [jabatanFromSignature, setJabatanFromSignature] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loadJabatan = async () => {
      if (!token || !id) return;
      const key = `user_${id}`;
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/jabatan/${key}`,
        );
        if (res.data?.jabatan) {
          setJabatanFromSignature(res.data.jabatan);
          setJabatan(res.data.jabatan); // Set jabatan from signature as default
        }
      } catch (e) {
        // ignore if not found
      }
    };
    loadJabatan();
  }, [token, axiosJWT, ApiEndPoint, id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosJWT.get(
          `${ApiEndPoint}/api/timesheet/submitPayment/get`,
          {
            params: {
              projectId: project_id,
              date: date,
            },
          },
        );
        const projectData = response.data.data[0];

        // Store full name for API calls
        const rawName = projectData.nama_project || "";
        setProjectFullName(rawName);
        // Remove PIC name from project name for display (format: "Project Name - PIC Name")
        const cleanName = rawName.includes(" - ")
          ? rawName.split(" - ")[0]
          : rawName;
        setProjectName(cleanName);
        // Only set jabatan from project if no jabatan from signature page
        if (projectData.pic_jabatan && !jabatanFromSignature)
          setJabatan(projectData.pic_jabatan);

        const month = date?.split("-")[1];
        const year = date?.split("-")[0];

        const insentifResponse = await axiosJWT.get(
          `${ApiEndPoint}/api/getDataPdfRecap`,
          {
            params: {
              project: projectData.nama_project,
              month: month,
              year: year,
            },
          },
        );

        const totalInsentif = insentifResponse.data?.total?.total_insentif;

        setTotalTagihan(totalInsentif || 0);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || "Request error");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (token && date) {
      fetchData();
    }
  }, [token, axiosJWT, ApiEndPoint, date, project_id, jabatanFromSignature]);

  useEffect(() => {
    if (router.isReady) {
      try {
        const encodedIdSatuan = router.query.id_satuan as string;
        const encodedDate = router.query.date as string;
        const encodedProjectId = router.query.id_tran_project as string;
        const encodedUserId = router.query.userId as string;

        const encryptedIdSatuan = decodeURIComponent(encodedIdSatuan);
        const encryptedDate = decodeURIComponent(encodedDate);
        const encryptedProjectId = decodeURIComponent(encodedProjectId);
        const encryptedUserId = decodeURIComponent(encodedUserId);

        const decryptedIdSatuan = CryptoJS.AES.decrypt(
          encryptedIdSatuan,
          secretKey,
        ).toString(CryptoJS.enc.Utf8);
        const decryptedDate = CryptoJS.AES.decrypt(
          encryptedDate,
          secretKey,
        ).toString(CryptoJS.enc.Utf8);
        const decryptedProjectId = CryptoJS.AES.decrypt(
          encryptedProjectId,
          secretKey,
        ).toString(CryptoJS.enc.Utf8);
        const decryptedUserId = CryptoJS.AES.decrypt(
          encryptedUserId,
          secretKey,
        ).toString(CryptoJS.enc.Utf8);

        setIdSatuan(Number(decryptedIdSatuan));
        setDate(decryptedDate);
        setIdTranProject(Number(decryptedProjectId));
        setUserId(decryptedUserId);
        setFormattedDate(format(new Date(decryptedDate), "MMMM yyyy"));

        if (decryptedUserId && decryptedProjectId && decryptedDate) {
          const projectID = decryptedProjectId.toString();
          const encryptedProjectId = CryptoJS.AES.encrypt(
            projectID,
            secretKey,
          ).toString();
          const encryptedDate = CryptoJS.AES.encrypt(
            decryptedDate,
            secretKey,
          ).toString();
          const encryptedUserId = CryptoJS.AES.encrypt(
            decryptedUserId,
            secretKey,
          ).toString();

          setEncodedProjectId(encodeURIComponent(encryptedProjectId));
          setEncodedDate(encodeURIComponent(encryptedDate));
          setEncodedUserId(encodeURIComponent(encryptedUserId));
        }
      } catch (error) {
        toast.error("Gagal mendekripsi data");
        console.error(error);
        setLoading(false);
      }
    }
  }, [router.isReady, router.query, ApiEndPoint]);

  const _handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileSp3(e.target.files[0]);
    }
  };

  const handleNextClick = async () => {
    if (!jabatan) {
      toast.error("Jabatan dosen wajib diisi!");
      return;
    }
    const urlFileSp3 = "";

    try {
      // PATCH jabatan dosen jika ada perubahan
      await axiosJWT.patch(
        `${ApiEndPoint}/api/uploadSp3/${project_id}/picJabatan/force`,
        { pic_jabatan: jabatan },
      );

      let uploadedSp3Url = "";
      // Jika ada file dipilih, lakukan upload. Jika tidak, skip.
      if (fileSp3) {
        const formData = new FormData();
        formData.append("file", fileSp3);

        const uploadResponse = await axiosJWT.post(
          `${ApiEndPoint}/api/uploadSp3/${project_id}/${date}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        uploadedSp3Url = uploadResponse.data.url || "";
        toast.success("File SP3 berhasil diupload");
      }

      // Simpan data sementara untuk dikirim ke recap page via URL parameters
      const paymentData = {
        id_tmst_project: Number(project_id),
        periode: date ? format(new Date(date), "yyyy-MM") : "",
        url_file_sp3: urlFileSp3,
        id_status: 1,
        total_tagihan: totalTagihan,
        revisi: "",
        uploaded_sp3_file: uploadedSp3Url, // kosong jika tidak ada upload
      };

      // --- New: save lecturer signature so it will be embedded in recap/timesheet PDFs ---
      try {
        const key = buildLecturerKey();
        if (key && lecturerSignature) {
          await axiosJWT.post(`${ApiEndPoint}/api/signature/lecturer`, {
            key,
            dataUrl: lecturerSignature,
          });
        }
      } catch (sigErr) {
        // Do not block flow if signature save fails; just show a warning
        console.warn("Failed to save lecturer signature:", sigErr);
        toast.warn("Gagal menyimpan tanda tangan dosen secara otomatis.");
      }

      // --- Mark timesheet as reviewed ---
      try {
        // Use the already decrypted id_tran_project from state
        if (_id_tran_project) {
          await axiosJWT.patch(`${ApiEndPoint}/api/project/markReviewed`, {
            id_tran_project: _id_tran_project,
          });
        }
      } catch (markErr) {
        console.warn("Failed to mark as reviewed:", markErr);
        // Don't block the flow
      }

      // Redirect ke halaman recap dengan data payment dalam URL parameters (encrypted)
      const studentNim = Array.isArray(router.query.student)
        ? router.query.student[0]
        : router.query.student || userId || "";
      const studentName = Array.isArray(router.query.studentName)
        ? router.query.studentName[0]
        : router.query.studentName || "";
      const monthParam = date?.split("-")?.[1] || "";
      const yearParam = date?.split("-")?.[0] || "";

      // Encrypt all params using CryptoJS for consistency with view and lampiran pages
      const encryptedProject = encodeURIComponent(
        CryptoJS.AES.encrypt(projectFullName, secretKey).toString(), // Use full name for API
      );
      const encryptedMonth = encodeURIComponent(
        CryptoJS.AES.encrypt(monthParam, secretKey).toString(),
      );
      const encryptedYear = encodeURIComponent(
        CryptoJS.AES.encrypt(yearParam, secretKey).toString(),
      );
      const encryptedStudent = encodeURIComponent(
        CryptoJS.AES.encrypt(studentNim, secretKey).toString(),
      );
      const encryptedStudentName = encodeURIComponent(
        CryptoJS.AES.encrypt(studentName, secretKey).toString(),
      );
      const encryptedPaymentData = encodeURIComponent(
        CryptoJS.AES.encrypt(JSON.stringify(paymentData), secretKey).toString(),
      );

      const recapUrl = `/user/timesheet/recap?project=${encryptedProject}&month=${encryptedMonth}&year=${encryptedYear}&student=${encryptedStudent}&studentName=${encryptedStudentName}&paymentData=${encryptedPaymentData}`;
      router.push(recapUrl);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Request error");
      console.error(error);
    }
  };
  if (
    loading ||
    !encodedProjectId ||
    !encodedDate ||
    !encodedUserId ||
    totalTagihan === null
  ) {
    return <PageLoader />;
  }

  // Build breadcrumb labels - "lampiran" shows as "Lampiran", project_id shows as project name
  const breadcrumbLabels: Record<string, string> = {};
  if (project_id && projectName) {
    breadcrumbLabels[String(project_id)] = projectName;
    breadcrumbLabels["lampiran"] = "lampiran";
  }

  return (
    <Layout title="Time Sheet" breadcrumbLabels={breadcrumbLabels}>
      <div className="p-3 sm:p-4 md:p-6">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
            {(projectName || "Time Sheet").toUpperCase()}
          </h1>
          <span className="text-sm sm:text-base md:text-lg">
            {formattedDate}
          </span>
        </div>

        <ProgressIndicator currentStep={2} />

        <div className="max-w-3xl mx-auto mt-6 sm:mt-8 md:mt-9 space-y-6 sm:space-y-7 md:space-y-8">
          {/* Input Jabatan (Dosen) */}
          <div className="rounded-lg border bg-transparant p-3 sm:p-4">
            <label
              htmlFor="jabatan"
              className="block text-xs sm:text-sm font-medium mb-2"
            >
              Jabatan Dosen <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="jabatan"
                disabled
                type="text"
                className="input input-bordered w-full text-sm sm:text-base px-3 py-2 rounded-lg shadow-md"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Masukkan jabatan dosen (mis. Dosen Pembimbing)"
              />
              {/* Tombol Save dihilangkan, simpan otomatis saat klik Selanjutnya */}
            </div>
          </div>

          {/* Signature Section below file input */}
          <div className="rounded-lg border bg-transparant p-3 sm:p-4">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
              Tanda Tangan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Mahasiswa (read-only, no controls) */}
              <div className="flex flex-col">
                <div className="text-xs sm:text-sm font-medium mb-2">
                  Tanda Tangan Mahasiswa
                </div>
                <SignaturePad
                  value={studentSignature ?? undefined}
                  onSave={() => {
                    /* no-op for read-only */
                  }}
                  readOnly={true}
                  showSave={false}
                  showClear={false}
                  width={320}
                  height={140}
                />
              </div>
              {/* Dosen */}
              <div className="flex flex-col">
                <div className="text-xs sm:text-sm font-medium mb-2">
                  Tanda Tangan Dosen
                </div>
                <SignaturePad
                  value={lecturerSignature ?? undefined}
                  onSave={() => {
                    /* no-op for read-only */
                  }}
                  readOnly={true}
                  showSave={false}
                  showClear={false}
                  width={320}
                  height={140}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 sm:space-x-4 mt-16 sm:mt-20 md:mt-24">
            <Link
              href={{
                pathname: `/user/timesheet/view/${project_id}?[id_tran_project]&[date]&[userId]`,
                query: {
                  id_tran_project: encodedProjectId,
                  date: encodedDate,
                  userId: encodedUserId,
                },
              }}
              as={`/user/timesheet/view/${project_id}?${encodedProjectId}&${encodedDate}&${encodedUserId}`}
              className="bg-gray-500 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md hover:bg-gray-600 transition text-center text-xs sm:text-sm md:text-base order-2 sm:order-1"
            >
              Kembali
            </Link>
            <button
              className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md hover:bg-green-700 transition text-xs sm:text-sm md:text-base order-1 sm:order-2"
              onClick={handleNextClick}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(UploadSP3);
