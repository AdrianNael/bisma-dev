import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { useRole } from "@/src/context/RoleContext";
import LampiranTimesheet from "@/src/components/AdminProject/LampiranTimesheet";
import {
  showApprovalConfirmation,
  showSuccess,
  showError,
  showInfo,
  showRejectionPrompt,
} from "@/src/utils/swalHelper";

interface DecodedToken {
  exp: number;
}

type Props = {
  id: any;
  role: string;
};

interface ProjectData {
  id: number;
  nama: string;
  kategori: string;
  pic: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_mulai_project?: string;
  tanggal_selesai_project?: string;
  anggota: string[];
  durasi: number[];
  durasi_default?: number;
  id_anggota: string[];
  totalEstimasi: number;
  totalAktual?: number;
  insentif_aktual?: number[];
  monthly_breakdown?: Array<{
    periode: string;
    durasi: number[];
    sesi_aktual: number[];
    insentif_aktual: number[];
    total: number;
  }>;
  status: string;
  id_tran_project: number[];
  remark_project?: string;
  countMember?: number;
  isKarya?: boolean;
  id_satuan?: number;
  insentif?: {
    durasi_satuan: number;
    besaran_insentif: number;
  };
  tmst_kategori_magang?: {
    tran_insentif?: {
      besaran_insentif: number;
      durasi_satuan: number;
      id_satuan?: number;
    };
  };
}

interface PaymentData {
  id: number;
  id_tmst_project: number;
  periode: string;
  total_tagihan: number;
  id_status: number;
}

