import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import CryptoJS from "crypto-js";
import Layout from "@/src/components/Layout";
import ProgressIndicator from "@/src/components/ProgressIndicator";
import PageLoader from "@/src/components/PageLoader";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { getWeekNumber } from "@/src/helper/dateHelpers";
import { jwtDecode } from "jwt-decode";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { getStatusBadgeClassName } from "@/src/constants/badge";
import {
  showDeleteConfirmation,
  showSuccess,
  showConfirmation,
} from "@/src/utils/swalHelper";
import Swal from "sweetalert2";

type TimesheetData = {
  id: number;
  id_kategori_kegiatan: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  deskripsi: string;
  total_sesi: number;
  id_tran_project: number;
  link_output?: string;
};

interface DecodedToken {
  exp: number;
}

type Activity = {
  id: number;
  kegiatan: string;
};

type StudentData = {
  id_project: number;
  id_tmst_project: number;
  nim: string;
  nama: string;
  status?: string;
  isReview?: boolean;
};

interface ApiResponse {
  id: number;
  nama: string;
  kategori: string;
  kategoriId?: number;
  insentif: {
    durasi_satuan: number;
    besaran_insentif: number;
  };
  namaPIC: string;
  id_satuan: number;
  inisial_project: string;
  id_tran_project: number; // Add tran_project.id for matching
  status?: string; // Add status for project level state
}

