import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/src/components/Layout";
import Link from "next/link";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import LampiranTimesheet from "@/src/components/AdminProject/LampiranTimesheet";
import { getStatusBadgeClassName } from "@/src/constants/badge";

interface ProjectData {
  // Data dari masterProject API
  nama: string;
  kategori: string;
  pic: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  anggota: string[];
  durasi: number[];
  id_anggota: string[];
  totalEstimasi: number;
  totalAktual?: number;
  status: string;
  remark_project?: string;
  durasi_default?: number;
  kuota?: number;
  tmst_kategori_magang?: {
    tran_insentif?: {
      besaran_insentif: number;
      durasi_satuan: number;
      id_satuan?: number;
    };
  };
}

interface DecodedToken {
  exp: number;
}

interface HistoryRequest {
  id_project: string;
  id_status: number;
  changed_at: string;
}

interface RejectRequest {
  remarkProject: string;
}

interface PaymentData {
  id: number;
  id_tmst_project: number;
  periode: string;
  total_tagihan: number;
  id_status: number;
}

const ProjectView: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [_paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;

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
        if (error.response) {
          router.push("/login");
        }
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

  useEffect(() => {
    const fetchProjectData = async () => {
      if (id && token) {
        try {
          const response = await axiosJWT.get(
            `${APIEndpoint}/api/masterProject/${id}?merge=false`,
          );
          setProjectData(response.data.data);

          // Fetch payment data if status is Completed
          if (response.data.data?.status === "Completed") {
            try {
              const paymentResponse = await axiosJWT.get(
                `${APIEndpoint}/api/payments`,
              );
              const payments = paymentResponse.data.data || [];
              const projectPayment = payments.find(
                (p: any) => p.id_tmst_project === Number(id),
              );
              if (projectPayment) {
                setPaymentData(projectPayment);
              }
            } catch (_paymentError) {
              console.error("Failed to fetch payment data");
            }
          }
        } catch (_e) {
          toast.error("Failed to fetch project data");
        }
      }
    };

    fetchProjectData();
  }, [id, token, axiosJWT, APIEndpoint]);

  const updateHistory = async (statusId: number) => {
    const historyData: HistoryRequest = {
      id_project: id as string,
      id_status: statusId,
      changed_at: new Date().toISOString(),
    };

    try {
      await axiosJWT.post(
        `${APIEndpoint}/api/approvalAdmin/approve/${id}`,
        historyData,
      );
    } catch (error) {
      throw error;
    }
  };

  const handleApprove = async () => {
    if (!id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axiosJWT.post(`${APIEndpoint}/api/approvalAdmin/approve/${id}`);

      toast.success("Project approved successfully");
      router.push("/admin/project");
    } catch (_e) {
      toast.error("Failed to approve project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const _handleReject = async () => {
    if (!id || isSubmitting || !remarks) {
      if (!remarks) {
        toast.error("Please provide rejection remarks");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const rejectData: RejectRequest = {
        remarkProject: remarks,
      };
      await axiosJWT.post(
        `${APIEndpoint}/api/approvalAdmin/reject/${id}`,
        rejectData,
      );

      await updateHistory(4);

      toast.success("Project rejected successfully");
      router.push("/admin/project");
    } catch (_e) {
      toast.error("Failed to reject project");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!projectData) {
    return <div>Loading...</div>;
  }

  // Use totalEstimasi directly from backend (calculated as: durasi_default × kuota × besaran_insentif)
  const estimasiInsentifBenar = projectData.totalEstimasi || 0;

  // Use totalAktual from backend for actual incentive (from timesheets)
  const aktualInsentif = projectData.totalAktual || 0;

  const formatTanggal = (tanggalMulai: string, tanggalSelesai: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
        year: "numeric",
      };

      const parseDate = (dateStr: string) => {
        if (!dateStr) return null;

        if (dateStr.includes("T") || dateStr.includes("Z")) {
          return new Date(dateStr);
        }

        if (dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/");
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        return new Date(dateStr);
      };

      const startDate = parseDate(tanggalMulai);
      const endDate = parseDate(tanggalSelesai);

      const isKarya =
        projectData?.tmst_kategori_magang?.tran_insentif?.id_satuan === 2;

      if (isKarya) {
        const regEndStr =
          (projectData as any)?.pendaftaran_selesai ||
          (projectData as any)?.pendaftaranSelesai ||
          tanggalSelesai ||
          (projectData as any)?.tanggal_pendaftaran_selesai;
        const regEnd = regEndStr ? parseDate(regEndStr) : null;
        if (regEnd && !isNaN(regEnd.getTime())) {
          const start = new Date(regEnd);
          start.setDate(start.getDate() + 1);
          return `${start.toLocaleDateString("id-ID", options)} - Selesai`;
        }

        if (startDate && !isNaN(startDate.getTime())) {
          return `${startDate.toLocaleDateString("id-ID", options)} - Selesai`;
        }

        return `${tanggalMulai} - Selesai`;
      }

      if (
        !startDate ||
        !endDate ||
        isNaN(startDate.getTime()) ||
        isNaN(endDate.getTime())
      ) {
        const regEndStr =
          (projectData as any)?.pendaftaran_selesai ||
          (projectData as any)?.pendaftaranSelesai ||
          (projectData as any)?.tanggal_pendaftaran_selesai;
        if (regEndStr) {
          const regEnd = parseDate(regEndStr);
          if (regEnd && !isNaN(regEnd.getTime())) {
            const date = new Date(regEnd);
            date.setDate(date.getDate() + 1);
            return `${date.toLocaleDateString("id-ID", options)} - Selesai`;
          }
        }
        return `${tanggalMulai} - ${tanggalSelesai}`;
      }

      const formattedStartDate = startDate.toLocaleDateString("id-ID", options);
      const formattedEndDate = endDate.toLocaleDateString("id-ID", options);

      return `${formattedStartDate} - ${formattedEndDate}`;
    } catch (_e) {
      return `${tanggalMulai} - ${tanggalSelesai}`;
    }
  };

  // Build breadcrumb labels to show project name instead of ID
  const breadcrumbLabels: Record<string, string> = {};
  if (id && projectData?.nama) {
    breadcrumbLabels[id as string] = projectData.nama;
  }

  return (
    <Layout title="Project Details" breadcrumbLabels={breadcrumbLabels}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full max-w-4xl">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full">
            <h2 className="text-2xl font-bold mb-6 border-b pb-2">
              RINCIAN PROJECT
            </h2>
            <div className="grid grid-cols-2 gap-4">
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
                    projectData.tanggal_mulai,
                    projectData.tanggal_selesai,
                  )}
                </p>
              </div>
              <div>
                <p className="font-semibold">Anggota</p>
                {projectData.anggota.map((anggota, index) => {
                  const isKarya =
                    projectData.tmst_kategori_magang?.tran_insentif
                      ?.id_satuan === 2;
                  return (
                    <p key={index}>
                      {index + 1}. {anggota} ({projectData.durasi[index]}{" "}
                      {isKarya ? "Karya" : "Jam"})
                    </p>
                  );
                })}
              </div>
              <div>
                <p className="font-semibold">Total Estimasi Insentif</p>
                <p>Rp {estimasiInsentifBenar.toLocaleString()},-</p>
                {aktualInsentif > 0 &&
                  [
                    "Waiting Timesheet Approval",
                    "Completed",
                    "Need Revision",
                  ].includes(projectData.status) && (
                    <>
                      <p className="font-semibold mt-3">
                        Total Aktual Insentif
                      </p>
                      <p>Rp {aktualInsentif.toLocaleString()},-</p>
                    </>
                  )}
              </div>
              <div>
                <p className="font-semibold">Status</p>
                <span className={getStatusBadgeClassName(projectData.status)}>
                  {projectData.status}
                </span>
              </div>
            </div>
            {projectData.status !== "Completed" && (
              <div className="mt-6">
                <p className="font-semibold mb-2">Catatan</p>
                <textarea
                  className="w-full h-24 p-2 border rounded"
                  placeholder="Tambahkan catatan di sini..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={projectData.status !== "Submitted"}
                />
              </div>
            )}
            <div className="mt-6 flex justify-between space-x-4">
              <div>
                <Link href="/admin/project" className="btn btn-warning">
                  Kembali
                </Link>
              </div>
              {projectData.status === "Waiting Project Approval" && (
                <div className="">
                  <button
                    onClick={handleApprove}
                    className="btn btn-success"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processing..." : "Approve"}
                  </button>
                  {/* <button
                  onClick={handleReject}
                  className="btn btn-error"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Reject'}
                </button> */}
                </div>
              )}
            </div>
          </div>

          {/* Lampiran Timesheet - Only show when status is Completed */}
          {projectData.status === "Completed" && id && (
            <LampiranTimesheet
              projectId={id as string}
              projectData={projectData}
              axiosJWT={axiosJWT}
              APIEndpoint={APIEndpoint || ""}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(ProjectView);