const TimesheetApprovalDetail = ({ id, role: _role }: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const { projectId } = router.query;

  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setId } = useRole();

  useEffect(() => {
    setId(id);
  }, [id, setId]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${APIEndpoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (error: any) {
        router.push("/login");
      }
    };
    refreshToken();
  }, [APIEndpoint, router]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${APIEndpoint}/token`, {
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
  }, [token, expire, APIEndpoint]);

  // Fetch project data
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId || !token) return;

      setLoading(true);
      try {
        // Get project details
        const projectResponse = await axiosJWT.get(
          `${APIEndpoint}/api/masterProject/${projectId}`,
        );
        const projectData = projectResponse.data.data;
        setProjectData(projectData);

        // Get payment data for this project
        const paymentResponse = await axiosJWT.get(
          `${APIEndpoint}/api/payments`,
        );
        const payments = paymentResponse.data.data || [];

        // First try to find with status 1 (WAITING_APPROVAL)
        let projectPayment = payments.find(
          (p: any) =>
            p.id_tmst_project === Number(projectId) && p.id_status === 1,
        );

        // If not found, try to find any payment for this project
        if (!projectPayment) {
          projectPayment = payments.find(
            (p: any) => p.id_tmst_project === Number(projectId),
          );
        }

        if (projectPayment) {
          setPaymentData(projectPayment);
        } else {
          // Create a fallback payment data based on project data
          const fallbackPayment = {
            id: 0,
            id_tmst_project: Number(projectId),
            periode: getCurrentPeriode(),
            total_tagihan: 0,
            id_status: 1,
          };
          setPaymentData(fallbackPayment);
        }
      } catch (error: any) {
        console.error("Error fetching project data:", error);
        const errorMessage =
          error?.response?.data?.message || "Gagal memuat data project";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (token && router.isReady) {
      fetchProjectData();
    }
  }, [token, projectId, router.isReady, APIEndpoint, axiosJWT]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Helper function to get current period in YYYY-MM format
  const getCurrentPeriode = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  };

  const handleApprove = async () => {
    if (!projectId) {
      toast.error("ID project tidak ditemukan");
      return;
    }

    if (isSubmitting) {
      return;
    }

    const result = await showApprovalConfirmation({
      title: "Setujui Timesheet?",
      text: "Timesheet akan disetujui dan status pembayaran akan diubah.",
      confirmButtonText: "Ya, Setujui",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      setIsSubmitting(true);
      try {
        // Approve timesheets (Backend handles everything: Payment Status, Timesheet Status, Project Status)
        const response = await axiosJWT.put(
          `${APIEndpoint}/api/masterProject/${projectId}/approve-timesheets`,
        );

        const responseData = response.data?.data;
        const isFullyCompleted = responseData?.isFullyCompleted;
        const completedPeriods = responseData?.completedPeriods;
        const totalPeriods = responseData?.totalPeriods;

        if (isFullyCompleted) {
          await showSuccess({
            title: "Project Completed!",
            text: `Semua periode (${completedPeriods}/${totalPeriods}) telah disetujui. Project selesai.`,
          });
        } else {
          await showSuccess({
            title: "Timesheet Disetujui!",
            text: `Periode ${completedPeriods} dari ${totalPeriods} telah disetujui. Menunggu periode berikutnya.`,
          });
        }
        router.push("/admin/project/approval");
      } catch (error: any) {
        console.error("Error approving timesheet:", error);
        const errorMessage =
          error?.response?.data?.message ||
          "Terjadi kesalahan saat menyetujui timesheet.";
        await showError({
          title: "Gagal!",
          text: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleReject = async () => {
    if (!projectId) {
      toast.error("ID project tidak ditemukan");
      return;
    }

    if (isSubmitting) {
      return;
    }

    // Pre-fill with existing remark_project if available (for re-revision cases)
    const existingRemark =
      projectData?.remark_project && projectData.remark_project !== "Completed"
        ? projectData.remark_project
        : "";

    const { value: reason } = await showRejectionPrompt({
      title: "Revisi Timesheet",
      inputLabel: "Alasan Revisi",
      inputPlaceholder: "Masukkan alasan revisi...",
      inputValue: existingRemark,
      confirmButtonText: "Revisi",
      cancelButtonText: "Batal",
    });

    if (reason) {
      setIsSubmitting(true);
      try {
        // Call project rejection endpoint (status 7 - NEED_REVISION)
        await axiosJWT.post(
          `${APIEndpoint}/api/approvalAdmin/reject/${projectId}`,
          { remarkProject: reason },
        );

        await showInfo({
          title: "Status Diubah",
          text: "Project telah diubah statusnya menjadi Butuh Revisi.",
        });
        router.push("/admin/project/approval");
      } catch (error: any) {
        console.error("Error rejecting project:", error);
        const errorMessage =
          error?.response?.data?.message ||
          "Terjadi kesalahan saat mengubah status project.";
        await showError({
          title: "Gagal!",
          text: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!hydrated) {
    return null;
  }

  const formatTanggal = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
        year: "numeric",
      };

      let date: Date;
      if (dateStr.includes("/")) {
        const [day, month, year] = dateStr.split("/");
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("id-ID", options);
    } catch {
      return dateStr;
    }
  };

  const formatPeriode = (periode: string) => {
    if (!periode) return "-";
    try {
      const [year, month] = periode.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return periode;
    }
  };

  // Calculate month-specific date range based on payment periode
  const calculateMonthDateRange = () => {
    if (!projectData || !paymentData?.periode) {
      return {
        start: projectData?.tanggal_mulai || null,
        end: projectData?.tanggal_selesai || null,
      };
    }

    const rawStart =
      projectData.tanggal_mulai_project || projectData.tanggal_mulai;
    const rawEnd =
      projectData.tanggal_selesai_project || projectData.tanggal_selesai;

    const parseDate = (str: string) => {
      if (!str) return null;
      if (str.includes("/")) {
        const [d, m, y] = str.split("/");
        return new Date(`${y}-${m}-${d}`);
      }
      return new Date(str);
    };

    const projectStart = parseDate(rawStart);
    const projectEnd = parseDate(rawEnd);

    if (
      !projectStart ||
      !projectEnd ||
      isNaN(projectStart.getTime()) ||
      isNaN(projectEnd.getTime())
    ) {
      return { start: rawStart, end: rawEnd };
    }

    // Parse payment periode (e.g., "2026-03")
    const [periodYear, periodMonth] = paymentData.periode
      .split("-")
      .map(Number);

    // Calculate month boundaries
    const monthStart = new Date(periodYear, periodMonth - 1, 1); // First day of month
    const monthEnd = new Date(periodYear, periodMonth, 0); // Last day of month

    // Intersect with project dates
    const rangeStart = monthStart > projectStart ? monthStart : projectStart;
    const rangeEnd = monthEnd < projectEnd ? monthEnd : projectEnd;

    // Format as dd/MM/yyyy
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    return {
      start: formatDate(rangeStart),
      end: formatDate(rangeEnd),
    };
  };

  const monthDateRange = calculateMonthDateRange();

  // Calculate monthly estimation based on project date range and current period
  const calculateMonthlyEstimation = () => {
    if (!projectData || !paymentData?.periode) {
      return projectData?.totalEstimasi || 0;
    }

    // Use original project dates (not timesheet-overridden dates)
    const rawStart =
      projectData.tanggal_mulai_project || projectData.tanggal_mulai;
    const rawEnd =
      projectData.tanggal_selesai_project || projectData.tanggal_selesai;

    const parseDate = (str: string) => {
      if (!str) return null;
      if (str.includes("/")) {
        const [d, m, y] = str.split("/");
        return new Date(`${y}-${m}-${d}`);
      }
      return new Date(str);
    };

    const startDate = parseDate(rawStart);
    const endDate = parseDate(rawEnd);

    if (
      !startDate ||
      !endDate ||
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      return projectData?.totalEstimasi || 0;
    }

    // Calculate number of months
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const totalMonths =
      (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

    if (totalMonths <= 1) {
      return projectData?.totalEstimasi || 0;
    }

    // Get current period month index (0-based from project start)
    const [periodYear, periodMonth] = paymentData.periode
      .split("-")
      .map(Number);
    const periodIndex =
      (periodYear - startYear) * 12 + (periodMonth - 1 - startMonth);

    if (periodIndex < 0 || periodIndex >= totalMonths) {
      return projectData?.totalEstimasi || 0;
    }

    // Get insentif config (use flat fields from API, fallback to nested)
    const besaranInsentif =
      projectData.insentif?.besaran_insentif ||
      projectData.tmst_kategori_magang?.tran_insentif?.besaran_insentif ||
      0;
    const durasiSatuan =
      projectData.insentif?.durasi_satuan ||
      projectData.tmst_kategori_magang?.tran_insentif?.durasi_satuan ||
      50;
    const isKarya =
      typeof projectData.isKarya === "boolean"
        ? projectData.isKarya
        : projectData.id_satuan === 2 ||
          projectData.tmst_kategori_magang?.tran_insentif?.id_satuan === 2;

    // Use durasi_default (planned hours PER STUDENT) for estimation
    const durasiPerStudent = projectData.durasi_default || 0;
    const jumlahMahasiswa =
      projectData.countMember || projectData.anggota?.length || 1;

    // Distribute durasi_default across months with rounding logic
    // e.g., 21 hours / 2 months = 11, 10 (not 10.5, 10.5)
    const baseHours = Math.floor(durasiPerStudent / totalMonths);
    const remainder = durasiPerStudent % totalMonths;

    // First 'remainder' months get baseHours + 1, rest get baseHours
    const monthlyDurasiPerStudent =
      periodIndex < remainder ? baseHours + 1 : baseHours;

    // Calculate insentif for this month
    let monthlyEstimasi: number;
    if (isKarya) {
      monthlyEstimasi =
        monthlyDurasiPerStudent * besaranInsentif * jumlahMahasiswa;
    } else {
      // Convert hours to sessions, then multiply by rate and student count
      const sesiPerStudent =
        (monthlyDurasiPerStudent * 60) / Math.max(1, durasiSatuan);
      monthlyEstimasi =
        Math.round(sesiPerStudent * besaranInsentif) * jumlahMahasiswa;
    }

    return monthlyEstimasi;
  };

  const monthlyEstimation = calculateMonthlyEstimation();

  // Build breadcrumb labels
  const breadcrumbLabels: Record<string, string> = {};
  if (projectId && projectData?.nama) {
    breadcrumbLabels[projectId as string] = projectData.nama;
  }

  return (
    <Layout
      title="Detail Timesheet Approval"
      breadcrumbLabels={breadcrumbLabels}
    >
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full max-w-5xl">
          {/* Back link */}
          <div>
            <Link
              href="/admin/project/approval"
              className="btn bg-transparent text-gray-500 hover:text-gray-700 border-none hover:bg-transparent"
            >
              ← Kembali ke Approval
            </Link>
          </div>

          {loading ? (
            <p className="text-center text-blue-600 font-bold">Loading...</p>
          ) : !projectData ? (
            <p className="text-center text-red-600 font-bold">
              Data project tidak ditemukan
            </p>
          ) : (
            <>
              {/* Project Details Card - Similar to admin/project/view */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6 border-b pb-2">
                  RINCIAN PROJECT
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold">Nama Project</p>
                    <p>{projectData.nama}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Kategori</p>
                    <p>{projectData.kategori}</p>
                  </div>
                  <div>
                    <p className="font-semibold">PIC</p>
                    <p>{projectData.pic}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Tanggal</p>
                    <p>
                      {formatTanggal(
                        monthDateRange.start || projectData.tanggal_mulai,
                      )}{" "}
                      -{" "}
                      {formatTanggal(
                        monthDateRange.end || projectData.tanggal_selesai,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Anggota</p>
                    {projectData.anggota.map((anggota, index) => {
                      const isKarya =
                        projectData.tmst_kategori_magang?.tran_insentif
                          ?.id_satuan === 2;

                      // Find monthly breakdown for current period if payment data exists
                      const monthlyData =
                        paymentData?.periode && projectData.monthly_breakdown
                          ? projectData.monthly_breakdown.find(
                              (mb) => mb.periode === paymentData.periode,
                            )
                          : null;

                      // Use monthly duration if available, otherwise fallback to total duration
                      // Note: monthlyData.durasi[index] should exist if monthlyData exists
                      const durationDisplay = monthlyData
                        ? (monthlyData.durasi[index] ?? 0)
                        : projectData.durasi[index];

                      return (
                        <p key={index}>
                          {index + 1}. {anggota} ({durationDisplay}{" "}
                          {isKarya ? "Karya" : "Jam"})
                        </p>
                      );
                    })}
                  </div>
                  <div>
                    <p className="font-semibold">Total Estimasi Insentif</p>
                    <p>
                      Rp {monthlyEstimation?.toLocaleString("id-ID") || 0},-
                    </p>
                    <p className="font-semibold mt-3">Total Aktual Insentif</p>
                    <p>
                      Rp{" "}
                      {(paymentData?.periode &&
                      Array.isArray(projectData.monthly_breakdown)
                        ? (projectData.monthly_breakdown.find(
                            (mb) => mb.periode === paymentData.periode,
                          )?.total ??
                          paymentData?.total_tagihan ??
                          0)
                        : (paymentData?.total_tagihan ?? 0)
                      ).toLocaleString("id-ID")}
                      ,-
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Status Project</p>
                    <p>{projectData.status}</p>
                  </div>
                  {paymentData && (
                    <div>
                      <p className="font-semibold">Periode Pengajuan</p>
                      <p>{formatPeriode(paymentData.periode)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Use LampiranTimesheet Component */}
              {projectId && projectData && (
                <LampiranTimesheet
                  projectId={projectId as string}
                  projectData={projectData}
                  axiosJWT={axiosJWT}
                  APIEndpoint={APIEndpoint || ""}
                />
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Link
                  href="/admin/project/approval"
                  className="btn bg-gray-500 hover:bg-gray-600 text-white px-6"
                >
                  Kembali
                </Link>
                <div className="flex gap-4">
                  <button
                    onClick={handleReject}
                    className="btn bg-red-500 hover:bg-red-600 text-white px-6"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processing..." : "Butuh Revisi"}
                  </button>
                  <button
                    onClick={handleApprove}
                    className="btn bg-green-500 hover:bg-green-600 text-white px-6"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processing..." : "Approve"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(TimesheetApprovalDetail);
