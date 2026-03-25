/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";

import Layout from "@/src/components/Layout";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { toast } from "react-toastify";
import { useRole } from "@/src/context/RoleContext";
import CryptoJS from "crypto-js";

function getMessage(err: unknown, fallback = "Terjadi kesalahan") {
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const response = obj.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    const message = data?.message;
    if (typeof message === "string") return message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

type Props = {
  user: unknown;
  role: string;
  id: string;
};

interface ApiResponse {
  id: number;
  id_tran_project: number;
  nama: string;
  kategori: string;
  kategoriId: number;
  insentif: {
    durasi_satuan: number;
    besaran_insentif: number;
  };
  namaPIC: string;
  id_satuan: number;
  inisial_project: string;
}

interface DecodedToken {
  exp: number;
}

interface TimesheetData {
  id: number;
  id_kategori_kegiatan: number;
  id_tran_project: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  deskripsi: string;
  total_sesi: number;
  link_output?: string;
}

interface JobUploadData {
  unggah_hasil: File[];
}

interface Activity {
  id: number;
  kegiatan: string;
}

function _renderEventContent(_eventInfo: unknown) {
  return null;
}

const Detail = ({ user: _user, role: _role, id }: Props) => {
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<TimesheetData[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] =
    useState<ApiResponse | null>(null);
  const [selectedIdTimesheet, setSelectedIdTimesheet] = useState<number>(0);
  const [timesheet, setTimesheet] = useState<ApiResponse[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const { setId } = useRole();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [id_tran_project, setIdTranProject] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [_jobUploadData, _setJobUploadData] = useState<JobUploadData[]>([]);
  const [_uploadedFiles, setUploadedFiles] = useState<Record<string, string[]>>(
    {},
  );
  const [objectUrls, setObjectUrls] = useState<Record<string, string[]>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const createdObjectUrlsRef = useRef<string[]>([]);

  // State untuk pengecekan signature
  const [signatureChecking, setSignatureChecking] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);

  const secretKey = "my-secret-key";

  useEffect(() => {
    const parseUrlAndDecrypt = () => {
      // Try to get values from router.query first (Next.js parsed query)
      const { id_tran_project, date, userId } = router.query;

      let encodedProjectId: string | null = null;
      let encodedDate: string | null = null;
      let encodedUserId: string | null = null;

      if (id_tran_project && date && userId) {
        // Use router.query values (key-value format)
        encodedProjectId = Array.isArray(id_tran_project)
          ? id_tran_project[0]
          : id_tran_project;
        encodedDate = Array.isArray(date) ? date[0] : date;
        encodedUserId = Array.isArray(userId) ? userId[0] : userId;
      } else {
        // Fallback: parse from URL directly (positional format)
        const queryParams = router.asPath || "";
        const qIdx = queryParams.indexOf("?");
        if (qIdx === -1) return;

        const queryString = queryParams.substring(qIdx + 1) || "";
        if (!queryString) return;

        const params = queryString.split("&");
        if (!Array.isArray(params) || params.length < 3) return;

        encodedProjectId = params[0];
        encodedDate = params[1];
        encodedUserId = params[2];
      }

      if (encodedProjectId && encodedDate && encodedUserId) {
        try {
          const encryptedProjectId = decodeURIComponent(encodedProjectId);
          const encryptedDate = decodeURIComponent(encodedDate);
          const encryptedUserId = decodeURIComponent(encodedUserId);

          const decryptedProjectId = CryptoJS.AES.decrypt(
            encryptedProjectId,
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          const decryptedDate = CryptoJS.AES.decrypt(
            encryptedDate,
            secretKey,
          ).toString(CryptoJS.enc.Utf8);
          const decryptedUserId = CryptoJS.AES.decrypt(
            encryptedUserId,
            secretKey,
          ).toString(CryptoJS.enc.Utf8);

          if (decryptedProjectId && decryptedDate && decryptedUserId) {
            setIdTranProject(Number(decryptedProjectId));
            setDate(decryptedDate);
            setUserId(Number(decryptedUserId));
          }
        } catch (_error) {
          console.error("Error decrypting URL parameters:", _error);
        }
      }
    };

    if (router.isReady) {
      parseUrlAndDecrypt();
    }
  }, [router.isReady, router.query, router.asPath, secretKey]);

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
        toast.error(getMessage(error, "Error refreshing token"));
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

  // Signature check
  useEffect(() => {
    const checkSignature = async () => {
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/student/${id}`,
        );
        if (res.data?.url) {
          setHasSignature(true);
          setSignatureChecking(false);
        } else {
          throw new Error("Signature not found");
        }
      } catch (e) {
        setSignatureChecking(false);
        toast.warning("Silakan lengkapi tanda tangan Anda terlebih dahulu");
        setTimeout(() => {
          router.push("/mahasiswa/signature");
        }, 3000);
      }
    };

    if (token) {
      checkSignature();
    }
  }, [token, axiosJWT, ApiEndPoint, id, router]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        // Fetch projects using the user's ID from URL (decrypted userId)
        const targetUserId = userId || Number(id);
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/masterProject/timesheet/${targetUserId}`,
        );
        setTimesheet(res.data.data);

        if (res.data.data.length > 0) {
          let defaultProject = null;

          if (id_tran_project) {
            // Find the project that matches the id_tran_project from the URL
            // Note: id_tran_project is tran_project.id, not tmst_project.id
            defaultProject = res.data.data.find(
              (item: ApiResponse) =>
                item.id_tran_project === Number(id_tran_project),
            );
          }

          // If not found and we only have one project, use it
          if (!defaultProject && res.data.data.length === 1) {
            defaultProject = res.data.data[0];
          }

          // If still not found, try to match by checking fetchTimesheets will work
          if (!defaultProject) {
            // Use the first project as fallback but log a warning
            console.warn(
              `Project with tran_project.id ${id_tran_project} not found in list. Available IDs:`,
              res.data.data.map((p: ApiResponse) => p.id),
            );
            defaultProject = res.data.data[0];
          }

          if (defaultProject) {
            setSelectedIdTimesheet(defaultProject.id);
            setSelectedTimesheet(defaultProject);
          }
        }
      } catch (err: unknown) {
        toast.error(getMessage(err, "Failed to fetch project data."));
      }
    };

    if (token && (userId || id)) {
      fetchProject();
    }
  }, [token, axiosJWT, ApiEndPoint, id_tran_project, userId, id]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await axiosJWT.get(`${ApiEndPoint}/api/activity`);
        setActivities(res.data.data);
      } catch (err: unknown) {
        toast.error(getMessage(err, "Failed to fetch activities."));
        setActivities([]);
      }
    };

    if (token) {
      fetchActivities();
    }
  }, [token, axiosJWT, ApiEndPoint]);

  useEffect(() => {
    const fetchTimesheets = async () => {
      try {
        const response = await axiosJWT.get(
          `${ApiEndPoint}/api/timesheet/getEdit/${id_tran_project}`,
          {
            params: {
              date: date,
              userId: userId,
            },
          },
        );
        (response.data.data as TimesheetData[]).forEach((item) => {
          delete (item as unknown as Record<string, unknown>).id_project;
        });
        setTimesheets(response.data.data);
        _setJobUploadData(response.data.data.map(() => ({ unggah_hasil: [] })));
      } catch (error: unknown) {
        toast.error(getMessage(error, "Failed to fetch timesheet data."));
      }
    };

    if (token && id_tran_project) {
      fetchTimesheets();
    }
  }, [token, id_tran_project, ApiEndPoint, axiosJWT, userId, date]);

  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        for (let i = 0; i < timesheets.length; i++) {
          if (selectedTimesheet?.id_satuan === 2) {
            const tanggal = timesheets[i].tanggal.split("T")[0];
            const project = selectedTimesheet.inisial_project;

            const response = await axiosJWT.get(
              `${ApiEndPoint}/api/uploadKarya/${id}/${project}/${tanggal}`,
            );

            if (response.status === 200) {
              const files: string[] = response.data.files || [];
              setUploadedFiles((prev) => ({
                ...prev,
                [timesheets[i].tanggal]: files,
              }));

              const urls: string[] = [];
              for (const fileName of files) {
                try {
                  const blobRes = await axiosJWT.get(
                    `${ApiEndPoint}/api/uploadKarya/download/${fileName}`,
                    { responseType: "blob" },
                  );
                  const objectUrl = window.URL.createObjectURL(
                    new Blob([blobRes.data]),
                  );
                  urls.push(objectUrl);
                  createdObjectUrlsRef.current.push(objectUrl);
                } catch (_err) {}
              }
              if (urls.length > 0) {
                setObjectUrls((prev) => ({
                  ...prev,
                  [timesheets[i].tanggal]: urls,
                }));
              }
            }
          }
        }
      } catch (_error: unknown) {}
    };

    if (token && id_tran_project) {
      fetchUploadedFiles();
    }
  }, [
    ApiEndPoint,
    axiosJWT,
    token,
    id_tran_project,
    timesheets,
    selectedTimesheet,
    id,
  ]);

  useEffect(() => {
    return () => {
      try {
        createdObjectUrlsRef.current.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (_e) {
            // ignore
          }
        });
      } finally {
        createdObjectUrlsRef.current = [];
      }
    };
  }, []);

  // Build breadcrumb labels - map detail to project name
  const breadcrumbLabels: Record<string, string> = {};
  if (selectedTimesheet?.nama) {
    breadcrumbLabels["detail"] = selectedTimesheet.nama;
  }

  if (signatureChecking || !hasSignature) {
    return (
      <Layout title="Detail Timesheet" breadcrumbLabels={breadcrumbLabels}>
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-center text-blue-600 font-bold">
            Memeriksa data tanda tangan...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Detail Timesheet" breadcrumbLabels={breadcrumbLabels}>
      <div className="p-4 sm:p-6 pb-8 mb-2 rounded-lg">
        <div className="my-6">
          <div className="mb-4">
            {/* <label className="text-xl font-semibold">Detail Timesheet</label> */}
          </div>
          <div className="w-full">
            {timesheet && timesheet.length > 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col">
                  {/* Default: stacked (mobile/lg). At xl: show inline */}
                  <div className="mb-3 flex flex-col xl:flex-row gap-2">
                    <div className="w-full xl:w-56">
                      <label className="font-semibold text-xs xl:text-base">
                        NAMA MAGANG
                      </label>
                    </div>
                    <div className="w-full xl:w-1/2">
                      <p className="text-xs xl:text-base">
                        {
                          timesheet.find(
                            (value) => value.id === selectedIdTimesheet,
                          )?.nama
                        }
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-col xl:flex-row gap-2">
                    <div className="w-full xl:w-56">
                      <label className="font-semibold text-xs xl:text-base">
                        JENIS MAGANG
                      </label>
                    </div>
                    <div className="w-full xl:w-1/2">
                      <p className="text-xs xl:text-base">
                        {selectedTimesheet ? selectedTimesheet.kategori : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-col xl:flex-row gap-2">
                    <div className="w-full xl:w-56">
                      <label className="font-semibold text-xs xl:text-base">
                        PENANGGUNG JAWAB
                      </label>
                    </div>
                    <div className="w-full xl:w-1/2">
                      <p className="text-xs xl:text-base">
                        {selectedTimesheet ? selectedTimesheet.namaPIC : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card view for sm screens only */}
                <div className="block md:hidden">
                  <div className="space-y-4">
                    {timesheets.map((data, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="font-semibold text-xs text-gray-600">
                              Tanggal:
                            </label>
                            <p className="text-sm mt-1">
                              {new Date(data.tanggal).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                          <div>
                            <label className="font-semibold text-xs text-gray-600">
                              Kategori:
                            </label>
                            <p className="text-sm mt-1">
                              {
                                activities.find(
                                  (activity) =>
                                    activity.id === data.id_kategori_kegiatan,
                                )?.kegiatan
                              }
                            </p>
                          </div>
                          {/* Design/Karya Image - show for karya category */}
                          {selectedTimesheet?.kategoriId === 7 && (
                            <div>
                              <label className="font-semibold text-xs text-gray-600">
                                Design:
                              </label>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {objectUrls[data.tanggal] &&
                                objectUrls[data.tanggal].length > 0 ? (
                                  objectUrls[data.tanggal].map((url, i) => (
                                    <img
                                      key={i}
                                      src={url}
                                      alt={`Design ${i + 1}`}
                                      width={80}
                                      height={80}
                                      className="max-w-[80px] h-auto rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setPreviewImage(url)}
                                    />
                                  ))
                                ) : data.link_output ? (
                                  <img
                                    src={data.link_output}
                                    alt="Design"
                                    width={80}
                                    height={80}
                                    className="max-w-[80px] h-auto rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      setPreviewImage(data.link_output || null)
                                    }
                                  />
                                ) : null}
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="font-semibold text-xs text-gray-600">
                              Keterangan:
                            </label>
                            <p className="text-sm mt-1 break-words whitespace-pre-wrap">
                              {data.deskripsi}
                            </p>
                          </div>
                          {/* Time fields - hide for karya category */}
                          {!(selectedTimesheet?.kategoriId === 7) && (
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="font-semibold text-xs text-gray-600">
                                  Mulai:
                                </label>
                                <p className="text-sm mt-1">
                                  {data.jam_mulai
                                    ? new Date(data.jam_mulai)
                                        .toISOString()
                                        .substr(11, 5)
                                    : ""}
                                </p>
                              </div>
                              <div className="flex-1">
                                <label className="font-semibold text-xs text-gray-600">
                                  Selesai:
                                </label>
                                <p className="text-sm mt-1">
                                  {data.jam_selesai
                                    ? new Date(data.jam_selesai)
                                        .toISOString()
                                        .substr(11, 5)
                                    : ""}
                                </p>
                              </div>
                              <div className="flex-1">
                                <label className="font-semibold text-xs text-gray-600">
                                  Sesi:
                                </label>
                                <p className="text-sm mt-1">
                                  {data.total_sesi.toFixed(1)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table view for md and lg screens (small text) */}
                <div className="hidden md:block xl:hidden overflow-x-auto">
                  <table className="table w-full border-l-4 border-opacity-10 border-black border-solid">
                    <thead>
                      <tr>
                        <th className="pl-4 text-xs">Tanggal</th>
                        <th className="pl-4 text-xs">Kategori</th>
                        {selectedTimesheet?.kategoriId === 7 && (
                          <th className="pl-4 text-xs">Design</th>
                        )}
                        <th className="pl-4 text-xs">Keterangan</th>
                        {!(selectedTimesheet?.kategoriId === 7) && (
                          <>
                            <th className="pl-4 text-xs">Mulai</th>
                            <th className="pl-4 text-xs">Selesai</th>
                            <th className="pl-4 text-xs">Sesi</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {timesheets.map((data, index) => (
                        <tr key={index}>
                          <td className="bg-transparent pl-4 text-xs">
                            {new Date(data.tanggal).toLocaleDateString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="bg-transparent pl-4 text-xs">
                            {
                              activities.find(
                                (activity) =>
                                  activity.id === data.id_kategori_kegiatan,
                              )?.kegiatan
                            }
                          </td>
                          {selectedTimesheet?.kategoriId === 7 && (
                            <td className="bg-transparent pl-4 text-xs">
                              <div className="flex flex-wrap gap-2">
                                {objectUrls[data.tanggal] &&
                                objectUrls[data.tanggal].length > 0 ? (
                                  objectUrls[data.tanggal].map((url, i) => (
                                    <img
                                      key={i}
                                      src={url}
                                      alt={`Design ${i + 1}`}
                                      width={100}
                                      height={100}
                                      className="max-w-[100px] h-auto rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setPreviewImage(url)}
                                    />
                                  ))
                                ) : data.link_output ? (
                                  <img
                                    src={data.link_output}
                                    alt="Design"
                                    width={100}
                                    height={100}
                                    className="max-w-[100px] h-auto rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      setPreviewImage(data.link_output || null)
                                    }
                                  />
                                ) : null}
                              </div>
                            </td>
                          )}
                          <td className="bg-transparent pl-4 text-xs max-w-xs break-words whitespace-pre-wrap">
                            {data.deskripsi}
                          </td>
                          {!(selectedTimesheet?.kategoriId === 7) && (
                            <>
                              <td className="bg-transparent pl-4 text-xs">
                                {data.jam_mulai
                                  ? new Date(data.jam_mulai)
                                      .toISOString()
                                      .substr(11, 5)
                                  : ""}
                              </td>
                              <td className="bg-transparent pl-4 text-xs">
                                {data.jam_selesai
                                  ? new Date(data.jam_selesai)
                                      .toISOString()
                                      .substr(11, 5)
                                  : ""}
                              </td>
                              <td className="bg-transparent pl-4 text-xs">
                                {data.total_sesi.toFixed(1)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table view only for xl screens (normal text) */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="table w-full border-l-8 border-opacity-10 border-black border-solid">
                    <thead>
                      <tr>
                        <th className="pl-10 text-base">Tanggal</th>
                        <th className="pl-10 text-base">Kategori</th>
                        {selectedTimesheet?.kategoriId === 7 && (
                          <th className="pl-10 text-base">Design</th>
                        )}
                        <th className="pl-10 text-base">Keterangan</th>
                        {!(selectedTimesheet?.kategoriId === 7) && (
                          <>
                            <th className="pl-10 text-base">Mulai</th>
                            <th className="pl-10 text-base">Selesai</th>
                            <th className="pl-10 text-base">Sesi</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {timesheets.map((data, index) => (
                        <tr key={index}>
                          <td className="bg-transparent pl-10 text-sm">
                            {new Date(data.tanggal).toLocaleDateString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="bg-transparent pl-10 text-sm">
                            {
                              activities.find(
                                (activity) =>
                                  activity.id === data.id_kategori_kegiatan,
                              )?.kegiatan
                            }
                          </td>
                          {selectedTimesheet?.kategoriId === 7 && (
                            <td className="bg-transparent pl-10 text-sm">
                              <div className="flex flex-wrap gap-2">
                                {objectUrls[data.tanggal] &&
                                objectUrls[data.tanggal].length > 0 ? (
                                  objectUrls[data.tanggal].map((url, i) => (
                                    <img
                                      key={i}
                                      src={url}
                                      alt={`Design ${i + 1}`}
                                      width={150}
                                      height={150}
                                      className="max-w-[150px] h-auto rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setPreviewImage(url)}
                                    />
                                  ))
                                ) : data.link_output ? (
                                  <img
                                    src={data.link_output}
                                    alt="Design"
                                    width={150}
                                    height={150}
                                    className="max-w-[150px] h-auto rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      setPreviewImage(data.link_output || null)
                                    }
                                  />
                                ) : null}
                              </div>
                            </td>
                          )}
                          <td className="bg-transparent pl-10 text-sm max-w-xs break-words whitespace-pre-wrap">
                            {data.deskripsi}
                          </td>
                          {!(selectedTimesheet?.kategoriId === 7) && (
                            <>
                              <td className="bg-transparent pl-10 text-sm">
                                {data.jam_mulai
                                  ? new Date(data.jam_mulai)
                                      .toISOString()
                                      .substr(11, 5)
                                  : ""}
                              </td>
                              <td className="bg-transparent pl-10 text-sm">
                                {data.jam_selesai
                                  ? new Date(data.jam_selesai)
                                      .toISOString()
                                      .substr(11, 5)
                                  : ""}
                              </td>
                              <td className="bg-transparent pl-10 text-sm">
                                {data.total_sesi.toFixed(1)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300"
            onClick={() => setPreviewImage(null)}
          >
            &times;
          </button>
          <img
            src={previewImage}
            alt="Preview"
            width={1200}
            height={900}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(Detail);
