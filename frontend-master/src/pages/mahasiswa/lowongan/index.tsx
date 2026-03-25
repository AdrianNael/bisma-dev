// pages/mahasiswa/lowongan/index.tsx
/* eslint-disable react-hooks/exhaustive-deps */

import Layout from "@/src/components/Layout";
import { useState, useEffect, useMemo } from "react";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { toast } from "react-toastify";
import { useRole } from "@/src/context/RoleContext";
import ModalDetailLowongan from "@/src/components/ModalDetailLowongan";
import QuotaModal from "@/src/components/QuotaModal";
import { HiOutlineEye } from "react-icons/hi";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useRouter } from "next/router";

type LowonganItem = {
  id: number;
  nama: string;
  kriteria: string;
  pendaftaran_selesai: string | Date;
  pendaftaran_mulai: string | Date;
  tanggal_mulai: string | Date | null;
  tanggal_selesai: string | Date | null;
  kuota: number;
  durasi_default?: number | null;
  tmst_kategori_magang: {
    kategori: string;
    tran_insentif?: {
      besaran_insentif: number;
      durasi_satuan?: number | null;
      tmst_satuan_insentif: { satuan: string };
    };
  };
  tmst_pengguna: { nama: string; email?: string };
  project_departments?: Array<{ department_id: number }>;
  project_faculties?: Array<{ faculty_id: number }>;
  my_application_status?: "Pending" | "Accepted" | "Rejected" | null;
};

type PageProps = { name: string; role: string; id: string; username: string };
type ApplicationStatus = "Pending" | "Accepted" | "Rejected";
interface DecodedToken {
  exp: number;
}

const toDateStr = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const nama = [
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
  ][(m - 1 + 12) % 12];
  return `${nama} ${y}`;
};

const listMonthKeysBetween = (start: Date, end: Date): string[] => {
  const s = new Date(start.getFullYear(), start.getMonth(), 1);
  const e = new Date(end.getFullYear(), end.getMonth(), 1);
  const keys: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys.length ? keys : [monthKey(start)];
};
const splitEqually = (total: number, parts: number): number[] => {
  const T = Math.max(0, Math.floor(Number(total) || 0));
  const N = Math.max(1, Math.floor(parts) || 1);
  const base = Math.floor(T / N);
  const rem = T % N;
  return Array.from({ length: N }, (_, i) => base + (i < rem ? 1 : 0));
};

// Strip user name suffix from project name (e.g., "Project - User Name" -> "Project")
const stripUserSuffix = (nama: string): string => {
  const parts = nama.split(" - ");
  return parts.length > 1 ? parts.slice(0, -1).join(" - ") : nama;
};

