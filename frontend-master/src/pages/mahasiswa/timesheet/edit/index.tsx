import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/src/components/Layout";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { toast } from "react-toastify";
import { useRole } from "@/src/context/RoleContext";
import Link from "next/link";
import { getWeekNumber as _getWeekNumber } from "@/src/helper/dateHelpers";
import CryptoJS from "crypto-js";
import { showDeleteConfirmation, showSuccess } from "@/src/utils/swalHelper";

type Props = {
  user: unknown;
  role: string;
  id: string;
};

interface ApiResponse {
  id: number;
  nama: string;
  kategori: string;
  kategoriId: number;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  status: string;
  insentif: {
    durasi_satuan: number;
    besaran_insentif: number;
  };
  namaPIC: string;
  id_satuan: number;
  inisial_project: string;
  durasi_per_mahasiswa: number;
  id_tran_project: number; // Add tran_project.id for matching
  pendaftaran_selesai: string | null;
}

interface DecodedToken {
  exp: number;
}

type TimesheetData = {
  id: number;
  id_kategori_kegiatan: number;
  id_tran_project: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  deskripsi: string;
  total_sesi: number;
  link_output?: string;
};

interface JobUploadData {
  unggah_hasil: File[];
}

interface Activity {
  id: number;
  kegiatan: string;
}

function renderEventContent(eventInfo: {
  timeText?: string;
  event?: { title?: string };
}) {
  return (
    <>
      <b>{eventInfo.timeText}</b>
      <i>{eventInfo.event?.title}</i>
    </>
  );
}

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

function getWeekOfMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = (firstDay.getDay() + 6) % 7;
  const offsetDate = date.getDate() + dayOfWeek - 1;
  return Math.floor(offsetDate / 7) + 1;
}

