import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import CryptoJS from "crypto-js";
import Layout from "@/src/components/Layout";
import ProgressIndicator from "@/src/components/ProgressIndicator";
import PageLoader from "@/src/components/PageLoader";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import { showApprovalWithRevision } from "@/src/utils/swalHelper";
import Swal from "sweetalert2";

interface DecodedToken {
  exp: number;
}

interface PaymentData {
  id_tmst_project: number;
  periode: string;
  url_file_sp3: string;
  id_status: number;
  total_tagihan: number;
  revisi: string;
  uploaded_sp3_file: string;
}

const RecapPayment = () => {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // State for data from URL
  const [projectName, setProjectName] = useState<string>(""); // Display name (without PIC)
  const [projectFullName, setProjectFullName] = useState<string>(""); // Full name for API
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [student, setStudent] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // State for PDF view (Timesheet-style preview like step 1)
  const [viewRecap, setViewRecap] = useState(true);
  const [recapUrl, setRecapUrl] = useState("");
  const [projectStatus, setProjectStatus] = useState<string>("");

  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const secretKey = "my-secret-key";

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

  useEffect(() => {
    if (router.isReady) {
      try {
        const {
          project,
          month,
          year: yearQuery,
          student,
          studentName: studentNameQuery,
          paymentData: encodedPaymentData,
        } = router.query;

        // Decrypt all params using CryptoJS (consistent with lampiran page)
        if (project) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(project as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          // Store full name for API calls
          setProjectFullName(decrypted);
          // Remove PIC name from project name for display (format: "Project Name - PIC Name")
          const cleanName = decrypted.includes(" - ")
            ? decrypted.split(" - ")[0]
            : decrypted;
          setProjectName(cleanName);
        }
        if (month) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(month as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          setMonth(decrypted);
        }
        if (yearQuery) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(yearQuery as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          setYear(decrypted);
        }
        if (student) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(student as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          setStudent(decrypted);
        }
        if (studentNameQuery) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(studentNameQuery as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          setStudentName(decrypted);
        }

        if (encodedPaymentData) {
          const decrypted = CryptoJS.AES.decrypt(
            decodeURIComponent(encodedPaymentData as string),
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          const parsed = JSON.parse(decrypted);
          setPaymentData(parsed);
          if (!yearQuery && parsed?.periode) {
            const derivedYear = parsed.periode.split("-")?.[0];
            if (derivedYear) setYear(derivedYear);
          }

          // Mark recap as visited for this specific project + student + period combination
          if (parsed?.id_tmst_project && student) {
            const monthStr = Array.isArray(month) ? month[0] : month;
            const studentStr = Array.isArray(student) ? student[0] : student;
            if (monthStr && studentStr) {
              const formattedPeriod = `${parsed?.periode?.split("-")?.[0] || new Date().getFullYear()}-${monthStr.padStart(2, "0")}`;
              const recapKey = `recap_visited_${parsed.id_tmst_project}_${studentStr}_${formattedPeriod}`;
              localStorage.setItem(recapKey, "true");
            }
          }
        }
        setLoading(false);
      } catch (error) {
        toast.error("Gagal memuat data rekapitulasi.");
        console.error("Error parsing query params:", error);
        setLoading(false);
      }
    }
  }, [router.isReady, router.query, secretKey]);

  // Fetch the actual payment status from API to ensure button visibility is correct
  useEffect(() => {
    const fetchPaymentStatus = async () => {
      if (!token || !paymentData?.id_tmst_project || !paymentData?.periode)
        return;

      try {
        const response = await axiosJWT.get(`${ApiEndPoint}/api/payments`);
        const payments = response.data.data || [];

        const matchedPayment = payments.find(
          (payment: {
            id_tmst_project: number;
            periode: string;
            id_status: number;
          }) =>
            payment.id_tmst_project === paymentData.id_tmst_project &&
            payment.periode === paymentData.periode,
        );

        if (matchedPayment) {
          // Update paymentData with the real id_status from database
          setPaymentData((prev) =>
            prev ? { ...prev, id_status: matchedPayment.id_status } : null,
          );
        }

        // Fetch project status as well
        const projectResponse = await axiosJWT.get(
          `${ApiEndPoint}/api/masterProject/${paymentData.id_tmst_project}`,
        );
        if (projectResponse.data.data) {
          const fetchedProject = projectResponse.data.data;
          setProjectStatus(
            fetchedProject.tmst_status_master_project?.status ||
              fetchedProject.status ||
              "",
          );
        }
      } catch (error) {
        console.error("Error fetching payment status & project info:", error);
      }
    };

    fetchPaymentStatus();
  }, [
    token,
    axiosJWT,
    ApiEndPoint,
    paymentData?.id_tmst_project,
    paymentData?.periode,
  ]);

  const handleGeneratePdf = async (option: "lihat" | "unduh") => {
    if (!projectFullName || !month || !student) {
      toast.error("Informasi proyek, bulan, atau mahasiswa tidak lengkap.");
      return;
    }

    const selectedYear = year || paymentData?.periode?.split("-")?.[0] || "";

    try {
      setLoading(true);
      const response = await axiosJWT.get(
        `${ApiEndPoint}/api/generatePdfTimesheet`,
        {
          params: {
            id_pengguna: student,
            month: parseInt(month, 10),
            year: selectedYear ? parseInt(selectedYear, 10) : undefined,
            project: projectFullName, // Use full name for API
            option: option,
            // Pass link dokumentasi for preview so backend can fill the table column
            paymentLink: paymentData?.url_file_sp3 || undefined,
          },
          responseType: option === "unduh" ? "blob" : "arraybuffer",
        },
      );

      if (option === "lihat") {
        // Create blob URL from arraybuffer for reliable iframe preview
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        setRecapUrl(url);
        setViewRecap(true);
      } else if (option === "unduh") {
        const url = window.URL.createObjectURL(
          new Blob([response.data], { type: "application/pdf" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `rekapitulasi_${projectName}_${month}.pdf`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error("Error generating PDF:", error);
      toast.error(
        err.response?.data?.message || "Gagal menghasilkan PDF rekapitulasi.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto load preview to match step 1 behavior
  useEffect(() => {
    if (!token) return;
    if (!projectFullName || !month || !student) return;
    handleGeneratePdf("lihat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectFullName, month, year, student]);

  const handleSubmit = async () => {
    if (!paymentData) {
      toast.error("Data pembayaran tidak ditemukan.");
      return;
    }

    const result = await showApprovalWithRevision({
      title: "Pilih Tindakan",
      text: "Apa yang ingin Anda lakukan dengan timesheet ini?",
      confirmButtonText: "Setujui",
      cancelButtonText: "Batal",
      onRevisi: handleRevisi,
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);

        // Update timesheet status for specific student
        await axiosJWT.put(
          `${ApiEndPoint}/api/masterProject/${paymentData.id_tmst_project}/approve-student/${student}`,
          {
            period: paymentData.periode,
          },
        );

        toast.success("Timesheet telah disetujui!");
        router.push("/user/timesheet");
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        console.error("Error completing project:", error);
        toast.error(
          err.response?.data?.message || "Gagal menyelesaikan proyek.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRevisi = async () => {
    if (!paymentData || !student || !year) {
      toast.error("Data pembayaran, mahasiswa, atau tahun tidak ditemukan.");
      return;
    }

    // Show SweetAlert with textarea for revision message
    const result = await Swal.fire({
      title: "Konfirmasi Revisi",
      html: `
        <div class="text-left">
          <p class="mb-4">Apakah Anda yakin ingin meminta revisi untuk timesheet mahasiswa ini?</p>
          <label class="block text-sm font-medium text-gray-700 mb-2">Pesan Revisi:</label>
          <textarea 
            id="revisi-message" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500" 
            rows="3" 
            placeholder="Masukkan catatan revisi untuk mahasiswa..."
          ></textarea>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Minta Revisi",
      cancelButtonText: "Batal",
      confirmButtonColor: "#f59e0b",
      reverseButtons: true,
      preConfirm: () => {
        const textarea = document.getElementById(
          "revisi-message",
        ) as HTMLTextAreaElement;
        const message = textarea?.value || "";
        if (!message.trim()) {
          Swal.showValidationMessage("Harap isi pesan revisi");
          return false;
        }
        return message;
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      setLoading(true);

      // Use per-student revision endpoint with revisi message
      await axiosJWT.put(
        `${ApiEndPoint}/api/masterProject/${paymentData.id_tmst_project}/revise-student/${student}`,
        {
          period: paymentData.periode,
          revisi: result.value,
        },
      );

      toast.success("Status diubah menjadi Butuh Revisi!");
      router.push("/user/timesheet");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error("Error updating status:", error);
      toast.error(err.response?.data?.message || "Gagal mengubah status.");
    } finally {
      setLoading(false);
    }
  };

  const formattedPeriod = paymentData?.periode
    ? new Date(paymentData.periode + "-01").toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
    : "Periode tidak diketahui";

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Layout
      title="Time Sheet"
      extraBreadcrumbSegments={projectName ? [projectName] : []}
    >
      <div className="p-3 sm:p-4 md:p-6">
        <div className="text-center mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
            {(projectName || "Time Sheet").toUpperCase()}
          </h1>
          <span className="text-sm sm:text-base md:text-lg">
            {formattedPeriod}
          </span>
        </div>

        <ProgressIndicator currentStep={3} />

        <div className="max-w-4xl mx-auto mt-6 sm:mt-7 md:mt-8 p-4 sm:p-6 md:p-8 bg-transparant rounded-lg">
          {viewRecap ? (
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-3 sm:mb-4 text-center">
                Pratinjau Timesheet
              </h2>
              <iframe
                src={recapUrl}
                className="w-full h-[400px] sm:h-[500px] md:h-[600px] border rounded-md"
                title="Timesheet PDF"
              ></iframe>
              <div className="flex justify-between mt-4 sm:mt-5 md:mt-6">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                  onClick={() => handleGeneratePdf("unduh")}
                >
                  Unduh PDF Timesheet
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-3 sm:mb-4">
                Final Review - Ringkasan Pengajuan
              </h2>
              <div className="text-left bg-gray-50 p-4 sm:p-5 md:p-6 rounded-md border inline-block w-full sm:w-auto">
                <p className="text-xs sm:text-sm md:text-base mb-2">
                  <span className="font-semibold">NIM:</span> {student || "-"}
                </p>
                <p className="text-xs sm:text-sm md:text-base mb-2">
                  <span className="font-semibold">Nama:</span>{" "}
                  {studentName || "-"}
                </p>
                <p className="text-xs sm:text-sm md:text-base mb-2">
                  <span className="font-semibold">Proyek:</span> {projectName}
                </p>
                <p className="text-xs sm:text-sm md:text-base mb-2">
                  <span className="font-semibold">Periode:</span>{" "}
                  {formattedPeriod}
                </p>
                <p className="text-xs sm:text-sm md:text-base mb-2">
                  <span className="font-semibold">Total Tagihan:</span>{" "}
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                  }).format(paymentData?.total_tagihan || 0)}
                </p>
                <p className="text-xs sm:text-sm md:text-base">
                  <span className="font-semibold">File SP3 Terunggah:</span>{" "}
                  <a
                    href={`${ApiEndPoint}/${paymentData?.uploaded_sp3_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Lihat File
                  </a>
                </p>
              </div>
              <div className="mt-6 sm:mt-7 md:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:space-x-4 justify-center">
                <button
                  className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-5 md:px-6 py-2 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base order-2 sm:order-1"
                  onClick={() => handleGeneratePdf("lihat")}
                >
                  Lihat PDF Timesheet
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-5 md:px-6 py-2 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base order-1 sm:order-2"
                  onClick={() => handleGeneratePdf("unduh")}
                >
                  Unduh PDF Timesheet
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-12 sm:mt-14 md:mt-16">
            <button
              onClick={() => router.back()}
              className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-5 md:px-6 py-2 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base order-2 sm:order-1"
            >
              Kembali
            </button>
            {paymentData &&
              paymentData.id_status !== 2 &&
              projectStatus?.toLowerCase() !== "waiting timesheet approval" && (
                <button
                  onClick={handleSubmit}
                  className="bg-primary hover:bg-primary-focus text-white px-4 sm:px-5 md:px-6 py-2 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base order-1 sm:order-2"
                >
                  Selanjutnya
                </button>
              )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(RecapPayment);