const ViewSubmitPayment = () => {
  const router = useRouter();
  const { project_id } = router.query;

  const [timesheets, setTimesheets] = useState<TimesheetData[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{
    [key: string]: string[];
  }>({});
  const [selectedTimesheet, setSelectedTimesheet] =
    useState<ApiResponse | null>(null);
  const [jobUploadData, setJobUploadData] = useState<
    { unggah_hasil: File[] }[]
  >([]);
  const [toggleState, setToggleState] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [formattedDate, setFormattedDate] = useState<string>("");
  const [id_tran_project, setIdTranProject] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [deletedTimesheetIds, setDeletedTimesheetIds] = useState<number[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [id_satuan, setIdSatuan] = useState<number | null>(null);
  const [tmstProjectId, setTmstProjectId] = useState<number | null>(null);
  const [objectUrls, setObjectUrls] = useState<Record<string, string[]>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    id_tmst_project: number;
    periode: string;
    status: string;
    total_tagihan: number;
    id_status: number;
  } | null>(null);
  const [_revisiMessage, _setRevisiMessage] = useState<string>("");

  const secretKey = "my-secret-key";
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _encodedIdSatuan = null;
  let encodedDate = null;
  let encodedProjectId = null;
  let encodedUserId = null;

  // Parsing URL and decrypting data (menggunakan router.query)
  useEffect(() => {
    if (!router.isReady) return;
    const { id_tran_project, date, userId } = router.query;

    if (!id_tran_project || !date || !userId) {
      setLoading(true);
      setTimeout(() => router.replace("/user/timesheet"), 1200);
      return;
    }

    try {
      const encryptedProjectId = decodeURIComponent(id_tran_project as string);
      const encryptedDate = decodeURIComponent(date as string);
      const encryptedUserId = decodeURIComponent(userId as string);

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

      if (!decryptedProjectId || !decryptedDate || !decryptedUserId) {
        throw new Error("Decryption produced empty values");
      }

      setIdTranProject(Number(decryptedProjectId));
      setDate(decryptedDate);
      setUserId(Number(decryptedUserId));
      setFormattedDate(format(new Date(decryptedDate), "MMMM yyyy"));
    } catch (error) {
      console.error("Error decrypting query parameters:", error);
      setLoading(true);
      setTimeout(() => router.replace("/user/timesheet"), 1200);
      return;
    }
  }, [router.isReady, router.query, secretKey, router]);

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

  // Fetching all data after date, userId, and id_tran_project are set
  useEffect(() => {
    const fetchAllData = async (tmstProjId: number, date: string | null) => {
      try {
        setLoading(true);
        const [studentsResponse, timesheetResponse, activityResponse] =
          await Promise.all([
            axiosJWT.get(`${ApiEndPoint}/api/timesheet/submitPayment/get`, {
              params: {
                projectId: tmstProjId,
                date: date,
              },
            }),
            axiosJWT.get(
              `${ApiEndPoint}/api/timesheet/getEdit/${id_tran_project}`,
              {
                params: {
                  userId: userId,
                  date: date,
                },
              },
            ),
            axiosJWT.get(`${ApiEndPoint}/api/activity`),
          ]);

        console.debug("studentsResponse:", studentsResponse?.data);
        console.debug("timesheetResponse:", timesheetResponse?.data);
        console.debug("activityResponse:", activityResponse?.data);
        const studentsData = studentsResponse.data.data;
        const timesheetData = timesheetResponse.data.data;
        const activityData = activityResponse.data.data;

        timesheetData.map((item: { id_project?: number }) => {
          delete item.id_project;
        });

        setStudents(studentsData);
        setTimesheets(timesheetData);
        setActivities(activityData);

        if (studentsData.length > 0) {
          // Remove PIC name from project name (format: "Project Name - PIC Name")
          const rawName = studentsData[0].nama_project || "";
          const cleanName = rawName.includes(" - ")
            ? rawName.split(" - ")[0]
            : rawName;
          setProjectName(cleanName);
          setJobUploadData(studentsData.map(() => ({ unggah_hasil: [] })));
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || "Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    };

    // Guard: hanya fetch jika userId valid
    if (
      token &&
      tmstProjectId &&
      date &&
      userId !== null &&
      userId !== undefined &&
      !Number.isNaN(userId)
    ) {
      fetchAllData(tmstProjectId, date);
    }
  }, [
    token,
    axiosJWT,
    ApiEndPoint,
    id_tran_project,
    date,
    userId,
    tmstProjectId,
  ]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        // Use masterProject/:projectId endpoint - this is reliable and doesn't depend on userId
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/masterProject/${project_id}`,
        );

        const projectData = res.data.data;
        if (projectData) {
          // Map the response to match the expected ApiResponse format
          // Backend now returns id_satuan and insentif directly
          const mappedProject = {
            id: projectData.id,
            nama: projectData.nama,
            kategori: projectData.kategori,
            kategoriId: projectData.kategoriId,
            insentif: projectData.insentif || {
              durasi_satuan: 0,
              besaran_insentif: 0,
            },
            namaPIC: projectData.pic,
            id_satuan: projectData.id_satuan || 1,
            inisial_project: projectData.inisial_project,
            id_tran_project: id_tran_project
              ? Number(id_tran_project)
              : projectData.id_tran_project?.[0] || 0,
            status:
              projectData.tmst_status_master_project?.status ||
              projectData.status,
          };

          setSelectedTimesheet(mappedProject);
          setIdSatuan(mappedProject.id_satuan);
          setTmstProjectId(projectData.id);
        } else {
          toast.error("Data project tidak ditemukan.");
          setLoading(false);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        console.error("fetchProject error:", err);
        toast.error(
          error.response?.data?.message || "Failed to fetch project data.",
        );
        setLoading(false);
      }
    };

    if (token && project_id) {
      fetchProject();
    }
  }, [token, axiosJWT, ApiEndPoint, id_tran_project, project_id]);

  // Fetch payment data for approve functionality
  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!id_tran_project || !date) return;
      try {
        const paymentResponse = await axiosJWT.get(
          `${ApiEndPoint}/api/payments`,
        );
        const payments = paymentResponse.data.data || [];
        const dateObj = new Date(date);
        const formattedPeriod = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, "0")}`;

        const matchedPayment = payments.find(
          (payment: any) =>
            payment.id_tmst_project ===
              (selectedTimesheet?.id || students[0]?.id_project) &&
            payment.periode === formattedPeriod,
        );

        if (matchedPayment) {
          setPaymentData(matchedPayment);
        }
      } catch (error) {
        console.error("Error fetching payment data:", error);
      }
    };

    if (token && id_tran_project && date) {
      fetchPaymentData();
    }
  }, [
    token,
    axiosJWT,
    ApiEndPoint,
    id_tran_project,
    date,
    selectedTimesheet,
    students,
  ]);

  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        for (let i = 0; i < timesheets.length; i++) {
          if (selectedTimesheet?.id_satuan === 2) {
            const tanggal = timesheets[i].tanggal.split("T")[0];
            const project = selectedTimesheet.inisial_project;

            const response = await axiosJWT.get(
              `${ApiEndPoint}/api/uploadKarya/${userId}/${project}/${tanggal}`,
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
    selectedTimesheet?.id,
    students,
    userId,
  ]);

  const handleCategoryChange = (
    index: number,
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const updatedTimesheet = [...timesheets];
    updatedTimesheet[index].id_kategori_kegiatan = Number(e.target.value);
    setTimesheets(updatedTimesheet);
  };

  const handleDescriptionChange = (
    index: number,
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const updatedTimesheet = [...timesheets];
    updatedTimesheet[index].deskripsi = e.target.value;
    setTimesheets(updatedTimesheet);
  };

  const updateTotalSesi = (
    index: number,
    updatedTimesheet: TimesheetData[],
  ) => {
    const startTime = new Date(updatedTimesheet[index].jam_mulai);
    const endTime = new Date(updatedTimesheet[index].jam_selesai);
    const diffInMinutes =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    // Use durasi_satuan from project (e.g., 50 for id_kategori=3, 60 for id_kategori=8)
    const durasiSatuan = selectedTimesheet?.insentif?.durasi_satuan || 50;
    updatedTimesheet[index].total_sesi = diffInMinutes / durasiSatuan;
    setTimesheets(updatedTimesheet);
  };

  const handleStartTimeChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheet = [...timesheets];
    updatedTimesheet[index].jam_mulai = `1970-01-01T${e.target.value}:00.000Z`;
    updateTotalSesi(index, updatedTimesheet);
  };

  const handleEndTimeChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheet = [...timesheets];
    updatedTimesheet[index].jam_selesai =
      `1970-01-01T${e.target.value}:00.000Z`;
    updateTotalSesi(index, updatedTimesheet);
  };

  const handleLinkOutputChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheet = [...timesheets];
    updatedTimesheet[index].link_output = e.target.value;
    setTimesheets(updatedTimesheet);
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
      // Gunakan fileName sebagai parameter tunggal untuk download
      const response = await axiosJWT.get(
        `${ApiEndPoint}/api/uploadKarya/download/${fileName}`,
        {
          responseType: "blob",
        },
      );

      // Buat URL untuk file dan trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName); // Nama file diatur di sini
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal mengunduh file.");
    }
  };

  const handleRemoveFile = async (fileName: string, dateIndex: number) => {
    // Tampilkan SweetAlert2 untuk konfirmasi penghapusan
    const result = await showDeleteConfirmation({
      title: "Apakah Anda yakin?",
      text: `Anda akan menghapus file ${fileName}. Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      // Regex untuk mencocokkan format project_tanggal_userId
      const filePattern = new RegExp(
        `^${selectedTimesheet?.inisial_project}_\\d{4}-\\d{2}-\\d{2}_${userId}_\\d+\\..+$`,
      );

      if (filePattern.test(fileName)) {
        // Jika nama file sesuai dengan format project_tanggal_userId, panggil API delete
        try {
          await axiosJWT.delete(
            `${ApiEndPoint}/api/uploadKarya/delete/${fileName}`,
          );

          // Update state untuk menghapus file dari daftar uploadedFiles
          setUploadedFiles((prev) => ({
            ...prev,
            [timesheets[dateIndex].tanggal]: prev[
              timesheets[dateIndex].tanggal
            ].filter((file) => file !== fileName),
          }));

          toast.success("File berhasil dihapus.");
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } };
          toast.error(err.response?.data?.message || "Gagal menghapus file.");
        }
      } else {
        // Jika file tidak mengikuti format, hapus dari jobUploadData seperti sebelumnya
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

  const handleDateClick = (e: { dateStr: string }) => {
    const clickedDate = new Date(e.dateStr);
    const newDate = e.dateStr.toString();

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

    // Add a new timesheet entry with the clicked date
    setTimesheets((prevData) => [
      ...prevData,
      {
        id: 0, // Indicates a new timesheet that hasn't been saved yet
        id_kategori_kegiatan: 0,
        tanggal: `${newDate}T00:00:00.000Z`,
        jam_mulai: "",
        jam_selesai: "",
        deskripsi: "",
        total_sesi: 0,
        id_tran_project: id_tran_project || 0,
        link_output: "",
      },
    ]);

    // Initialize file upload data for the new timesheet
    setJobUploadData((prevData) => [...prevData, { unggah_hasil: [] }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    // Check if project is karya category (id_satuan === 2 or kategoriId === 7)
    const isKaryaProject =
      selectedTimesheet?.id_satuan === 2 || selectedTimesheet?.kategoriId === 7;

    timesheets.forEach((data) => {
      if (data.id_kategori_kegiatan === 0 || data.deskripsi === "") {
        valid = false;
      }
      // Skip jam_mulai, jam_selesai, and link_output validation for karya projects (id_kategori = 7)
      if (!isKaryaProject) {
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
      if (isKaryaProject) {
        toast.error("Harap isi kategori kegiatan dan deskripsi.");
      } else {
        toast.error(
          "Harap isi semua input yang disediakan, termasuk Link Output.",
        );
      }
      return;
    }

    if (!isKaryaProject) {
      const totalDailyHours = timesheets.reduce(
        (acc, curr) => {
          const date = new Date(curr.tanggal).toDateString();
          if (!acc[date]) acc[date] = 0;
          acc[date] +=
            (new Date(curr.jam_selesai).getTime() -
              new Date(curr.jam_mulai).getTime()) /
            (1000 * 60 * 60);
          return acc;
        },
        {} as { [key: string]: number },
      );

      const totalWeeklyHours = timesheets.reduce(
        (acc, curr) => {
          const week = getWeekNumber(new Date(curr.tanggal));
          if (!acc[week]) acc[week] = 0;
          acc[week] +=
            (new Date(curr.jam_selesai).getTime() -
              new Date(curr.jam_mulai).getTime()) /
            (1000 * 60 * 60);
          return acc;
        },
        {} as { [key: number]: number },
      );

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

      for (const week in totalWeeklyHours) {
        if (totalWeeklyHours[week] > 15) {
          toast.error(
            `Total jam pada minggu ke-${week} melebihi 15 jam / 18 sesi (1 sesi = 50 menit).`,
          );
          return;
        }
      }

      for (const month in totalMonthlyHours) {
        if (totalMonthlyHours[month] > 40) {
          const monthName = bulanIndo[parseInt(month, 10)];
          toast.error(
            `Total jam pada bulan ${monthName} melebihi 40 jam / 48 sesi (1 sesi = 50 menit).`,
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
      // Upload file ketika tombol simpan diklik
      for (let i = 0; i < timesheets.length; i++) {
        if (
          selectedTimesheet?.id_satuan === 2 &&
          selectedTimesheet?.kategori !==
            "Pembuatan Design Media Audio Visual" &&
          jobUploadData[i].unggah_hasil.length > 0
        ) {
          const formData = new FormData();

          // Append file data
          for (const file of jobUploadData[i].unggah_hasil) {
            formData.append("file", file);
          }

          try {
            const response = await axiosJWT.post(
              `${ApiEndPoint}/api/uploadKarya/upload/${userId}/${selectedTimesheet.inisial_project}/${timesheets[i].tanggal}`,
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
            const err = uploadError as {
              response?: { data?: { message?: string } };
              message?: string;
            };
            toast.error(
              err.response?.data?.message ||
                err.message ||
                "Gagal mengunggah file",
            );
            return;
          }
        }
      }

      for (const timesheetId of deletedTimesheetIds) {
        await axiosJWT.delete(`${ApiEndPoint}/api/timesheet/${timesheetId}`);
      }

      // Set default values for karya category (jam tidak diperlukan untuk id_kategori = 7)
      let processedTimesheets = timesheets;
      if (isKaryaProject) {
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
          for (const _id of createResponse.data.data.createdIds) {
            await axiosJWT.post(`${ApiEndPoint}/api/timesheetHistory`, {
              id_timesheet: Number(_id),
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
          await axiosJWT.post(`${ApiEndPoint}/api/timesheetHistory`, {
            id_timesheet: Number(response.data.data.id),
            id_status: 4,
            changed_at: new Date().toISOString(),
          });
          toast.success("Data berhasil diperbarui!", {
            toastId: "update-success",
          });
        } else {
          toast.error(response.data.message || "Gagal memperbarui data.");
        }
      }

      // router.push("/user/submitpayment");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menyimpan data.");
    }
  };

  const _activeStudent = students.find(
    (student) => String(student.nim) === String(userId),
  );

  // Handle approve timesheet
  const confirmSetujui = async () => {
    const masterProjectId =
      selectedTimesheet?.id || students[0]?.id_tmst_project;

    if (!masterProjectId || !userId || !date) {
      toast.error("Data project, mahasiswa, atau tanggal tidak ditemukan.");
      return;
    }

    const result = await showConfirmation({
      title: "Konfirmasi Persetujuan",
      text: "Apakah Anda yakin ingin menyetujui timesheet mahasiswa ini?",
      icon: "question",
      confirmButtonText: "Ya, Setujui",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);

        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const formattedPeriod = `${year}-${month.toString().padStart(2, "0")}`;

        // Use per-student approval endpoint
        const response = await axiosJWT.put(
          `${ApiEndPoint}/api/masterProject/${masterProjectId}/approve-student/${userId}`,
          { period: formattedPeriod },
        );

        if (response.data?.data?.allApproved) {
          toast.success(
            "Semua mahasiswa telah disetujui. Status project menjadi Approved!",
          );
        } else {
          toast.success("Timesheet mahasiswa telah disetujui!");
        }
        router.reload();
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        console.error("Error approving timesheet:", error);
        toast.error(
          err.response?.data?.message || "Gagal menyetujui timesheet.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle revision request
  const confirmRevisi = async () => {
    const masterProjectId =
      selectedTimesheet?.id || students[0]?.id_tmst_project;

    if (!masterProjectId || !userId || !date) {
      toast.error("Data project, mahasiswa, atau tanggal tidak ditemukan.");
      return;
    }

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

    if (result.isConfirmed && result.value) {
      const dateObj = new Date(date);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();
      const formattedPeriod = `${year}-${month.toString().padStart(2, "0")}`;

      try {
        setLoading(true);

        // Use per-student revision endpoint with revisi message
        await axiosJWT.put(
          `${ApiEndPoint}/api/masterProject/${masterProjectId}/revise-student/${userId}`,
          { period: formattedPeriod, revisi: result.value },
        );

        toast.success("Status diubah menjadi Butuh Revisi!");
        router.reload();
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        console.error("Error updating status:", error);
        toast.error(err.response?.data?.message || "Gagal mengubah status.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Build breadcrumb labels - map project_id to project name
  const breadcrumbLabels: Record<string, string> = {};
  if (project_id && projectName) {
    breadcrumbLabels[String(project_id)] = projectName;
  }

  if (loading) {
    return (
      <Layout title="Time Sheet" breadcrumbLabels={breadcrumbLabels}>
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout title="Time Sheet" breadcrumbLabels={breadcrumbLabels}>
      <div className="p-3 sm:p-4 md:p-6">
        {/* Progress Indicator */}
        <div className="items-center text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
            {(projectName || "Time Sheet").toUpperCase()}
          </h1>
          <span className="text-sm sm:text-base md:text-lg">
            {formattedDate}
          </span>
        </div>
        <ProgressIndicator currentStep={1} />
        <div className="mb-6 sm:mb-7 md:mb-9"></div>
        {/* Header */}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-0">
          {/* Left Panel - Student Data */}
          <div className="w-full lg:w-1/4 p-4 sm:p-5 md:p-6 bg-[#dfebe9] rounded-lg text-gray-800">
            {students.map((student, index) => {
              const isActive = userId === Number(student.nim); // Memeriksa apakah nim cocok dengan userId
              const studentDate = date ? new Date(date) : new Date(); // Menggunakan date dari state

              const formattedDate = `${studentDate.getFullYear()}-${(
                studentDate.getMonth() + 1
              )
                .toString()
                .padStart(2, "0")}`; // Format YYYY-MM

              // AES encryption with Base64 encoding
              const encryptedProjectId = CryptoJS.AES.encrypt(
                student.id_project.toString(),
                secretKey,
              ).toString();
              const encryptedDate = CryptoJS.AES.encrypt(
                formattedDate,
                secretKey,
              ).toString();
              const encryptedUserId = CryptoJS.AES.encrypt(
                student.nim.toString(),
                secretKey,
              ).toString();
              const encryptIdSatuan = CryptoJS.AES.encrypt(
                id_satuan ? id_satuan.toString() : "1",
                secretKey,
              ).toString();

              // Encode the encrypted string to Base64 for safe URL transmission
              encodedProjectId = encodeURIComponent(encryptedProjectId);
              encodedDate = encodeURIComponent(encryptedDate);
              encodedUserId = encodeURIComponent(encryptedUserId);
              _encodedIdSatuan = encodeURIComponent(encryptIdSatuan);
              return (
                <div key={student.nim} className="mb-3 sm:mb-4">
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
                  >
                    <button
                      className={`flex items-center w-full py-2 sm:py-3 px-3 sm:px-4 md:px-5 rounded-lg shadow-md hover:bg-gray-300 transition duration-300 text-sm sm:text-base ${
                        isActive
                          ? "bg-gray-400 text-white"
                          : "bg-white text-gray-800"
                      }`}
                    >
                      <span className="text-base sm:text-lg font-bold">
                        {index + 1}
                      </span>
                      <div className="ml-3 sm:ml-4 text-left flex-1">
                        <div className="text-sm sm:text-base md:text-lg font-bold">
                          {student.nama}
                        </div>
                        <div className="text-xs sm:text-sm">{student.nim}</div>
                      </div>
                      {/* Status Chip */}
                      <span
                        className={getStatusBadgeClassName(
                          student.status || "Not Submitted",
                          "ml-2",
                        )}
                      >
                        {student.status}
                      </span>
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
          {/* Right Panel - Edit Timesheet Panel */}
          <div className="w-full lg:w-3/4 p-4 sm:p-6 md:p-8 bg-white rounded-lg shadow-lg lg:ml-4">
            <form onSubmit={handleSubmit}>
              {_activeStudent?.status === "Not Submitted" ||
              _activeStudent?.status === "not submitted" ? (
                <div className="flex items-center justify-center text-gray-500 font-medium text-lg min-h-[300px]">
                  Mahasiswa {_activeStudent.nama} belum mengisi timesheet
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="table w-full border-collapse border border-gray-200 text-xs sm:text-sm md:text-base">
                      <tbody>
                        {timesheets.map((data, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition duration-300"
                          >
                            <td className="p-3 sm:p-4 border-t border-gray-100">
                              <div className="flex flex-col">
                                <div className="flex items-center mb-3 sm:mb-4">
                                  <div className="flex items-center bg-gray-200 text-gray-700 rounded-lg px-3 sm:px-4 py-2 shadow-sm text-xs sm:text-sm md:text-base">
                                    <span>
                                      {new Date(
                                        data.tanggal,
                                      ).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveDate(data.tanggal)
                                      }
                                      className="ml-3 sm:ml-4 text-red-500 font-bold"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-3 sm:gap-4">
                                  <div className="w-full">
                                    <select
                                      name={`kategori-${index}`}
                                      className="select select-bordered w-full shadow-sm text-xs sm:text-sm md:text-base"
                                      onChange={(e) =>
                                        handleCategoryChange(index, e)
                                      }
                                      value={data.id_kategori_kegiatan}
                                    >
                                      <option value="0">
                                        --Pilih Kategori--
                                      </option>
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
                                  <div className="w-full">
                                    <textarea
                                      name={`deskripsi-${index}`}
                                      className="textarea textarea-bordered w-full shadow-sm text-xs sm:text-sm md:text-base"
                                      placeholder="Deskripsi"
                                      onChange={(e) =>
                                        handleDescriptionChange(index, e)
                                      }
                                      value={data.deskripsi}
                                    />
                                  </div>
                                </div>
                                {!(selectedTimesheet?.id_satuan === 2) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                                    <div className="w-full">
                                      <input
                                        type="time"
                                        name={`jamMulai-${index}`}
                                        className="input input-bordered w-full shadow-sm text-xs sm:text-sm md:text-base"
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
                                    <div className="w-full">
                                      <input
                                        type="time"
                                        name={`jamSelesai-${index}`}
                                        className="input input-bordered w-full shadow-sm text-xs sm:text-sm md:text-base"
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
                                    <div className="w-full md:w-1/4">
                                      <input
                                        type="text"
                                        value={data.total_sesi}
                                        disabled
                                        className="input input-bordered w-full bg-gray-200"
                                      />
                                      <span className="ml-2">Sesi</span>
                                    </div>
                                  </div>
                                )}

                                {!(selectedTimesheet?.id_satuan === 2) && (
                                  <div className="flex flex-col mt-4">
                                    <div className="w-full">
                                      <label className="block text-sm font-medium text-gray-700">
                                        Link Output
                                      </label>
                                      <input
                                        type="text"
                                        name={`linkOutput-${index}`}
                                        className="input input-bordered w-full shadow-sm text-xs sm:text-sm md:text-base"
                                        placeholder="Link Output"
                                        onChange={(e) =>
                                          handleLinkOutputChange(index, e)
                                        }
                                        value={data.link_output || ""}
                                      />
                                    </div>
                                  </div>
                                )}

                                {selectedTimesheet?.id_satuan === 2 && (
                                  <div className="flex flex-col mt-4">
                                    <div className="w-full">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Design
                                      </label>
                                      <div className="flex flex-wrap gap-3">
                                        {uploadedFiles[data.tanggal] &&
                                        uploadedFiles[data.tanggal].length > 0
                                          ? uploadedFiles[data.tanggal].map(
                                              (fileName, fileIndex) => {
                                                const isImage =
                                                  /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                                    fileName,
                                                  );
                                                const objectUrl =
                                                  objectUrls[data.tanggal]?.[
                                                    fileIndex
                                                  ] || "";
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
                                                        className="max-w-[120px] h-auto rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                                                        onClick={() =>
                                                          setPreviewImage(
                                                            objectUrl,
                                                          )
                                                        }
                                                        style={{
                                                          width: 120,
                                                          height: "auto",
                                                        }}
                                                      />
                                                    ) : (
                                                      <a
                                                        href="#"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          handleDownloadFile(
                                                            fileName,
                                                          );
                                                        }}
                                                        className="truncate text-blue-500 hover:underline text-sm"
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
                                              },
                                            )
                                          : null}
                                      </div>

                                      <div className="mt-4 relative border-dashed border-2 border-gray-300 p-4 rounded-md bg-white">
                                        <input
                                          type="file"
                                          name={`unggahHasil-${index}`}
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                          multiple
                                          accept="image/*"
                                          onChange={(e) =>
                                            handleFileChange(
                                              index,
                                              e.target.files,
                                            )
                                          }
                                        />
                                        <p className="text-center text-gray-500 text-sm">
                                          Drag and drop files, or click to
                                          select
                                        </p>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {jobUploadData[
                                          index
                                        ]?.unggah_hasil?.map(
                                          (file, fileIndex) => (
                                            <div
                                              key={fileIndex}
                                              className="flex items-center space-x-2 bg-gray-100 px-2 py-1 rounded"
                                            >
                                              <span className="truncate text-sm max-w-[150px]">
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
                                                className="text-red-500 font-bold"
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
                          <td className="p-3 sm:p-4 border-t border-gray-100">
                            <div
                              className="bg-gray-300 px-3 py-2 w-full sm:w-48 rounded-full text-center text-black shadow-sm cursor-pointer hover:bg-gray-400 transition duration-300 text-xs sm:text-sm md:text-base"
                              onClick={() => setToggleState(!toggleState)}
                            >
                              Tambah Tanggal
                            </div>
                            {toggleState && (
                              <div
                                id="calender"
                                className="mt-6 sm:mt-8 p-3 sm:p-4 bg-white rounded-xl shadow-md"
                              >
                                <FullCalendar
                                  plugins={[dayGridPlugin, interactionPlugin]}
                                  initialView="dayGridMonth"
                                  fixedWeekCount={false}
                                  weekends={true}
                                  eventContent={(e) => <>{e.timeText}</>}
                                  height={320}
                                  dateClick={handleDateClick}
                                />
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-6 sm:mt-8 gap-3 sm:gap-0">
                    <Link href="/user/timesheet" className="order-2 sm:order-1">
                      <button className="bg-red-500 hover:bg-red-600 text-white w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-md transition duration-300 text-xs sm:text-sm md:text-base">
                        Kembali
                      </button>
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
                      {(() => {
                        const activeStudent = students.find(
                          (s) => Number(s.nim) === userId,
                        );
                        const studentStatus =
                          activeStudent?.status?.toLowerCase() || "";
                        const isCompleted =
                          studentStatus === "completed" ||
                          paymentData?.id_status === 2 ||
                          paymentData?.status
                            ?.toLowerCase()
                            .includes("complete");
                        const isApproved = studentStatus === "approved";
                        const isReviewed = activeStudent?.isReview === true;

                        // 1. Completed → only "Selanjutnya"
                        if (isCompleted) {
                          return null;
                        }

                        const isPaymentApproved =
                          paymentData?.id_status === 3 ||
                          paymentData?.status?.toLowerCase() === "approved";
                        const projectStatus =
                          selectedTimesheet?.status?.toLowerCase() || "";

                        // payment Approved & Waiting Timesheet Approval → only "Selanjutnya"
                        if (
                          isPaymentApproved &&
                          projectStatus === "waiting timesheet approval"
                        ) {
                          return null;
                        }

                        // payment Approved & Need Revision → only "Revisi" (and "Selanjutnya")
                        if (
                          isPaymentApproved &&
                          projectStatus === "need revision"
                        ) {
                          return (
                            <button
                              type="button"
                              onClick={confirmRevisi}
                              className="bg-orange-500 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg hover:bg-orange-600 transition duration-300 text-xs sm:text-sm md:text-base"
                            >
                              Revisi
                            </button>
                          );
                        }

                        // 2a. is_reviewed=true & Approved → only "Revisi"
                        if (isReviewed && isApproved) {
                          return (
                            <button
                              type="button"
                              onClick={confirmRevisi}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg transition duration-300 text-xs sm:text-sm md:text-base"
                            >
                              Revisi
                            </button>
                          );
                        }

                        // 2b. is_reviewed=true & not Approved → "Revisi", "Setujui", "Simpan"
                        if (isReviewed) {
                          return (
                            <>
                              <button
                                type="button"
                                onClick={confirmRevisi}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg transition duration-300 text-xs sm:text-sm md:text-base"
                              >
                                Revisi
                              </button>
                              <button
                                type="button"
                                onClick={confirmSetujui}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg transition duration-300 text-xs sm:text-sm md:text-base"
                              >
                                Setujui
                              </button>
                              <button
                                type="submit"
                                className="bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg hover:bg-blue-700 transition duration-300 text-xs sm:text-sm md:text-base"
                              >
                                Simpan
                              </button>
                            </>
                          );
                        }

                        // 3. Approved & is_reviewed=false → only "Revisi"
                        if (isApproved) {
                          return (
                            <button
                              type="button"
                              onClick={confirmRevisi}
                              className="bg-orange-500 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg hover:bg-orange-600 transition duration-300 text-xs sm:text-sm md:text-base"
                            >
                              Revisi
                            </button>
                          );
                        }

                        // 4. Submitted / On Revision / Revised → only "Simpan"
                        return (
                          <button
                            type="submit"
                            className="bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg hover:bg-blue-700 transition duration-300 text-xs sm:text-sm md:text-base"
                          >
                            Simpan
                          </button>
                        );
                      })()}
                      <Link
                        href={{
                          pathname: `/user/timesheet/lampiran/${project_id}`,
                          query: {
                            id_tran_project: router.query.id_tran_project,
                            date: router.query.date,
                            userId: router.query.userId,
                          },
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-success text-white w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg hover:bg-green-700 transition duration-300 text-xs sm:text-sm md:text-base"
                        >
                          Selanjutnya
                        </button>
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </form>
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
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{ maxWidth: "100%", maxHeight: "85vh" }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(ViewSubmitPayment);