const Edit = ({ user: _user, role: _role, id }: Props) => {
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<TimesheetData[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] =
    useState<ApiResponse | null>(null);
  const [toggleState, setToggleState] = useState(false);
  const [selectedIdTimesheet, setSelectedIdTimesheet] = useState<number>(0);
  const [timesheet, setTimesheet] = useState<ApiResponse[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const { setId } = useRole();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [deletedTimesheetIds, setDeletedTimesheetIds] = useState<number[]>([]);
  const [id_tran_project, setIdTranProject] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [jobUploadData, setJobUploadData] = useState<JobUploadData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{
    [key: string]: string[];
  }>({});
  const [objectUrls, setObjectUrls] = useState<Record<string, string[]>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [karyaInfo, setKaryaInfo] = useState<{
    isKarya: boolean;
    maxKarya: number;
    existingCount: number;
    remainingSlots: number;
  } | null>(null);
  const [originalTimesheetCount, setOriginalTimesheetCount] =
    useState<number>(0);
  const isPerKaryaLimited = selectedTimesheet?.kategoriId === 7;

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

  const handleRemoveDate = async (date: string) => {
    const result = await showDeleteConfirmation({
      title: "Apakah Anda yakin?",
      text: `Anda akan menghapus tanggal ${new Date(date).toLocaleDateString(
        "id-ID",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      )}. Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      const timesheetToDelete = timesheets.find(
        (item) => item.tanggal === date,
      );
      if (timesheetToDelete && timesheetToDelete.id !== 0) {
        setDeletedTimesheetIds((prevIds) => [...prevIds, timesheetToDelete.id]);
      }

      setTimesheets((prevData) =>
        prevData.filter((item) => item.tanggal !== date),
      );
      await showSuccess({
        title: "Dihapus!",
        text: "Tanggal tersebut telah dihapus.",
      });
    }
  };

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
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/masterProject/timesheet/${userId}`,
        );
        setTimesheet(res.data.data);
        if (res.data.data.length > 0) {
          const defaultProject = res.data.data.find(
            (item: ApiResponse) =>
              item.id_tran_project === Number(id_tran_project),
          );
          if (defaultProject) {
            setSelectedIdTimesheet(defaultProject.id);
            setSelectedTimesheet(defaultProject);
            setIdTranProject(defaultProject.id_tran_project);
          } else {
            setSelectedIdTimesheet(res.data.data[0].id);
            setSelectedTimesheet(res.data.data[0]);
            setIdTranProject(res.data.data[0].id_tran_project);
          }
        }
      } catch (err: unknown) {
        toast.error(getMessage(err, "Failed to fetch project data."));
      }
    };

    if (token) {
      fetchProject();
    }
  }, [token, axiosJWT, ApiEndPoint, id_tran_project, userId]);

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
        setOriginalTimesheetCount(response.data.data.length);
        setJobUploadData(response.data.data.map(() => ({ unggah_hasil: [] })));
        if (id_tran_project) {
          try {
            const karyaRes = await axiosJWT.get(
              `${ApiEndPoint}/api/timesheet/karya-info/${id_tran_project}`,
            );
            setKaryaInfo(karyaRes.data.data);
          } catch (karyaErr: unknown) {
            setKaryaInfo(null);
          }
        }
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
          if (
            selectedTimesheet?.id_satuan === 2 &&
            selectedTimesheet?.kategori !==
              "Pembuatan Design Media Audio Visual"
          ) {
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
                if (/\.(png|jpg|jpeg|gif|webp)$/i.test(fileName)) {
                  try {
                    const blobRes = await axiosJWT.get(
                      `${ApiEndPoint}/api/uploadKarya/download/${fileName}`,
                      { responseType: "blob" },
                    );
                    const objectUrl = window.URL.createObjectURL(
                      new Blob([blobRes.data]),
                    );
                    urls.push(objectUrl);
                  } catch (_e) {
                    urls.push("");
                  }
                } else {
                  urls.push("");
                }
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = Number(e.target.value);
    setSelectedIdTimesheet(selectedId);
    const selectedTimesheetData = timesheet.find(
      (item) => item.id === selectedId,
    );
    setSelectedTimesheet(selectedTimesheetData || null);
    if (selectedTimesheetData) {
      setIdTranProject(selectedTimesheetData.id_tran_project);
    }
    timesheets.map((item) => {
      item.id_tran_project = selectedTimesheetData?.id_tran_project || 0;
    });
    setTimesheets(timesheets);
  };

  const handleDateClick = (e: { dateStr: string }) => {
    const clickedDate = new Date(e.dateStr);

    // Cek jika tanggal yang dipilih sudah ada di timesheet
    const dateExists = timesheets.some((data) => {
      const existingDate = new Date(data.tanggal);
      return (
        existingDate.getUTCFullYear() === clickedDate.getUTCFullYear() &&
        existingDate.getUTCMonth() === clickedDate.getUTCMonth() &&
        existingDate.getUTCDate() === clickedDate.getUTCDate()
      );
    });

    if (dateExists) {
      toast.error("Tanggal ini sudah ada dalam timesheet. Pilih tanggal lain.");
      return;
    }

    // Validasi rentang tanggal jika ada selectedTimesheet
    if (selectedTimesheet) {
      const parseDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        if (dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/");
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        return new Date(dateStr);
      };

      const projectStartDate = parseDate(selectedTimesheet.tanggal_mulai);
      const projectEndDate = parseDate(selectedTimesheet.tanggal_selesai);

      // Jika tanggal_mulai atau tanggal_selesai null (karya), skip validasi rentang tanggal
      const hasDateRange = projectStartDate && projectEndDate;

      if (hasDateRange) {
        // Set semua tanggal ke midnight (00:00:00) untuk perbandingan yang akurat
        projectStartDate.setHours(0, 0, 0, 0);
        projectEndDate.setHours(0, 0, 0, 0);
        clickedDate.setHours(0, 0, 0, 0);

        if (clickedDate < projectStartDate || clickedDate > projectEndDate) {
          toast.error(
            `Tanggal timesheet hanya boleh dalam rentang pelaksanaan kegiatan: ${projectStartDate.toLocaleDateString(
              "id-ID",
            )} - ${projectEndDate.toLocaleDateString("id-ID")}`,
          );
          return;
        }
      }
    }

    // Validasi: bulan dan tahun harus sama dengan data timesheet yang sudah ada
    if (timesheets.length > 0) {
      const existingDate = new Date(timesheets[0].tanggal);
      const existingMonth = existingDate.getUTCMonth();
      const existingYear = existingDate.getUTCFullYear();

      const clickedMonth = clickedDate.getUTCMonth();
      const clickedYear = clickedDate.getUTCFullYear();

      if (existingMonth !== clickedMonth || existingYear !== clickedYear) {
        const monthNames = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ];
        toast.error(
          `Bulan dan tahun untuk data baru harus sama dengan data timesheet yang ada (${monthNames[existingMonth]} ${existingYear}).`,
        );
        return;
      }
    }

    const date = e.dateStr.toString();
    setTimesheets((prevData) => [
      ...prevData,
      {
        id: 0,
        id_kategori_kegiatan: 0,
        id_tran_project: id_tran_project || 0,
        tanggal: `${date}T00:00:00.000Z`,
        jam_mulai: "",
        jam_selesai: "",
        deskripsi: "",
        total_sesi: 0,
      },
    ]);
    setJobUploadData((prevData) => [
      ...prevData,
      {
        unggah_hasil: [],
      },
    ]);
    setToggleState(false);
  };

  const handleCategoryChange = (
    index: number,
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const updatedTimesheetData = [...timesheets];
    updatedTimesheetData[index].id_kategori_kegiatan = Number(e.target.value);
    setTimesheets(updatedTimesheetData);
  };

  const handleDescriptionChange = (
    index: number,
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const updatedTimesheetData = [...timesheets];
    updatedTimesheetData[index].deskripsi = e.target.value;
    setTimesheets(updatedTimesheetData);
  };

  const handleStartTimeChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheetData = [...timesheets];
    updatedTimesheetData[index].jam_mulai =
      `1970-01-01T${e.target.value}:00.000Z`;
    updateTotalSesi(index, updatedTimesheetData);
  };

  const handleEndTimeChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheetData = [...timesheets];
    updatedTimesheetData[index].jam_selesai =
      `1970-01-01T${e.target.value}:00.000Z`;
    updateTotalSesi(index, updatedTimesheetData);
  };

  const updateTotalSesi = (
    index: number,
    updatedTimesheetData: TimesheetData[],
  ) => {
    const startTime = new Date(updatedTimesheetData[index].jam_mulai);
    const endTime = new Date(updatedTimesheetData[index].jam_selesai);
    const diffInMinutes =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    // Use durasi_satuan from project (e.g., 50 for id_kategori=3, 60 for id_kategori=8)
    const durasiSatuan = selectedTimesheet?.insentif?.durasi_satuan || 50;
    updatedTimesheetData[index].total_sesi = diffInMinutes / durasiSatuan;
    setTimesheets(updatedTimesheetData);
  };

  const handleFileChange = (dateIndex: number, newFiles: FileList | null) => {
    if (newFiles) {
      setJobUploadData((prevData) => {
        const updatedJobUploadData = [...prevData];
        const fileArray = Array.from(newFiles);

        const combinedFiles = [
          ...updatedJobUploadData[dateIndex].unggah_hasil,
          ...fileArray,
        ];

        const uniqueFiles = combinedFiles.filter(
          (file, index, self) =>
            index === self.findIndex((f) => f.name === file.name),
        );

        updatedJobUploadData[dateIndex].unggah_hasil = uniqueFiles;

        return updatedJobUploadData;
      });
    }
  };

  const handleDownloadFile = async (fileName: string) => {
    try {
      const response = await axiosJWT.get(
        `${ApiEndPoint}/api/uploadKarya/download/${fileName}`,
        {
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) {
      toast.error(getMessage(error, "Gagal mengunduh file."));
    }
  };

  const handleRemoveFile = async (fileName: string, dateIndex: number) => {
    const result = await showDeleteConfirmation({
      title: "Apakah Anda yakin?",
      text: `Anda akan menghapus file ${fileName}. Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      const filePattern = new RegExp(
        `^${selectedTimesheet?.inisial_project}_\\d{4}-\\d{2}-\\d{2}_${id}_\\d+\\..+$`,
      );

      if (filePattern.test(fileName)) {
        try {
          await axiosJWT.delete(
            `${ApiEndPoint}/api/uploadKarya/delete/${fileName}`,
          );

          setUploadedFiles((prev) => ({
            ...prev,
            [timesheets[dateIndex].tanggal]: prev[
              timesheets[dateIndex].tanggal
            ].filter((file) => file !== fileName),
          }));

          toast.success("File berhasil dihapus.");
        } catch (error: unknown) {
          toast.error(getMessage(error, "Gagal menghapus file."));
        }
      } else {
        setJobUploadData((prevData) => {
          const updatedJobUploadData = [...prevData];
          updatedJobUploadData[dateIndex].unggah_hasil = updatedJobUploadData[
            dateIndex
          ].unggah_hasil.filter((file) => file.name !== fileName);
          return updatedJobUploadData;
        });

        toast.success("File berhasil dihapus dari jobUploadData.");
      }
    } else {
      toast.info("Penghapusan file dibatalkan.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimesheet) {
      toast.error("Pilih project terlebih dahulu.");
      return;
    }
    const isKaryaCategory =
      selectedTimesheet.id_satuan === 2 ||
      selectedTimesheet.kategoriId === 7 ||
      /pembuatan\s+design\s+media/i.test(selectedTimesheet.kategori || "");
    let valid = true;

    timesheets.forEach((data) => {
      // Validasi dasar: kategori kegiatan, tanggal, deskripsi
      if (
        data.id_kategori_kegiatan === 0 ||
        data.tanggal === "" ||
        data.deskripsi === ""
      ) {
        valid = false;
      }

      // Validasi jam dan link hanya untuk non-karya
      if (!isKaryaCategory) {
        if (
          data.jam_mulai === "" ||
          data.jam_selesai === "" ||
          !data.link_output ||
          data.link_output.trim() === ""
        ) {
          valid = false;
        }
      }
    });

    if (!valid) {
      if (isKaryaCategory) {
        toast.error("Harap isi kategori kegiatan dan deskripsi.");
      } else {
        toast.error(
          "Harap isi semua input yang disediakan, termasuk Link Output.",
        );
      }
      return;
    }

    // Validasi total sesi tidak melebihi durasi per mahasiswa (hanya untuk berbasis waktu, bukan karya)
    if (selectedTimesheet.id_satuan !== 2 && !isKaryaCategory) {
      const totalSesi = timesheets.reduce(
        (acc, curr) => acc + curr.total_sesi,
        0,
      );
      const maxSesi = (selectedTimesheet.durasi_per_mahasiswa * 60) / 50;
      if (totalSesi > maxSesi) {
        toast.error(
          `Total sesi (${totalSesi.toFixed(1)}) melebihi batas maksimal (${maxSesi.toFixed(1)}) berdasarkan durasi per mahasiswa (${selectedTimesheet.durasi_per_mahasiswa} jam).`,
        );
        return;
      }
    }

    if (
      isPerKaryaLimited &&
      karyaInfo &&
      karyaInfo.isKarya &&
      karyaInfo.maxKarya > 0
    ) {
      // Calculate net change in karya count
      const currentCount = timesheets.length;
      const deletedCount = deletedTimesheetIds.length;
      // existingCount from karyaInfo includes the original timesheets being edited
      // We need to calculate: (existingCount - originalTimesheetCount) + currentCount - deletedCount
      const netNewKarya = currentCount - deletedCount;
      const otherExistingKarya =
        karyaInfo.existingCount - originalTimesheetCount;
      const totalAfterEdit = otherExistingKarya + netNewKarya;

      if (totalAfterEdit > karyaInfo.maxKarya) {
        toast.error(
          `Jumlah karya melebihi batas maksimal. Maksimal: ${karyaInfo.maxKarya} karya, total setelah edit: ${totalAfterEdit} karya.`,
        );
        return;
      }
    }

    // Validasi jam harian/mingguan/bulanan
    // Skip untuk kategoriId === 7 (design media), tapi terapkan untuk kategoriId === 8 (karya video) dan lainnya
    const shouldValidateHours = selectedTimesheet.kategoriId !== 7;

    if (shouldValidateHours) {
      const totalDailyHours = timesheets.reduce(
        (acc, curr) => {
          const d = new Date(curr.tanggal);
          const key = d.toISOString().substr(0, 10); // YYYY-MM-DD
          if (!acc[key]) acc[key] = 0;
          acc[key] +=
            (new Date(curr.jam_selesai).getTime() -
              new Date(curr.jam_mulai).getTime()) /
            (1000 * 60 * 60);
          return acc;
        },
        {} as { [key: string]: number },
      );

      const bulanIndo = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];

      const totalWeeklyHours: { [key: string]: number } = {};
      timesheets.forEach((curr) => {
        const date = new Date(curr.tanggal);
        const month = date.getMonth();
        const week = getWeekOfMonth(date);
        const key = `${month}-${week}`;
        if (!totalWeeklyHours[key]) totalWeeklyHours[key] = 0;
        totalWeeklyHours[key] +=
          (new Date(curr.jam_selesai).getTime() -
            new Date(curr.jam_mulai).getTime()) /
          (1000 * 60 * 60);
      });

      const totalMonthlyHours = timesheets.reduce(
        (acc, curr) => {
          const month = new Date(curr.tanggal).getMonth();
          if (!acc[month]) acc[month] = 0;
          acc[month] +=
            (new Date(curr.jam_selesai).getTime() -
              new Date(curr.jam_mulai).getTime()) /
            (1000 * 60 * 60);
          return acc;
        },
        {} as { [key: number]: number },
      );

      for (const isoDate in totalDailyHours) {
        if (totalDailyHours[isoDate] > 4) {
          const d = new Date(isoDate);
          const formatted = d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          toast.error(
            `Total jam pada tanggal ${formatted} melebihi 4 jam / 4.8 sesi (1 sesi = 50 menit).`,
          );
          return;
        }
      }

      for (const key in totalWeeklyHours) {
        if (totalWeeklyHours[key] > 15) {
          const [monthIdx, weekNum] = key.split("-");
          const monthName = bulanIndo[parseInt(monthIdx, 10)];
          toast.error(
            `Total jam pada minggu ke-${parseInt(weekNum)} bulan ${monthName} melebihi 15 jam / 18 sesi (1 sesi = 50 menit).`,
          );
          return;
        }
      }

      for (const month in totalMonthlyHours) {
        if (totalMonthlyHours[month] > 40) {
          toast.error(
            `Total jam pada bulan ke-${parseInt(month) + 1} melebihi 40 jam / 48 sesi (1 sesi = 50 menit).`,
          );
          return;
        }
      }
    }

    const isSameMonthAndYear = (date1: string, date2: string) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return (
        d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
      );
    };

    for (const newTimesheet of timesheets.filter((ts) => ts.id === 0)) {
      for (const existingTimesheet of timesheets.filter((ts) => ts.id !== 0)) {
        if (
          !isSameMonthAndYear(newTimesheet.tanggal, existingTimesheet.tanggal)
        ) {
          toast.error(
            "Bulan dan tahun untuk data baru harus sama dengan data timesheet yang ada.",
          );
          return;
        }
      }
    }

    try {
      for (let i = 0; i < timesheets.length; i++) {
        if (
          selectedTimesheet?.id_satuan === 2 &&
          selectedTimesheet?.kategori !==
            "Pembuatan Design Media Audio Visual" &&
          jobUploadData[i].unggah_hasil.length > 0
        ) {
          const formData = new FormData();

          for (const file of jobUploadData[i].unggah_hasil) {
            formData.append("file", file);
          }

          try {
            const response = await axiosJWT.post(
              `${ApiEndPoint}/api/uploadKarya/upload/${id}/${selectedTimesheet.inisial_project}/${timesheets[i].tanggal}`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              },
            );

            if (response.status !== 200) {
              toast.error(`Gagal mengunggah file`);
              return;
            } else {
              toast.success(`Berhasil mengunggah file`);
            }
          } catch (uploadError: unknown) {
            toast.error(getMessage(uploadError, "Gagal mengunggah file"));
            return;
          }
        }
      }

      for (const timesheetId of deletedTimesheetIds) {
        await axiosJWT.delete(`${ApiEndPoint}/api/timesheet/${timesheetId}`);
      }

      // Set default values for karya category (jam tidak diperlukan untuk id_kategori = 7)
      let processedTimesheets = timesheets;
      if (isKaryaCategory) {
        processedTimesheets = timesheets.map((data) => ({
          ...data,
          jam_mulai: data.jam_mulai || "1970-01-01T00:00:00.000Z",
          jam_selesai: data.jam_selesai || "1970-01-01T00:01:00.000Z",
          total_sesi: data.total_sesi || 0,
          link_output: data.link_output || "-",
        }));
      }

      const newTimesheets = processedTimesheets
        .filter((timesheet) => timesheet.id === 0)
        .map(({ id: _id, ...rest }) => ({
          ...rest,
          id_tran_project: id_tran_project || 0,
        }));
      const existingTimesheets = processedTimesheets.filter(
        (timesheet) => timesheet.id !== 0,
      );
      if (newTimesheets.length > 0) {
        const createResponse = await axiosJWT.post(
          `${ApiEndPoint}/api/timesheet/update`,
          newTimesheets,
        );
        if (createResponse.status === 200) {
          for (const data of createResponse.data.data.createdIds) {
            await axiosJWT.post(`${ApiEndPoint}/api/timesheetHistory`, {
              id_timesheet: Number(data),
              id_status: 4,
              changed_at: new Date().toISOString(),
            });
          }
          toast.success("Data berhasil ditambahkan!");
        } else {
          toast.error(createResponse.data.message || "Gagal menambahkan data.");
        }
      }

      for (const timesheet of existingTimesheets) {
        const response = await axiosJWT.put(
          `${ApiEndPoint}/api/timesheet/${timesheet.id}`,
          timesheet,
        );
        if (response.status === 200) {
          // Use the status from backend response (5=Revised if previously Revision Required, else same status)
          const newStatus = response.data.data.id_status || 4;
          await axiosJWT.post(`${ApiEndPoint}/api/timesheetHistory`, {
            id_timesheet: Number(response.data.data.id),
            id_status: newStatus,
            changed_at: new Date().toISOString(),
          });
          toast.success("Data berhasil diperbarui!", {
            toastId: "update-success",
          });
        } else {
          toast.error(response.data.message || "Gagal memperbarui data.");
        }
      }

      router.push("/mahasiswa/timesheet");
    } catch (error: unknown) {
      toast.error(getMessage(error, "Gagal menyimpan data."));
    }
  };

  const handleLinkOutputChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheets = [...timesheets];
    updatedTimesheets[index].link_output = e.target.value;
    setTimesheets(updatedTimesheets);
  };

  // Build breadcrumb labels - map edit to project name
  const breadcrumbLabels: Record<string, string> = {};
  if (selectedTimesheet?.nama) {
    breadcrumbLabels["edit"] = selectedTimesheet.nama;
  }

  if (signatureChecking || !hasSignature) {
    return (
      <Layout title="Edit Timesheet" breadcrumbLabels={breadcrumbLabels}>
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-center text-blue-600 font-bold">
            Memeriksa data tanda tangan...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Edit Timesheet" breadcrumbLabels={breadcrumbLabels}>
      <div className="p-6 pb-8 mb-2 rounded-lg">
        <div className="my-6">
          <div className="mb-4 px-4 sm:px-16">
            <label className="text-xl font-semibold">Edit Timesheet</label>
          </div>
          <div className="w-full px-0 sm:px-56">
            {timesheet && timesheet.length > 0 && (
              <form
                method="POST"
                onSubmit={handleSubmit}
                encType="multipart/form-data"
              >
                <table className="table w-full border-l-0 sm:border-l-8 border-opacity-10 border-black border-solid">
                  <tbody>
                    <tr>
                      <td className="bg-transparent px-4 sm:pl-10">
                        <div className="mb-3 flex flex-col gap-2">
                          <label className="font-semibold text-xs sm:text-base">
                            NAMA MAGANG
                          </label>
                          <select
                            name="namaMagang"
                            id="namaMagang"
                            className="select select-bordered w-full shadow-lg text-xs sm:text-sm"
                            onChange={handleChange}
                            value={selectedIdTimesheet}
                          >
                            <option value="0">--Nama Magang--</option>
                            {timesheet.map((value) => (
                              <option key={value.id} value={value.id}>
                                {value.nama}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-3 flex flex-col gap-2">
                          <label className="font-semibold text-xs sm:text-base">
                            JENIS MAGANG
                          </label>
                          <input
                            type="text"
                            value={
                              selectedTimesheet
                                ? selectedTimesheet.kategori
                                : ""
                            }
                            disabled
                            className="w-full shadow-lg bg-gray-400 text-xs sm:text-sm px-3 py-2 rounded"
                          />
                        </div>
                        <div className="mb-3 flex flex-col gap-2">
                          <label className="font-semibold text-xs sm:text-base">
                            PENANGGUNG JAWAB
                          </label>
                          <input
                            type="text"
                            value={
                              selectedTimesheet ? selectedTimesheet.namaPIC : ""
                            }
                            disabled
                            className="w-full shadow-lg bg-gray-400 text-xs sm:text-sm px-3 py-2 rounded"
                          />
                        </div>
                        {/* Karya Info Display */}
                        {isPerKaryaLimited &&
                          karyaInfo &&
                          karyaInfo.isKarya &&
                          karyaInfo.maxKarya > 0 && (
                            <div
                              className={`mb-3 p-3 rounded-lg ${karyaInfo.remainingSlots > 0 ? "bg-blue-100 border border-blue-300" : "bg-yellow-100 border border-yellow-300"}`}
                            >
                              <p className="font-semibold text-xs sm:text-sm mb-1">
                                Info Batas Karya:
                              </p>
                              <p className="text-xs sm:text-sm">
                                Maksimal:{" "}
                                <span className="font-bold">
                                  {karyaInfo.maxKarya}
                                </span>{" "}
                                karya
                              </p>
                              <p className="text-xs sm:text-sm">
                                Total tercatat:{" "}
                                <span className="font-bold">
                                  {karyaInfo.existingCount}
                                </span>{" "}
                                karya
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600">
                                (Termasuk {originalTimesheetCount} karya yang
                                sedang diedit)
                              </p>
                            </div>
                          )}
                      </td>
                    </tr>
                    {timesheets.map((data, index) => (
                      <tr key={index}>
                        <td className="bg-transparent pl-2 sm:pl-10">
                          <div className="mb-4">
                            <div className="flex items-center mb-2">
                              <div className="flex items-center bg-gray-400 text-white rounded-lg px-2 py-1 sm:px-4 sm:py-2 shadow-lg text-xs sm:text-base">
                                <span>
                                  {new Date(data.tanggal).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDate(data.tanggal)}
                                  className="ml-1 sm:ml-2 text-red-500 font-bold"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <div className="w-full sm:w-4/5">
                                <select
                                  name={`kategori-${index}`}
                                  className="select select-sm sm:select-md select-bordered w-full shadow-lg text-xs sm:text-base"
                                  onChange={(e) =>
                                    handleCategoryChange(index, e)
                                  }
                                  value={data.id_kategori_kegiatan}
                                >
                                  <option value="0">--Pilih Kategori--</option>
                                  {activities.map((activity) => (
                                    <option
                                      key={activity.id}
                                      value={activity.id}
                                    >
                                      {activity.kegiatan}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center mt-2 sm:mt-4">
                              <div className="w-full">
                                <textarea
                                  name={`deskripsi-${index}`}
                                  className="textarea textarea-sm sm:textarea-md textarea-bordered w-full sm:w-4/5 shadow-lg text-xs sm:text-base"
                                  placeholder="Deskripsi"
                                  onChange={(e) =>
                                    handleDescriptionChange(index, e)
                                  }
                                  value={data.deskripsi}
                                />
                              </div>
                            </div>
                            {/* Jam Mulai, Jam Selesai, Sesi - hide only for karya kategoriId 7 */}
                            {!(selectedTimesheet?.kategoriId === 7) && (
                              <div className="flex flex-wrap items-center mt-2 sm:mt-4 gap-2">
                                <div className="w-[45%] sm:w-1/4">
                                  <input
                                    type="time"
                                    name={`jamMulai-${index}`}
                                    className="input input-sm sm:input-md input-bordered w-full shadow-lg text-xs sm:text-base"
                                    placeholder="Jam Mulai"
                                    onChange={(e) =>
                                      handleStartTimeChange(index, e)
                                    }
                                    value={
                                      data.jam_mulai
                                        ? new Date(data.jam_mulai)
                                            .toISOString()
                                            .substr(11, 5)
                                        : ""
                                    }
                                  />
                                </div>
                                <div className="w-[45%] sm:w-1/4 sm:ml-4">
                                  <input
                                    type="time"
                                    name={`jamSelesai-${index}`}
                                    className="input input-sm sm:input-md input-bordered w-full shadow-lg text-xs sm:text-base"
                                    placeholder="Jam Selesai"
                                    onChange={(e) =>
                                      handleEndTimeChange(index, e)
                                    }
                                    value={
                                      data.jam_selesai
                                        ? new Date(data.jam_selesai)
                                            .toISOString()
                                            .substr(11, 5)
                                        : ""
                                    }
                                  />
                                </div>
                                <div className="w-full sm:w-1/8 sm:ml-4 flex items-center">
                                  <input
                                    type="text"
                                    value={data.total_sesi.toFixed(1)}
                                    disabled
                                    className="input input-sm sm:input-md input-bordered w-20 sm:w-full shadow-lg bg-gray-400 text-xs sm:text-base"
                                  />
                                  <span className="ml-2 text-xs sm:text-base">
                                    Sesi
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Input Link Output - hide only for karya kategoriId 7 */}
                            {!(selectedTimesheet?.kategoriId === 7) && (
                              <div className="flex items-center mt-2">
                                <div className="w-full">
                                  <input
                                    type="text"
                                    name={`link_output-${index}`}
                                    className={`input input-sm sm:input-md input-bordered w-full sm:w-4/5 shadow-lg text-xs sm:text-base ${!data.link_output ? "border-red-500" : ""}`}
                                    placeholder="Link Output/Dokumentasi (wajib)"
                                    value={data.link_output || ""}
                                    onChange={(e) =>
                                      handleLinkOutputChange(index, e)
                                    }
                                    required
                                  />
                                  {!data.link_output && (
                                    <span className="text-red-500 text-xs">
                                      Link Output wajib diisi
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {selectedTimesheet?.id_satuan === 2 &&
                              selectedTimesheet?.kategori !==
                                "Pembuatan Design Media Audio Visual" && (
                                <div className="flex flex-col mt-2 sm:mt-4">
                                  <div className="w-full sm:w-1/2">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700">
                                      Unggah Hasil
                                    </label>

                                    {uploadedFiles[
                                      timesheets[index]?.tanggal
                                    ] &&
                                      uploadedFiles[timesheets[index]?.tanggal]
                                        .length > 0 && (
                                        <div className="mt-2 sm:mt-4 flex flex-wrap gap-3">
                                          {uploadedFiles[
                                            timesheets[index]?.tanggal
                                          ].map((fileName, fileIndex) => {
                                            const isImage =
                                              /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                                fileName,
                                              );
                                            const objectUrl =
                                              objectUrls[
                                                timesheets[index]?.tanggal
                                              ]?.[fileIndex] || "";
                                            return (
                                              <div
                                                key={fileIndex}
                                                className="relative group"
                                              >
                                                {isImage && objectUrl ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img
                                                    src={objectUrl}
                                                    alt={`Design ${fileIndex + 1}`}
                                                    style={{
                                                      maxWidth: 100,
                                                      height: "auto",
                                                    }}
                                                    className="rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                                                    onClick={() =>
                                                      setPreviewImage(objectUrl)
                                                    }
                                                  />
                                                ) : (
                                                  <a
                                                    href="#"
                                                    onClick={() =>
                                                      handleDownloadFile(
                                                        fileName,
                                                      )
                                                    }
                                                    className="truncate text-blue-500 hover:underline text-xs sm:text-base"
                                                  >
                                                    {fileName}
                                                  </a>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleRemoveFile(
                                                      fileName,
                                                      index,
                                                    )
                                                  }
                                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  &times;
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                    <div className="mt-1 relative border-dashed border-2 border-gray-300 p-2 sm:p-4 rounded-md bg-white">
                                      <input
                                        type="file"
                                        name={`unggahHasil-${index}`}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        multiple
                                        onChange={(e) =>
                                          handleFileChange(
                                            index,
                                            e.target.files,
                                          )
                                        }
                                      />
                                      <p className="text-center text-gray-500 text-xs sm:text-base">
                                        Drag and drop files, or click to select
                                      </p>
                                    </div>

                                    <div className="mt-2 sm:mt-4">
                                      {jobUploadData[index]?.unggah_hasil?.map(
                                        (file, fileIndex) => (
                                          <div
                                            key={fileIndex}
                                            className="flex items-center space-x-2"
                                          >
                                            <span className="truncate text-xs sm:text-base">
                                              {file.name}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveFile(
                                                  file.name,
                                                  index,
                                                )
                                              }
                                              className="text-red-500 font-bold text-sm sm:text-base"
                                            >
                                              &times;
                                            </button>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="bg-transparent">
                        <div className="bg-[#969696] ml-17 sm:ml-56 px-2.5 py-1 w-40 rounded-full text-sm sm:text-md text-center text-black shadow-sm">
                          <a
                            className="cursor-pointer"
                            onClick={() => setToggleState(!toggleState)}
                          >
                            Tambah Tanggal
                          </a>
                        </div>
                        {toggleState && (
                          <div
                            id="calender"
                            className="mt-8 m-2 p-2 text-black text-[9px] my-calendar rounded-xl shadow-md w-60 ml-17 sm:ml-56"
                          >
                            <FullCalendar
                              plugins={[dayGridPlugin, interactionPlugin]}
                              initialView="dayGridMonth"
                              fixedWeekCount={false}
                              weekends={true}
                              eventContent={renderEventContent}
                              height={320}
                              dateClick={handleDateClick}
                              validRange={(() => {
                                if (!selectedTimesheet) return undefined;
                                const parseDate = (
                                  dateStr: string | null | undefined,
                                ) => {
                                  if (!dateStr) return null;
                                  if (dateStr.includes("/")) {
                                    const [day, month, year] =
                                      dateStr.split("/");
                                    return new Date(
                                      parseInt(year),
                                      parseInt(month) - 1,
                                      parseInt(day),
                                    );
                                  }
                                  return new Date(dateStr);
                                };
                                const start = parseDate(
                                  selectedTimesheet.tanggal_mulai,
                                );
                                const end = parseDate(
                                  selectedTimesheet.tanggal_selesai,
                                );

                                // For karya projects with no date range, block dates up to pendaftaran_selesai
                                if (!start && !end) {
                                  const regEnd = parseDate(
                                    selectedTimesheet.pendaftaran_selesai,
                                  );
                                  if (regEnd) {
                                    const dayAfterReg = new Date(regEnd);
                                    dayAfterReg.setDate(
                                      dayAfterReg.getDate() + 1,
                                    );
                                    return { start: dayAfterReg };
                                  }
                                  return undefined;
                                }

                                const range: { start?: Date; end?: Date } = {};
                                if (start) range.start = start;
                                if (end) {
                                  // Tidak perlu menambah 1 hari lagi - gunakan tanggal akhir asli
                                  range.end = end;
                                }
                                return range;
                              })()}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="bg-transparent">
                        <div className="flex justify-end gap-2">
                          <Link
                            href="/mahasiswa/timesheet"
                            className="bg-primary text-white px-4 py-2 text-sm sm:text-md rounded shadow inline-block text-center w-28"
                          >
                            Kembali
                          </Link>
                          {timesheets.length > 0 && (
                            <button
                              type="submit"
                              className="bg-blue-500 text-white px-4 py-2 text-sm sm:text-md rounded shadow inline-block text-center w-28"
                            >
                              Simpan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </form>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-lg hover:bg-gray-200 transition-colors"
            >
              &times;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                objectFit: "contain",
              }}
              className="rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(Edit);
