import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/src/components/Layout";
import axios from "axios";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import { useRole } from "@/src/context/RoleContext";
import { MdExpandMore, MdExpandLess } from "react-icons/md";
import { getStatusBadgeClassName } from "@/src/constants/badge";
import Pagination from "@/src/components/Pagination";
import Link from "next/link";
import {
  showConfirmation,
  showApprovalConfirmation,
  showLoading,
  showSuccess,
  showError,
} from "@/src/utils/swalHelper";

type Applicant = {
  id: number;
  mahasiswa: {
    nama: string;
    departemen: string;
    id: string;
  };
  status: string;
};

type Quota = {
  month: string; // "YYYY-MM"
  used: number;
  remaining: number;
  limit: number;
  breakdown?: Record<string, number>;
};

interface DecodedToken {
  exp: number;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseDateFlexible(input: string | Date): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;

  const s = String(input).trim();

  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const mo = Number(dmy[2]) - 1;
    const y = Number(dmy[3]);
    const dt = new Date(y, mo, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, mo, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function listMonthKeysBetweenInclusive(start: Date, end: Date): string[] {
  if (!start || !end) return [];
  const s = new Date(start.getFullYear(), start.getMonth(), 1);
  const e = new Date(end.getFullYear(), end.getMonth(), 1);
  const keys: string[] = [];
  for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  return keys;
}

function monthLabel(yyyyMm: string) {
  try {
    const [y, m] = yyyyMm.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  } catch {
    return yyyyMm;
  }
}

function yearRangeLabel(monthKeys: string[]) {
  if (!monthKeys || monthKeys.length === 0) return "";
  const years = monthKeys.map((mm) => Number(mm.split("-")[0]));
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  return minY === maxY ? String(minY) : `${minY}-${maxY}`;
}

function monthNameUpper(yyyyMm: string) {
  try {
    const [y, m] = yyyyMm.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleDateString("id-ID", { month: "long" }).toUpperCase();
  } catch {
    return yyyyMm;
  }
}

const ApplicationsPage = () => {
  const router = useRouter();
  const { id: projectId } = router.query;

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const [projectName, setProjectName] = useState<string>("");
  const [projectCategory, setProjectCategory] = useState<string>("");
  const [projectMonths, setProjectMonths] = useState<string[]>([]); // ["YYYY-MM", ...]
  const [quotaMap, setQuotaMap] = useState<
    Record<string, Record<string, Quota | null>>
  >({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const { setId, setRole, setName } = useRole();

  const toggleExpand = (i: number) =>
    setExpandedIndex((prev) => (prev === i ? null : i));

  // Init token + role context
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      const decoded = jwtDecode(storedToken) as {
        id?: string;
        role?: string;
        name?: string;
      } | null;
      setToken(storedToken);
      if (decoded) {
        if (setId) setId(decoded.id ?? null);
        if (setRole) setRole(decoded.role ?? null);
        if (setName) setName(decoded.name ?? null);
      }
    } else {
      router.push("/login");
    }
  }, [router, setId, setRole, setName]);

  // axios instance with token refresh
  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const decodedToken: DecodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            try {
              const response = await axios.get(`${API_ENDPOINT}/token`, {
                withCredentials: true,
              });
              const newToken = response.data.data.token;
              localStorage.setItem("token", newToken);
              setToken(newToken);
              config.headers.Authorization = `Bearer ${newToken}`;
            } catch (error) {
              router.push("/login");
              return Promise.reject(error);
            }
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
    return instance;
  }, [token, API_ENDPOINT, router]);

  // Fetch project detail & applicants
  useEffect(() => {
    if (!projectId || !token) return;

    const fetchProjectDetail = async () => {
      try {
        const res = await axiosJWT.get(
          `${API_ENDPOINT}/api/masterProject/${projectId}`,
        );
        const data = res.data?.data || {};
        setProjectName(data.nama || "");
        setProjectCategory(data.kategori || "");

        const start = parseDateFlexible(data.tanggal_mulai);
        const end = parseDateFlexible(data.tanggal_selesai);
        if (start && end) {
          setProjectMonths(listMonthKeysBetweenInclusive(start, end));
        } else {
          setProjectMonths([]);
        }
      } catch (error) {
        console.error("Gagal memuat detail project:", error);
      }
    };

    const fetchApplicants = async () => {
      setLoading(true);
      try {
        const response = await axiosJWT.get(
          `${API_ENDPOINT}/api/masterProject/${projectId}/applicants`,
        );
        setApplicants(response.data.data || []);
        setCurrentPage(1); // reset ke halaman 1 saat data baru dimuat
      } catch (error) {
        toast.error("Gagal memuat lamaran");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetail();
    fetchApplicants();
  }, [projectId, axiosJWT, API_ENDPOINT, token]);

  // Fetch quota per mahasiswa per bulan (dalam rentang proyek)
  useEffect(() => {
    if (!token) return;
    if (applicants.length === 0 || projectMonths.length === 0) {
      setQuotaMap({});
      return;
    }

    const run = async () => {
      setQuotaLoading(true);
      try {
        const newMap: Record<string, Record<string, Quota | null>> = {};
        await Promise.all(
          applicants.flatMap((a) =>
            projectMonths.map(async (mm) => {
              try {
                const res = await axiosJWT.get(
                  `${API_ENDPOINT}/api/mahasiswa/quota`,
                  {
                    params: { id: a.mahasiswa.id, month: mm },
                  },
                );
                const q: Quota | null = res?.data?.data || null;
                if (!newMap[a.mahasiswa.id]) newMap[a.mahasiswa.id] = {};
                newMap[a.mahasiswa.id][mm] = q;
              } catch {
                if (!newMap[a.mahasiswa.id]) newMap[a.mahasiswa.id] = {};
                newMap[a.mahasiswa.id][mm] = null;
              }
            }),
          ),
        );
        setQuotaMap(newMap);
      } finally {
        setQuotaLoading(false);
      }
    };

    run();
  }, [applicants, projectMonths, axiosJWT, API_ENDPOINT, token]);

  // Pagination logic (frontend)
  const totalPages = Math.max(1, Math.ceil(applicants.length / perPage));
  const paginatedApplicants = applicants.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  const handlePageChange = ({ selected }: { selected: number }) => {
    setCurrentPage(selected + 1);
    setExpandedIndex(null); // tutup accordion saat ganti halaman
  };

  // Reset ke halaman 1 jika perPage berubah dan halaman saat ini jadi invalid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [perPage, totalPages, currentPage]);

  const handleAction = async (
    applicationId: number,
    action: "approve" | "reject",
    applicantName: string,
  ) => {
    // Show confirmation dialog
    const isApprove = action === "approve";
    const confirmation = isApprove
      ? await showApprovalConfirmation({
          title: "Terima Lamaran?",
          text: `Terima lamaran dari ${applicantName}?`,
          confirmButtonText: "Ya, Terima",
        })
      : await showConfirmation({
          title: "Tolak Lamaran?",
          text: `Tolak lamaran dari ${applicantName}?`,
          confirmButtonText: "Ya, Tolak",
          confirmButtonColor: "#EF4444",
        });

    if (!confirmation.isConfirmed) return;

    showLoading({ title: isApprove ? "Menerima..." : "Menolak..." });

    try {
      await axiosJWT.post(
        `${API_ENDPOINT}/api/applications/${applicationId}/select`,
        { status: isApprove ? "Accepted" : "Rejected" },
      );

      // refresh applicants
      const response = await axiosJWT.get(
        `${API_ENDPOINT}/api/masterProject/${projectId}/applicants`,
      );
      setApplicants(response.data.data || []);

      await showSuccess({
        title: "Berhasil!",
        text: `Lamaran dari ${applicantName} berhasil di${isApprove ? "terima" : "tolak"}.`,
      });

      if (isApprove) {
        // Force refresh quota data untuk semua mahasiswa
        const refreshQuotaData = async () => {
          setQuotaLoading(true);
          try {
            const newMap: Record<string, Record<string, Quota | null>> = {};
            const currentApplicants = response.data.data || [];

            await Promise.all(
              currentApplicants.flatMap((a: Applicant) =>
                projectMonths.map(async (mm) => {
                  try {
                    const res = await axiosJWT.get(
                      `${API_ENDPOINT}/api/mahasiswa/quota`,
                      {
                        params: { id: a.mahasiswa.id, month: mm },
                      },
                    );
                    const q: Quota | null = res?.data?.data || null;
                    if (!newMap[a.mahasiswa.id]) newMap[a.mahasiswa.id] = {};
                    newMap[a.mahasiswa.id][mm] = q;
                  } catch {
                    if (!newMap[a.mahasiswa.id]) newMap[a.mahasiswa.id] = {};
                    newMap[a.mahasiswa.id][mm] = null;
                  }
                }),
              ),
            );
            setQuotaMap(newMap);
          } finally {
            setQuotaLoading(false);
          }
        };

        setTimeout(refreshQuotaData, 500);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err?.response?.data?.message || err?.message || "Gagal memproses aksi.";
      await showError({ title: "Gagal!", text: errMsg });
      console.error(error);
    }
  };

  return (
    <Layout title="Lamaran Mahasiswa">
      <div className="p-6 bg-transparant min-h-screen">
        <h1 className="text-2xl font-bold mb-1 text-gray-800">
          {projectCategory}, {projectName}
        </h1>

        {loading ? (
          <p className="text-center text-gray-500">Memuat data pelamar...</p>
        ) : (
          <>
            {/* Mobile Accordion View */}
            <div className="block md:hidden space-y-3">
              {paginatedApplicants.length === 0 ? (
                <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow">
                  Belum ada lamaran untuk proyek ini.
                </div>
              ) : (
                paginatedApplicants.map((applicant, index) => {
                  const nim = applicant.mahasiswa.id;
                  const globalIndex = (currentPage - 1) * perPage + index;
                  return (
                    <div
                      key={applicant.id}
                      className="bg-white rounded-lg shadow-md overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(globalIndex)}
                        className="w-full text-left p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">
                            {(currentPage - 1) * perPage + index + 1}.{" "}
                            {applicant.mahasiswa.nama}
                          </div>
                          <div className="text-xs text-gray-600">
                            {applicant.mahasiswa.departemen}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={getStatusBadgeClassName(
                              applicant.status,
                            )}
                          >
                            {applicant.status}
                          </span>
                          {expandedIndex === globalIndex ? (
                            <MdExpandLess className="text-xl text-gray-600" />
                          ) : (
                            <MdExpandMore className="text-xl text-gray-600" />
                          )}
                        </div>
                      </button>

                      <div
                        className={`${expandedIndex === globalIndex ? "block" : "hidden"} p-4 bg-white border-t`}
                      >
                        {/* Quota per bulan */}
                        {projectMonths.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">
                              Sisa Jam ({yearRangeLabel(projectMonths)})
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {projectMonths.map((mm) => {
                                const q = quotaMap[nim]?.[mm] || null;
                                return (
                                  <div
                                    key={mm}
                                    className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs"
                                  >
                                    <span className="font-medium">
                                      {monthLabel(mm)}:
                                    </span>
                                    <span className="text-gray-700">
                                      {quotaLoading && !q
                                        ? "..."
                                        : q
                                          ? `${q.remaining}/${q.limit}`
                                          : "-"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleAction(
                                applicant.id,
                                "approve",
                                applicant.mahasiswa.nama,
                              )
                            }
                            className="flex-1 btn btn-success btn-sm text-white"
                            disabled={applicant.status !== "Pending"}
                          >
                            Terima
                          </button>
                          <button
                            onClick={() =>
                              handleAction(
                                applicant.id,
                                "reject",
                                applicant.mahasiswa.nama,
                              )
                            }
                            className="flex-1 btn btn-error btn-sm text-white"
                            disabled={applicant.status !== "Pending"}
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-[#F5F9F8] shadow-2xl rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-700">
                  <thead className="bg-[#F5F9F8] text-xs shadow-2xl border-b">
                    {/* Baris 1: kolom tetap + header grup SISA JAM (TAHUN) + AKSI */}
                    <tr className="border-b border-gray-200 uppercase">
                      <th
                        className="px-6 py-3"
                        rowSpan={projectMonths.length > 0 ? 2 : 1}
                      >
                        No.
                      </th>
                      <th
                        className="px-6 py-3"
                        rowSpan={projectMonths.length > 0 ? 2 : 1}
                      >
                        Nama
                      </th>
                      <th
                        className="px-6 py-3"
                        rowSpan={projectMonths.length > 0 ? 2 : 1}
                      >
                        Departemen
                      </th>
                      <th
                        className="px-6 py-3 "
                        rowSpan={projectMonths.length > 0 ? 2 : 1}
                      >
                        Status
                      </th>

                      {projectMonths.length > 0 && (
                        <th
                          className="px-6 py-3 text-center font-semibold"
                          colSpan={projectMonths.length}
                        >
                          SISA JAM ({yearRangeLabel(projectMonths)})
                        </th>
                      )}

                      <th
                        className="px-6 py-3 text-center"
                        rowSpan={projectMonths.length > 0 ? 2 : 1}
                      >
                        Aksi
                      </th>
                    </tr>

                    {/* Baris 2: sub-kolom nama bulan */}
                    {projectMonths.length > 0 && (
                      <tr className="uppercase">
                        {projectMonths.map((mm) => (
                          <th
                            key={mm}
                            className="px-6 py-3 text-center bg-[#F5F9F8] border-b"
                          >
                            {monthNameUpper(mm)}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {paginatedApplicants.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4 + projectMonths.length + 1}
                          className="text-center py-10 text-gray-500 !bg-transparent"
                        >
                          Belum ada lamaran untuk proyek ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedApplicants.map((applicant, index) => {
                        const nim = applicant.mahasiswa.id;
                        return (
                          <tr
                            key={applicant.id}
                            className="bg-[#F5F9F8] border-b hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 text-center">
                              {(currentPage - 1) * perPage + index + 1}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {applicant.mahasiswa.nama}
                            </td>
                            <td className="px-6 py-4">
                              {applicant.mahasiswa.departemen}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={getStatusBadgeClassName(
                                  applicant.status,
                                )}
                              >
                                {applicant.status}
                              </span>
                            </td>

                            {/* Nilai sisa jam per bulan */}
                            {projectMonths.map((mm) => {
                              const q = quotaMap[nim]?.[mm] || null;
                              return (
                                <td key={mm} className="px-6 py-4 text-center">
                                  {quotaLoading && !q
                                    ? "..."
                                    : q
                                      ? `${q.remaining}/${q.limit}`
                                      : "-"}
                                </td>
                              );
                            })}

                            <td className="px-6 py-4 flex gap-2 justify-center">
                              <button
                                onClick={() =>
                                  handleAction(
                                    applicant.id,
                                    "approve",
                                    applicant.mahasiswa.nama,
                                  )
                                }
                                className="btn btn-success btn-sm text-white"
                                disabled={applicant.status !== "Pending"}
                              >
                                Terima
                              </button>
                              <button
                                onClick={() =>
                                  handleAction(
                                    applicant.id,
                                    "reject",
                                    applicant.mahasiswa.nama,
                                  )
                                }
                                className="btn btn-error btn-sm text-white"
                                disabled={applicant.status !== "Pending"}
                              >
                                Tolak
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {applicants.length > 0 && (
              <div className="mt-5 mb-2">
                <Pagination
                  pageCount={totalPages}
                  onPageChange={handlePageChange}
                  perPage={perPage}
                  setPerPage={setPerPage}
                  currentPage={currentPage}
                />
              </div>
            )}

            {/* Tombol Kembali */}
            <div className="mt-4 mb-6">
              <Link
                href={`/user/myproject`}
                className="btn bg-primary text-white"
              >
                Kembali
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ApplicationsPage;
