import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/src/components/Layout";
import PageLoader from "@/src/components/PageLoader";
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
import {
  showDeleteConfirmation,
  showSuccess,
  showInfo,
} from "@/src/utils/swalHelper";

type Props = {
  user: any;
  role: string;
  id: string;
};

interface ApiResponse {
  id: number;
  nama: string;
  kategori: string;
  kategoriId: number;
  id_satuan: number;
  inisial_project: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  status: string;
  insentif: {
    durasi_satuan: number;
    besaran_insentif: number;
  };
  namaPIC: string;
  durasi_per_mahasiswa: number;
  pendaftaran_selesai: string | null;
}

interface DecodedToken {
  exp: number;
}

type TimesheetData = {
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

function renderEventContent(eventInfo: any) {
  return (
    <>
      <b>{eventInfo.timeText}</b>
      <i>{eventInfo.event.title}</i>
    </>
  );
}

const Add = ({ user: _user, role: _role, id }: Props) => {
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const events = [{ title: "m", start: new Date() }];
  const [toggleState, setToggleState] = useState(false);
  const [selectedIdTimesheet, setSelectedIdTimesheet] = useState<number>(0);
  const [selectedTimesheet, setSelectedTimesheet] = useState<ApiResponse>();
  const [timesheet, setTimesheet] = useState<ApiResponse[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetData[]>([]);
  const [jobUploadData, setJobUploadData] = useState<JobUploadData[]>([]);
  const [tranProjectId, setTranProjectId] = useState<number | null>(null);
  const { setId } = useRole();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // State untuk pengecekan signature
  const [signatureChecking, setSignatureChecking] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);

  // State for karya validation
  const [karyaInfo, setKaryaInfo] = useState<{
    isKarya: boolean;
    maxKarya: number;
    existingCount: number;
    remainingSlots: number;
  } | null>(null);
  const isPerKaryaLimited = selectedTimesheet?.kategoriId === 7;

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
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Error refreshing token");
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
    const fetchProject = async () => {
      try {
        setLoading(true);
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/masterProject/timesheet/${id}`,
        );
        setTimesheet(res.data.data);
        console.log("Timesheet data:", res.data.data);
      } catch (err: any) {
        toast.error(
          err.response?.data?.message || "Failed to fetch project data.",
        );
        console.log("Error fetching timesheet:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProject();
    }
  }, [token, axiosJWT, ApiEndPoint, id]);

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
    const fetchActivities = async () => {
      try {
        const res = await axiosJWT.get(`${ApiEndPoint}/api/activity`);
        setActivities(res.data.data);
      } catch (err: any) {
        toast.error(
          err.response?.data?.message || "Failed to fetch activities.",
        );
        console.log(err);
        setActivities([]);
      }
    };

    if (token) {
      fetchActivities();
    }
  }, [token, axiosJWT, ApiEndPoint]);

  useEffect(() => {
    const fetchTranProjectId = async (projectId: number, userId: string) => {
      try {
        console.log(projectId, userId);
        const res = await axiosJWT.get(`${ApiEndPoint}/api/project/timesheet`, {
          params: { projectId, userId },
        });
        setTranProjectId(res.data.data.id);

        // Fetch karya info after getting tranProjectId
        const tranProjId = res.data.data.id;
        if (tranProjId) {
          try {
            const karyaRes = await axiosJWT.get(
              `${ApiEndPoint}/api/timesheet/karya-info/${tranProjId}`,
            );
            setKaryaInfo(karyaRes.data.data);
          } catch (karyaErr: any) {
            console.error("Failed to fetch karya info:", karyaErr);
            setKaryaInfo(null);
          }
        }
      } catch (err: any) {
        toast.error(
          err.response?.data?.message ||
            "Failed to fetch transaction project ID.",
        );
        console.log(err);
      }
    };

    if (selectedIdTimesheet) {
      const selectedTimesheetData = timesheet.find(
        (item) => item.id === selectedIdTimesheet,
      );
      console.log(selectedTimesheetData);
      setSelectedTimesheet(selectedTimesheetData);
      fetchTranProjectId(selectedIdTimesheet, id);
    }
  }, [selectedIdTimesheet, timesheet, id, ApiEndPoint, axiosJWT]);

  const handleChange = (e: any) => {
    setSelectedIdTimesheet(Number(e.target.value));
  };

  const handleDateClick = (e: any) => {
    const clickedDate = new Date(e.dateStr);

    // Cek jika tanggal yang dipilih sudah ada di timesheet
    const dateExists = timesheetData.some((data) => {
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

      // Validasi batas karya sebelum menambah entry baru
      const _isKaryaCategory =
        selectedTimesheet.id_satuan === 2 ||
        /pembuatan\s+design\s+media/i.test(selectedTimesheet.kategori || "");
      const isPerKaryaLimited = selectedTimesheet.kategoriId === 7;

      if (
        isPerKaryaLimited &&
        karyaInfo &&
        karyaInfo.isKarya &&
        karyaInfo.maxKarya > 0
      ) {
        const currentEntries = timesheetData.length;
        if (currentEntries >= karyaInfo.remainingSlots) {
          toast.error(
            `Tidak dapat menambah karya lagi. Batas maksimal: ${karyaInfo.maxKarya} karya, sudah tercatat: ${karyaInfo.existingCount} karya, tersisa: ${karyaInfo.remainingSlots} slot.`,
          );
          return;
        }
      }
    }

    // Validasi: bulan dan tahun harus sama dengan data timesheet yang sudah ada
    if (timesheetData.length > 0) {
      const existingDate = new Date(timesheetData[0].tanggal);
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
    setTimesheetData((prevData) => [
      ...prevData,
      {
        id_kategori_kegiatan: 0,
        id_tran_project: tranProjectId || 0,
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

  const handleCategoryChange = (index: number, e: any) => {
    const updatedTimesheetData = [...timesheetData];
    updatedTimesheetData[index].id_kategori_kegiatan = Number(e.target.value);
    setTimesheetData(updatedTimesheetData);
  };

  const handleDescriptionChange = (index: number, e: any) => {
    const updatedTimesheetData = [...timesheetData];
    updatedTimesheetData[index].deskripsi = e.target.value;
    setTimesheetData(updatedTimesheetData);
  };

  const handleStartTimeChange = (index: number, e: any) => {
    const timeValue = e.target.value;
    const updatedTimesheetData = [...timesheetData];
    updatedTimesheetData[index].jam_mulai = `1970-01-01T${timeValue}:00.000Z`;
    updateTotalSesi(index, updatedTimesheetData);
  };

  const handleEndTimeChange = (index: number, e: any) => {
    const timeValue = e.target.value;
    const updatedTimesheetData = [...timesheetData];
    updatedTimesheetData[index].jam_selesai = `1970-01-01T${timeValue}:00.000Z`;
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
    setTimesheetData(updatedTimesheetData);
  };

  const handleFileChange = (dateIndex: number, newFiles: FileList | null) => {
    if (newFiles) {
      setJobUploadData((prevData) => {
        const updatedJobUploadData = [...prevData];
        const existingFiles =
          updatedJobUploadData[dateIndex]?.unggah_hasil || [];
        const fileArray = Array.from(newFiles);

        const combinedFiles = [...existingFiles, ...fileArray];

        const uniqueFiles = combinedFiles.filter(
          (file, index, self) =>
            index === self.findIndex((f) => f.name === file.name),
        );

        updatedJobUploadData[dateIndex] = {
          unggah_hasil: uniqueFiles,
        };

        return updatedJobUploadData;
      });
    }
  };

  const handleRemoveFile = async (dateIndex: number, fileIndex: number) => {
    const result = await showDeleteConfirmation({
      title: "Apakah Anda yakin?",
      text: "Anda akan menghapus file ini. Tindakan ini tidak dapat dibatalkan.",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      setJobUploadData((prevData) => {
        const updatedJobUploadData = [...prevData];
        updatedJobUploadData[dateIndex].unggah_hasil = updatedJobUploadData[
          dateIndex
        ].unggah_hasil.filter((_, i) => i !== fileIndex);
        return updatedJobUploadData;
      });

      await showSuccess({ title: "Dihapus!", text: "File berhasil dihapus." });
    } else if (result.dismiss) {
      await showInfo({
        title: "Dibatalkan!",
        text: "Penghapusan file dibatalkan.",
      });
    }
  };

  const handleRemoveDate = (date: string) => {
    const dateIndex = timesheetData.findIndex((item) => item.tanggal === date);
    setTimesheetData((prevData) => prevData.filter((_, i) => i !== dateIndex));
    setJobUploadData((prevData) => prevData.filter((_, i) => i !== dateIndex));
  };

  const handleLinkOutputChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updatedTimesheetData = [...timesheetData];
    updatedTimesheetData[index].link_output = e.target.value;
    setTimesheetData(updatedTimesheetData);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedTimesheet) {
      toast.error("Pilih project terlebih dahulu.");
      return;
    }

    // Cek apakah kategori karya yang tidak perlu jam/link (hanya kategoriId 7)
    const isKaryaCategory = selectedTimesheet.kategoriId === 7;

    let valid = true;

    timesheetData.forEach((data) => {
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

    // Validasi total sesi tidak melebihi durasi per mahasiswa (hanya untuk berbasis waktu)
    if (selectedTimesheet.id_satuan !== 2 && !isKaryaCategory) {
      const totalSesi = timesheetData.reduce(
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

    // Validasi jumlah karya untuk project berbasis karya (hanya kategoriId === 7)
    const isPerKaryaLimited = selectedTimesheet.kategoriId === 7;
    if (
      isPerKaryaLimited &&
      karyaInfo &&
      karyaInfo.isKarya &&
      karyaInfo.maxKarya > 0
    ) {
      const newKaryaCount = timesheetData.length;
      if (newKaryaCount > karyaInfo.remainingSlots) {
        toast.error(
          `Jumlah karya melebihi batas maksimal. Maksimal: ${karyaInfo.maxKarya} karya, sudah tercatat: ${karyaInfo.existingCount} karya, tersisa: ${karyaInfo.remainingSlots} slot. Anda mencoba menambah: ${newKaryaCount} karya.`,
        );
        return;
      }
    }

    // Validasi jam harian/mingguan/bulanan
    // Skip untuk kategoriId === 7 (design media), tapi terapkan untuk kategoriId === 8 (karya video) dan lainnya
    const shouldValidateHours = selectedTimesheet.kategoriId !== 7;

    if (shouldValidateHours) {
      const totalDailyHours = timesheetData.reduce(
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

      const getWeekOfMonth = (date: Date) => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const dayOfWeek = (firstDay.getDay() + 6) % 7;
        const offsetDate = date.getDate() + dayOfWeek - 1;
        return Math.floor(offsetDate / 7) + 1;
      };
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
      timesheetData.forEach((curr) => {
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

      const totalMonthlyHours = timesheetData.reduce(
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

    try {
      // Set default values for karya category (jam tidak diperlukan)
      let dataToSubmit = timesheetData;
      if (isKaryaCategory) {
        dataToSubmit = timesheetData.map((data) => ({
          ...data,
          jam_mulai: data.jam_mulai || "1970-01-01T00:00:00.000Z",
          jam_selesai: data.jam_selesai || "1970-01-01T00:01:00.000Z",
          total_sesi: data.total_sesi || 0,
          link_output: data.link_output || "-",
        }));
      }

      // Simpan timesheet terlebih dahulu
      const timesheetResponse = await axiosJWT.post(
        `${ApiEndPoint}/api/timesheet`,
        dataToSubmit,
      );

      if (timesheetResponse.status === 200) {
        // Timesheet berhasil disimpan, sekarang upload file jika ada
        for (let i = 0; i < timesheetData.length; i++) {
          if (
            selectedTimesheet?.id_satuan === 2 &&
            selectedTimesheet?.kategori !==
              "Pembuatan Design Media Audio Visual" &&
            jobUploadData[i] &&
            jobUploadData[i].unggah_hasil.length > 0
          ) {
            const formData = new FormData();

            for (const file of jobUploadData[i].unggah_hasil) {
              formData.append("file", file);
            }

            try {
              const response = await axiosJWT.post(
                `${ApiEndPoint}/api/uploadKarya/upload/${id}/${selectedTimesheet.inisial_project}/${timesheetData[i].tanggal}`,
                formData,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                  },
                },
              );

              if (response.status !== 200) {
                toast.error(`Gagal mengunggah file`);
                // Continue anyway since timesheet is saved
              } else {
                toast.success(`Berhasil mengunggah file`);
              }
            } catch (uploadError: any) {
              console.error("Error uploading file:", uploadError);
              toast.error(`Gagal mengunggah file: ${uploadError.message}`);
              // Continue anyway since timesheet is saved
            }
          }
        }

        // Create history entries
        for (const data of timesheetResponse.data.data.createdIds) {
          await axiosJWT.post(`${ApiEndPoint}/api/timesheetHistory`, {
            id_timesheet: Number(data),
            id_status: 4,
            changed_at: new Date().toISOString(),
          });
        }

        toast.success("Data berhasil disimpan!");
        router.push("/mahasiswa/timesheet");
      } else {
        toast.error("Gagal menambahkan data.");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan data.");
      console.error(error);
    }
  };

  if (signatureChecking || !hasSignature) {
    return (
      <Layout title="Timesheet">
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-center text-blue-600 font-bold">
            Memeriksa data tanda tangan...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Timesheet">
      <div className="p-6 pb-8 mb-2 rounded-lg">
        <div className="my-6">
          <div className="mb-4 px-4 sm:px-16">
            <label className="text-xl font-semibold">Timesheet</label>
          </div>
          <div className="w-full px-0 sm:px-56">
            {loading ? (
              <PageLoader />
            ) : timesheet && timesheet.length > 0 ? (
              <form
                method="POST"
                onSubmit={handleSubmit}
                encType="multipart/form-data"
                noValidate
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
                              className={`mb-3 p-3 rounded-lg ${karyaInfo.remainingSlots > 0 ? "bg-blue-100 border border-blue-300" : "bg-red-100 border border-red-300"}`}
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
                                Sudah tercatat:{" "}
                                <span className="font-bold">
                                  {karyaInfo.existingCount}
                                </span>{" "}
                                karya
                              </p>
                              <p
                                className={`text-xs sm:text-sm ${karyaInfo.remainingSlots > 0 ? "text-green-700" : "text-red-700"}`}
                              >
                                Sisa slot:{" "}
                                <span className="font-bold">
                                  {karyaInfo.remainingSlots}
                                </span>{" "}
                                karya
                              </p>
                              {karyaInfo.remainingSlots === 0 && (
                                <p className="text-xs sm:text-sm text-red-700 font-bold mt-1">
                                  ⚠️ Tidak dapat menambah karya lagi
                                </p>
                              )}
                            </div>
                          )}
                      </td>
                    </tr>
                    {timesheetData.map((data, index) => (
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

                            {/* Conditional fields for id_satuan === 2 */}
                            {selectedTimesheet?.id_satuan === 2 &&
                              selectedTimesheet?.kategori !==
                                "Pembuatan Design Media Audio Visual" && (
                                <div className="flex flex-col mt-2 sm:mt-4">
                                  <div className="w-full sm:w-1/2">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700">
                                      Unggah Hasil
                                    </label>
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
                                                  index,
                                                  fileIndex,
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
                                    <span className="text-red-500 text-xs"></span>
                                  )}
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
                              events={events}
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
                                    // Start from the day after registration end
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
                          {timesheetData.length > 0 && (
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
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-8">
                <div className="text-center">
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Tidak Ada Time Sheet yang Harus Dibuat
                  </h3>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(Add);