const LowonganPage = ({ name, role, id }: PageProps) => {
  const [lowonganList, setLowonganList] = useState<LowonganItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedLowongan, setSelectedLowongan] = useState<LowonganItem | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setRole, setName, setId } = useRole();
  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [quota, setQuota] = useState<{
    month: string;
    used: number;
    remaining: number;
    limit: number;
  } | null>(null);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  const [myAppStatusMap, setMyAppStatusMap] = useState<
    Record<number, ApplicationStatus>
  >({});
  const [myDepartmentId, setMyDepartmentId] = useState<number | null>(null);
  const [departmentMap, setDepartmentMap] = useState<Record<number, string>>(
    {},
  );
  const [facultyMap, setFacultyMap] = useState<Record<number, string>>({});
  const [myFacultyId, setMyFacultyId] = useState<number | null>(null);

  useEffect(() => {
    if (role && name && id) {
      setRole(role);
      if (setName) setName(name);
      if (setId) setId(id);
    }
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
    else router.push("/login");
  }, [role, name, id, setRole, setName, setId, router]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const decodedToken: DecodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            const resp = await axios.get(`${API_ENDPOINT}/token`, {
              withCredentials: true,
            });
            const newToken = resp.data.data.token;
            localStorage.setItem("token", newToken);
            setToken(newToken);
            config.headers.Authorization = `Bearer ${newToken}`;
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
    return instance;
  }, [token, API_ENDPOINT]);

  const refreshMyAppStatus = async () => {
    try {
      const appsRes = await axiosJWT.get(
        `${API_ENDPOINT}/api/mahasiswa/applications`,
      );
      const apps = (appsRes.data?.data || []) as Array<{
        project: { id: number };
        status: ApplicationStatus;
      }>;
      const map: Record<number, ApplicationStatus> = {};
      for (const a of apps) if (a?.project?.id) map[a.project.id] = a.status;
      setMyAppStatusMap(map);
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      setIsLoading(true);
      try {
        const [jobsRes, quotaRes, profileRes, deptRes, facultyRes] =
          await Promise.all([
            axiosJWT.get(`${API_ENDPOINT}/api/lowongan`),
            axiosJWT.get(`${API_ENDPOINT}/api/mahasiswa/quota`),
            axiosJWT.get(`${API_ENDPOINT}/api/users/me`),
            axiosJWT.get(`${API_ENDPOINT}/api/department`),
            axiosJWT.get(`${API_ENDPOINT}/api/faculty`),
          ]);
        const jobs: LowonganItem[] = jobsRes.data?.data || [];
        setLowonganList(jobs);
        setQuota(quotaRes.data?.data || null);

        const profile = profileRes.data?.data;
        const myDept = profile?.tmst_department?.id || null;
        const myFac = profile?.tmst_department?.faculty_id || null;
        setMyDepartmentId(myDept);
        setMyFacultyId(myFac);

        const deptList = deptRes.data?.data || [];
        const deptMapTemp: Record<number, string> = {};
        deptList.forEach((dept: any) => {
          deptMapTemp[dept.id] = dept.department;
        });
        setDepartmentMap(deptMapTemp);

        const facultyList = facultyRes.data?.data || [];
        const facultyMapTemp: Record<number, string> = {};
        facultyList.forEach((fac: any) => {
          facultyMapTemp[fac.id] = fac.faculty;
        });
        setFacultyMap(facultyMapTemp);

        await refreshMyAppStatus();

        const seeded: Record<number, ApplicationStatus> = {};
        for (const j of jobs) {
          if (j.my_application_status)
            seeded[j.id] = j.my_application_status as ApplicationStatus;
        }
        if (Object.keys(seeded).length) {
          setMyAppStatusMap((prev) => ({ ...prev, ...seeded }));
        }
      } catch (err) {
        console.error("Gagal mengambil data lowongan/riwayat:", err);
        toast.error("Gagal memuat data lowongan.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token, axiosJWT, API_ENDPOINT]);

  const openDetailModal = async (job: LowonganItem) => {
    setSelectedLowongan(job);
    setIsModalOpen(true);

    // PERBAIKAN: Skip validasi kuota untuk project karya atau jika tanggal tidak ada
    const satuanInsentif =
      job.tmst_kategori_magang.tran_insentif?.tmst_satuan_insentif?.satuan ||
      "";
    const isKaryaProject = satuanInsentif.toLowerCase().includes("karya");

    // Skip jika project karya atau tidak ada tanggal
    if (isKaryaProject || !job.tanggal_mulai || !job.tanggal_selesai) {
      return;
    }

    const start = new Date(toDateStr(job.tanggal_mulai));
    const end = new Date(toDateStr(job.tanggal_selesai));
    const totalPlan = Number(job.durasi_default ?? 0);

    const keys = listMonthKeysBetween(start, end);
    const shares = splitEqually(totalPlan, keys.length);

    try {
      const responses = await Promise.all(
        keys.map((k) =>
          axiosJWT.get(`${API_ENDPOINT}/api/mahasiswa/quota?month=${k}`),
        ),
      );

      responses.forEach((res, idx) => {
        const k = keys[idx];
        const plan = shares[idx] || 0;
        const q = res.data?.data as {
          month: string;
          used: number;
          remaining: number;
          limit: number;
        };
        if (plan > 0 && q.remaining < plan) {
          toast.error(
            `Kuota jam untuk ${monthLabel(k)} tidak mencukupi. Terpakai: ${q.used} jam, rencana: ${plan} jam, batas: ${q.limit} jam.`,
          );
        }
      });
    } catch (err) {
      console.error("Gagal cek kuota bulanan:", err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedLowongan(null);
  };

  const handleApply = async () => {
    if (!selectedLowongan) return;

    const projectDepts = selectedLowongan.project_departments || [];
    const hasRestriction = projectDepts.length > 0;
    const canApply =
      !hasRestriction ||
      (myDepartmentId &&
        projectDepts.some((pd) => pd.department_id === myDepartmentId));

    if (!canApply) {
      toast.error(
        "Departemen Anda tidak sesuai dengan persyaratan lowongan ini.",
      );
      return;
    }

    const current = myAppStatusMap[selectedLowongan.id];
    if (current === "Pending") {
      toast.info(
        "Lamaran kamu untuk lowongan ini sedang menunggu persetujuan.",
      );
      return;
    }

    try {
      await axiosJWT.post(
        `${API_ENDPOINT}/api/lowongan/${selectedLowongan.id}/apply`,
      );
      toast.success("Lamaran berhasil dikirim!");
      setMyAppStatusMap((prev) => ({
        ...prev,
        [selectedLowongan.id]: "Pending",
      }));
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          "Gagal mengirim lamaran atau Anda sudah pernah melamar.",
      );
    }
  };

  return (
    <Layout title="Lowongan Part-time">
      <div className="p-4 md:p-6">
        <div className="mb-6">
          {quota && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              <span className="font-semibold">Kuota bulan ini:</span>
              <span>
                {quota.remaining}/{quota.limit} jam tersisa
              </span>
              <button
                aria-label="Lihat riwayat kuota"
                onClick={() => setIsQuotaModalOpen(true)}
                className="ml-2 p-1 rounded hover:bg-gray-200"
              >
                <HiOutlineEye className="text-lg" />
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10">Memuat data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lowonganList.length > 0 ? (
              lowonganList.map((job) => {
                const status = myAppStatusMap[job.id];
                const projectDepts = job.project_departments || [];
                const projectFacs = job.project_faculties || [];
                const hasDeptRestriction = projectDepts.length > 0;
                const hasFacultyRestriction = projectFacs.length > 0;
                const hasRestriction =
                  hasDeptRestriction || hasFacultyRestriction;

                // Can apply if: no restrictions, OR department matches, OR faculty matches
                let canApply = !hasRestriction;
                if (hasDeptRestriction && myDepartmentId) {
                  if (
                    projectDepts.some(
                      (pd) => pd.department_id === myDepartmentId,
                    )
                  ) {
                    canApply = true;
                  }
                }
                if (hasFacultyRestriction && myFacultyId) {
                  if (projectFacs.some((pf) => pf.faculty_id === myFacultyId)) {
                    canApply = true;
                  }
                }

                return (
                  <div
                    key={job.id}
                    className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs md:text-sm font-semibold text-[#0c5b5b] bg-[#0c5b5b]/10 py-1 px-3 rounded-full">
                          {job.tmst_kategori_magang.kategori}
                        </span>

                        {status && (
                          <span
                            className={`text-xs font-semibold py-1 px-2 rounded-full ${
                              status === "Pending"
                                ? "bg-[#f3cb19]/20 text-[#f3cb19]"
                                : status === "Accepted"
                                  ? "bg-[#0c5b5b]/20 text-[#0c5b5b]"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {status === "Pending"
                              ? "Waiting Approval"
                              : status === "Accepted"
                                ? "Accepted"
                                : "Rejected"}
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg font-bold mt-3">
                        {stripUserSuffix(job.nama)}
                      </h2>

                      {hasDeptRestriction && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {projectDepts.map((pd, idx) => (
                            <span
                              key={idx}
                              className="badge badge-outline badge-sm text-xs"
                            >
                              {departmentMap[pd.department_id] ||
                                `Dept ${pd.department_id}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {hasFacultyRestriction && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {projectFacs.map((pf, idx) => (
                            <span
                              key={idx}
                              className="badge badge-outline badge-sm text-xs"
                            >
                              {facultyMap[pf.faculty_id] ||
                                `Fakultas ${pf.faculty_id}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {hasRestriction && !canApply && (
                        <div className="alert alert-warning shadow-sm mt-2 py-2 px-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="stroke-current shrink-0 h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span className="text-xs">
                            {hasFacultyRestriction ? "Fakultas" : "Departemen"}{" "}
                            Anda tidak sesuai
                          </span>
                        </div>
                      )}

                      <p className="text-sm text-gray-600 mb-1">
                        <strong>PIC:</strong> {job.tmst_pengguna.nama}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Batas Akhir:</strong>{" "}
                        {new Date(job.pendaftaran_selesai).toLocaleDateString(
                          "id-ID",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </p>
                      {job.durasi_default && (
                        <p className="text-sm text-gray-600">
                          <strong>
                            {job.tmst_kategori_magang.tran_insentif?.tmst_satuan_insentif?.satuan
                              ?.toLowerCase()
                              .includes("karya")
                              ? "Karya:"
                              : "Durasi:"}
                          </strong>{" "}
                          {job.durasi_default}{" "}
                          {job.tmst_kategori_magang.tran_insentif?.tmst_satuan_insentif?.satuan
                            ?.toLowerCase()
                            .includes("karya")
                            ? "karya"
                            : "jam"}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => openDetailModal(job)}
                      disabled={!canApply}
                      className={`w-full mt-4 font-semibold py-2 rounded-lg transition-colors border-2 ${
                        canApply
                          ? "bg-[#f3cb19] text-[#0c5b5b] hover:bg-[#f3cb19]/80 border-[#0c5b5b]"
                          : "bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed"
                      }`}
                    >
                      {canApply ? "Lihat Detail" : "Tidak Dapat Melamar"}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-10">
                <p className="text-gray-500">
                  Saat ini tidak ada lowongan yang tersedia.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedLowongan && (
        <ModalDetailLowongan
          isOpen={isModalOpen}
          onClose={closeModal}
          onApply={handleApply}
          applicationStatus={myAppStatusMap[selectedLowongan.id] ?? null}
          lowongan={{
            ...selectedLowongan,
            nama: stripUserSuffix(selectedLowongan.nama),
            pendaftaran_mulai: toDateStr(selectedLowongan.pendaftaran_mulai),
            pendaftaran_selesai: toDateStr(
              selectedLowongan.pendaftaran_selesai,
            ),
            tanggal_mulai: toDateStr(selectedLowongan.tanggal_mulai),
            tanggal_selesai: toDateStr(selectedLowongan.tanggal_selesai),
            insentif_per_jam:
              selectedLowongan.tmst_kategori_magang.tran_insentif
                ?.besaran_insentif || 0,
            durasi_satuan:
              selectedLowongan.tmst_kategori_magang.tran_insentif
                ?.durasi_satuan ?? null,
            durasi_default: selectedLowongan.durasi_default ?? null,
            satuan_insentif:
              selectedLowongan.tmst_kategori_magang.tran_insentif
                ?.tmst_satuan_insentif?.satuan || "menit",
            kategori: selectedLowongan.tmst_kategori_magang.kategori,
            pic: selectedLowongan.tmst_pengguna.nama,
            pic_email: selectedLowongan.tmst_pengguna.email,
          }}
        />
      )}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        apiEndpoint={API_ENDPOINT || ""}
        token={token}
      />
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;
export default withPage(LowonganPage);
