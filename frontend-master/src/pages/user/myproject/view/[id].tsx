import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/src/components/Layout";
import Link from "next/link";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { MdExpandMore, MdExpandLess } from "react-icons/md";

type ProjectDetail = {
  id: number;
  nama: string;
  inisial_project: string;
  kategori: string;
  kategoriId: number;
  remark_project: string | null;
  anggota: string[];
  id_anggota: string[];
  estimasi: number[]; // uang dari tran_project (tidak dipakai hitung jam)
  durasi?: number[]; // durasi per mahasiswa (kalau ada)
  durasi_default?: number; // <<— dipakai sebagai fallback utama
  totalEstimasi?: number; // Planned: durasi_default × kuota × besaran_insentif
  totalAktual?: number; // Actual from timesheets
  sesi_aktual?: number[]; // Actual total sesi per member (optional)
  insentif_aktual?: number[]; // Actual insentif per member from timesheets
  status?: string;
  grouped_projects?: Array<{
    id: number;
    periode?: string | null;
    tanggal_mulai?: string | null;
    tanggal_selesai?: string | null;
    durasi?: number[];
    sesi_aktual?: number[];
    insentif_aktual?: number[];
  }>;
};

type IncentiveOfCategory = {
  id: number;
  id_kategori: number; // kategoriId dari tmst_kategori_magang
  kategori: string;
  id_satuan: number; // 1 = Jam
  besaran_insentif: number; // Rp per satuan
  durasi_satuan?: number | null; // TIDAK dipakai sebagai fallback utama!
  satuan?: string;
};

interface DecodedToken {
  exp: number;
}
const rupiah = (n = 0) => `Rp ${Number(n || 0).toLocaleString("id-ID")},-`;

const ViewProjectPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

  const [token, setToken] = useState<string | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [incentive, setIncentive] = useState<IncentiveOfCategory | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [_hasApprovedTimesheets, setHasApprovedTimesheets] =
    useState<boolean>(false);
  const [_paymentTotal, setPaymentTotal] = useState<number | null>(null);

  const _unitLabel =
    (incentive?.satuan
      ? incentive.satuan
      : incentive?.id_satuan === 1
        ? "Jam"
        : "Karya") || "Jam";

  // axios instance + auto refresh
  const axiosJWT = useMemo(() => {
    const a = axios.create();
    a.interceptors.request.use(async (config) => {
      if (token) {
        const now = Date.now();
        if (expire && expire * 1000 < now) {
          const r = await axios.get(`${API}/token`, { withCredentials: true });
          const nt = r.data?.data?.token;
          setToken(nt);
          const decoded: DecodedToken = jwtDecode(nt);
          setExpire(decoded.exp);
          config.headers.Authorization = `Bearer ${nt}`;
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
    return a;
  }, [token, expire, API]);

  // token
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/token`, { withCredentials: true });
        const t = r.data?.data?.token;
        setToken(t);
        const decoded: DecodedToken = jwtDecode(t);
        setExpire(decoded.exp);
      } catch {
        router.push("/login");
      }
    })();
  }, [API, router]);

  // detail project
  useEffect(() => {
    if (!id || !token) return;
    let canceled = false;
    (async () => {
      try {
        const r = await axiosJWT.get(
          `${API}/api/masterProject/${id}?merge=true`,
        );
        if (!canceled && r?.data?.success) {
          const d = r.data.data;
          setProject({
            id: Number(d.id),
            nama: d.nama,
            inisial_project: d.inisial_project,
            kategori: d.kategori,
            kategoriId: Number(d.kategoriId),
            remark_project: d.remark_project ?? null,
            status: d?.status ?? undefined,
            anggota: Array.isArray(d.anggota) ? d.anggota : [],
            id_anggota: Array.isArray(d.id_anggota) ? d.id_anggota : [],
            estimasi: Array.isArray(d.estimasi)
              ? d.estimasi.map((x: unknown) => Number(x || 0))
              : [],
            durasi: Array.isArray(d.durasi)
              ? d.durasi.map((x: unknown) => Number(x || 0))
              : [],
            sesi_aktual: Array.isArray(d.sesi_aktual)
              ? d.sesi_aktual.map((x: unknown) => Number(x || 0))
              : [],
            insentif_aktual: Array.isArray(d.insentif_aktual)
              ? d.insentif_aktual.map((x: unknown) => Number(x || 0))
              : [],
            grouped_projects: Array.isArray(d.grouped_projects)
              ? d.grouped_projects.map((g: any) => ({
                  id: Number(g.id || g.id_project || 0),
                  nama: g.nama || g.name || null,
                  periode: g.periode || null,
                  tanggal_mulai: g.tanggal_mulai || null,
                  tanggal_selesai: g.tanggal_selesai || null,
                  durasi: Array.isArray(g.durasi)
                    ? g.durasi.map((x: unknown) => Number(x || 0))
                    : [],
                  sesi_aktual: Array.isArray(g.sesi_aktual)
                    ? g.sesi_aktual.map((x: unknown) => Number(x || 0))
                    : [],
                  insentif_aktual: Array.isArray(g.insentif_aktual)
                    ? g.insentif_aktual.map((x: unknown) => Number(x || 0))
                    : [],
                }))
              : [],
            durasi_default: Number(d.durasi_default || 0), // <<— ambil 2 jam dari API
            totalEstimasi: Number(d.totalEstimasi || 0),
            totalAktual: Number(d.totalAktual || 0),
          });
        }
      } catch (e: unknown) {
        const err = e as {
          response?: { status?: number; data?: { message?: string } };
          message?: string;
        };
        const status = err?.response?.status;
        if (status !== 401)
          toast.error(
            err?.response?.data?.message ||
              err?.message ||
              "Gagal mengambil detail proyek",
          );
        console.error(e);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [id, token, API, axiosJWT]);

  // Check if project has approved timesheets
  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      try {
        const r = await axiosJWT.get(
          `${API}/api/masterProject/${id}/has-approved-timesheets`,
        );
        if (r?.data?.success) {
          setHasApprovedTimesheets(r.data.data.hasApprovedTimesheets);
        }
      } catch (e) {
        console.error("Failed to check approved timesheets:", e);
        setHasApprovedTimesheets(false);
      }
    })();
  }, [id, token, API, axiosJWT]);

  // Fetch payment total when project has payment data (Completed, Need Revision, Waiting Timesheet Approval)
  useEffect(() => {
    if (!id || !token) return;
    const status = project?.status;
    if (
      status !== "Completed" &&
      status !== "Need Revision" &&
      status !== "Waiting Timesheet Approval" &&
      status !== "Project Approved" &&
      status !== "Approved"
    )
      return;
    (async () => {
      try {
        const r = await axiosJWT.get(`${API}/api/payments`);
        const payments = r?.data?.data || [];
        // Sum all payments for this project (could have multiple periods)
        const projectPayments = payments.filter(
          (p: { id_tmst_project: number }) => p.id_tmst_project === Number(id),
        );
        const total = projectPayments.reduce(
          (sum: number, p: { total_tagihan: number }) =>
            sum + (p.total_tagihan || 0),
          0,
        );
        setPaymentTotal(total > 0 ? total : null);
      } catch (e) {
        console.error("Failed to fetch payment data:", e);
        setPaymentTotal(null);
      }
    })();
  }, [id, token, project?.status, API, axiosJWT]);

  // insentif kategori
  useEffect(() => {
    if (!project?.kategoriId) return;
    (async () => {
      try {
        const r = await axiosJWT.get(`${API}/api/incentive`);
        const list: IncentiveOfCategory[] = r?.data?.data || [];
        const found =
          list.find(
            (x) => Number(x.id_kategori) === Number(project.kategoriId),
          ) || null;
        setIncentive(found);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [project?.kategoriId, API, axiosJWT]);

  const rows = useMemo(() => {
    if (!project) return [];
    const ratePerSesi = Number(incentive?.besaran_insentif || 0);
    const sesiMenit = Number(incentive?.durasi_satuan || 50);
    const isKarya = incentive?.id_satuan === 2; // Karya/Hasil Pekerjaan

    const defaultJam = Number(project?.durasi_default || 0);
    const hasActualData =
      Array.isArray(project?.insentif_aktual) &&
      project.insentif_aktual.length > 0;

    // Helper to aggregate per-member values across grouped splits when available
    const aggregateFromGroups = (key: string, idx: number) => {
      // If project has the key as an array and value present, prefer it
      const valArr = (project as any)[key] as any[] | undefined;
      if (
        Array.isArray(valArr) &&
        valArr[idx] !== undefined &&
        valArr[idx] !== null
      ) {
        return Number(valArr[idx] || 0);
      }
      // Otherwise, sum across grouped_projects if present
      if (
        Array.isArray((project as any).grouped_projects) &&
        (project as any).grouped_projects.length > 0
      ) {
        return (project as any).grouped_projects.reduce((s: number, g: any) => {
          const ga = Array.isArray(g?.[key]) ? Number(g[key][idx] || 0) : 0;
          return s + (isNaN(ga) ? 0 : ga);
        }, 0);
      }
      return undefined;
    };

    return (project.anggota || []).map((nama, i) => {
      const nim = project.id_anggota?.[i] ?? "";

      // Use actual data if available, otherwise use planned
      let durasi, jumlahSesi, insentifBaris;

      if (hasActualData) {
        // Try to use actual arrays on the main project first, otherwise aggregate from grouped splits
        const aggDur = aggregateFromGroups("durasi", i);
        const aggSesi = aggregateFromGroups("sesi_aktual", i);
        const aggIns = aggregateFromGroups("insentif_aktual", i);

        if (aggDur !== undefined) durasi = Number(aggDur || 0);
        if (aggSesi !== undefined) jumlahSesi = Number(aggSesi || 0);
        if (aggIns !== undefined) insentifBaris = Number(aggIns || 0);

        // Fallback to original direct values if still undefined
        if (
          (durasi === undefined || durasi === null) &&
          project.durasi?.[i] !== undefined
        ) {
          durasi = Number(project.durasi[i] || 0);
        }
        if (
          (jumlahSesi === undefined || jumlahSesi === null) &&
          project.sesi_aktual?.[i] !== undefined
        ) {
          jumlahSesi = Number(project.sesi_aktual?.[i] || 0);
        }
        if (
          (insentifBaris === undefined || insentifBaris === null) &&
          project.insentif_aktual?.[i] !== undefined
        ) {
          insentifBaris = Number(project.insentif_aktual?.[i] || 0);
        }
      } else {
        // No timesheet data - use planned/default
        durasi = defaultJam;
        if (isKarya) {
          jumlahSesi = durasi; // jumlah karya
          insentifBaris = Math.round(durasi * ratePerSesi);
        } else {
          jumlahSesi = (durasi * 60) / Math.max(1, sesiMenit);
          insentifBaris = Math.round(jumlahSesi * ratePerSesi);
        }
      }

      return {
        nama,
        nim,
        durasi,
        insentif: insentifBaris,
        sessions: jumlahSesi,
        isKarya,
      };
    });
  }, [project, incentive]);

  const totalDisplay = useMemo(
    () => rows.reduce((sum, r) => sum + (r.insentif || 0), 0),
    [rows],
  );

  const hasActualData =
    Array.isArray(project?.insentif_aktual) &&
    project.insentif_aktual.length > 0;
  const isCompleted = project?.status === "Completed";

  // Determine which total to show and its label
  // displayTotal now always prefers the row-based calculation when
  // available.  project.totalEstimasi can be stale (especially for karya
  // projects where the stored value may only reflect one karya), so fall
  // back to it only when we have no rows at all.
  const displayTotal =
    totalDisplay > 0 ? totalDisplay : project?.totalEstimasi || 0;

  const totalLabel = isCompleted
    ? "TOTAL INSENTIF"
    : hasActualData
      ? "TOTAL AKTUAL INSENTIF"
      : "TOTAL ESTIMASI INSENTIF";

  useEffect(() => {
    if (!project || !incentive) return;
  }, [project, incentive, rows]);

  const handleSubmitDirmawa = async () => {
    if (!project?.id) return;
    if (!project?.anggota || project.anggota.length === 0) {
      const msg = "Data anggota belum ada. Tidak dapat mengajukan ke DIRMAWA.";
      toast.error(msg, { toastId: msg });
      return;
    }
    try {
      await axiosJWT.put(`${API}/api/masterProject/${project.id}/submit`);
      const successMsg = "Berhasil diajukan ke DIRMAWA (Waiting Approval).";
      toast.success(successMsg, { toastId: successMsg });
      router.replace(router.asPath);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      const errMsg =
        err?.response?.data?.message || "Gagal mengajukan persetujuan.";
      toast.error(errMsg, { toastId: errMsg });
    }
  };

  const _handleOpenLowongan = async () => {
    if (!project?.id) return;
    try {
      await axiosJWT.put(`${API}/api/masterProject/${project.id}/open`);
      toast.success("Lowongan berhasil dibuka.");
      router.replace(router.asPath);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Gagal membuka lowongan.");
    }
  };

  // Build breadcrumb labels - map ID to project name
  const breadcrumbLabels: Record<string, string> = {};
  if (id && project?.nama) {
    breadcrumbLabels[String(id)] = project.nama;
  }

  return (
    <Layout title="My Project" breadcrumbLabels={breadcrumbLabels}>
      <div className="bg-transparant drop-shadow-md rounded-lg w-full p-3 sm:p-4 md:p-5">
        <h2 className="text-center text-lg sm:text-xl md:text-2xl font-extrabold tracking-wide mb-3">
          {project?.nama}
        </h2>

        {/* Mobile Accordion View */}
        <div className="block xl:hidden">
          {project && rows.length > 0 ? (
            <div className="space-y-3">
              {/* Project Header Card */}

              {/* Member Cards */}
              {rows.map((r, idx) => (
                <div
                  key={idx}
                  className="bg-[#F5F9F8] rounded-lg shadow-md overflow-hidden"
                >
                  {/* Card Header - Always Visible */}
                  <div
                    onClick={() =>
                      setExpandedIndex(expandedIndex === idx ? null : idx)
                    }
                    className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm sm:text-base font-semibold text-gray-500">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm sm:text-base">
                          {r.nama}
                        </div>
                        <div className="text-xs text-gray-600">
                          {project.id_anggota?.[idx]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-700 text-sm sm:text-base">
                        {rupiah(r.insentif)}
                      </span>
                      {expandedIndex === idx ? (
                        <MdExpandLess className="text-xl" />
                      ) : (
                        <MdExpandMore className="text-xl" />
                      )}
                    </div>
                  </div>

                  {/* Card Details - Expandable */}
                  {expandedIndex === idx && (
                    <div className="border-t border-gray-200 p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {r.isKarya ? "Jumlah Karya" : "Durasi Kegiatan"}
                        </span>
                        <span className="font-medium">
                          {r.isKarya ? (
                            <>{r.durasi} Karya</>
                          ) : (
                            <>
                              {r.durasi} Jam{" "}
                              <span className="text-xs text-gray-500">
                                (~{(r.sessions ?? 0).toFixed(2)} sesi)
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Insentif</span>
                        <span className="font-semibold text-rose-700">
                          {rupiah(r.insentif)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#F5F9F8] rounded-lg shadow-md p-6 text-center text-gray-500 text-sm">
              Data anggota belum ada.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <table className="hidden xl:table table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg text-xs md:text-sm xl:text-base">
          <thead>
            <tr className="!bg-transparent border-b border-gray-200 shadow-md">
              <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black !bg-transparent text-xs md:text-sm xl:text-base">
                No.
              </th>
              <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black !bg-transparent text-xs md:text-sm xl:text-base">
                Nama Mahasiswa
              </th>
              <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black !bg-transparent text-xs md:text-sm xl:text-base">
                {rows.length > 0 && rows[0].isKarya
                  ? "Jumlah Karya"
                  : "Durasi Kegiatan"}
              </th>
              <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black !bg-transparent text-xs md:text-sm xl:text-base">
                Insentif
              </th>
            </tr>
          </thead>
          <tbody>
            {project && rows.length > 0 ? (
              rows.map((r, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-300 !bg-transparent"
                >
                  <td className="p-3 md:p-4 !bg-transparent">
                    <div className="font-semibold">{idx + 1}</div>
                  </td>
                  <td className="p-3 md:p-4 !bg-transparent">
                    <div className="font-medium">{r.nama}</div>
                    <div className="text-xs text-gray-600">
                      {project.id_anggota?.[idx]}
                    </div>
                  </td>
                  <td className="p-3 md:p-4 !bg-transparent">
                    {r.isKarya ? (
                      <>{r.durasi} Karya</>
                    ) : (
                      <>
                        {r.durasi} Jam{" "}
                        <span className="text-xs text-gray-500">
                          (~{(r.sessions ?? 0).toFixed(2)} sesi)
                        </span>
                      </>
                    )}
                  </td>
                  <td className="p-3 md:p-4 !bg-transparent">
                    {rupiah(r.insentif)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-gray-500 !bg-transparent text-center"
                >
                  Data anggota belum ada.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 sm:mt-5 md:mt-6">
          <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg text-xs md:text-sm xl:text-base">
            <thead>
              <tr className="bg-transparent border-b border-gray-200 shadow-md">
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 md:py-4 px-3 md:px-4">
                  {project?.remark_project || "nothing remark project"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 sm:mt-7 md:mt-8 text-center">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-gray-700">
            {totalLabel}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-extrabold text-rose-700">
            {rupiah(displayTotal)}
          </div>
        </div>

        <div className="mt-6 sm:mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <Link
            href="/user/myproject"
            className="btn bg-primary text-white text-xs sm:text-sm md:text-base w-full sm:w-auto"
          >
            KEMBALI
          </Link>
          {project?.status === "Completed" ? (
            <button
              className="btn btn-success text-xs sm:text-sm md:text-base w-full sm:w-auto"
              disabled
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              SELESAI
            </button>
          ) : project?.status === "Approved" ||
            project?.status === "Project Approved" ? (
            <button
              className="btn btn-info text-xs sm:text-sm md:text-base w-full sm:w-auto"
              disabled
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {(() => {
                const remark = project?.remark_project || "";
                const match = remark.match(/\((\d+\/\d+)\)/);
                return match ? `APPROVED (${match[1]})` : "APPROVED";
              })()}
            </button>
          ) : project?.status === "Submitted" ||
            project?.status === "Waiting Project Approval" ? (
            <button
              className="btn btn-secondary text-xs sm:text-sm md:text-base w-full sm:w-auto"
              disabled
            >
              WAITING APPROVAL
            </button>
          ) : project?.status === "Draft" ? (
            <Link
              href={`/user/myproject/edit/${project.id}`}
              className="btn btn-warning text-xs sm:text-sm md:text-base w-full sm:w-auto"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              BUKA LOWONGAN
            </Link>
          ) : project?.status === "Open" ? (
            <button
              onClick={handleSubmitDirmawa}
              className="btn btn-accent text-xs sm:text-sm md:text-base w-full sm:w-auto"
            >
              AJUKAN KE DIRMAWA
            </button>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default ViewProjectPage;
