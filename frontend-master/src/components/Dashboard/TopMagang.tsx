import React, { useEffect, useState, useMemo } from "react";
import { BsFillPeopleFill, BsCurrencyDollar } from "react-icons/bs";
import { AiOutlineClose } from "react-icons/ai";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

type Project = {
  id: number;
  nama?: string;
  tanggal_mulai?: string | Date;
  tanggal_selesai?: string | Date;
  status?: string;
  // Original planned dates (backend may override mulai/selesai with last-timesheet dates)
  tanggal_mulai_project?: string | Date;
  tanggal_selesai_project?: string | Date;
};

type ProjectDisplay = Project & {
  _displayStart?: Date;
  _displayEnd?: Date;
  _crossingYear?: boolean;
  _uniqueKey: string;
};

type IncentiveData = {
  totalEstimasi: number;
  totalAktual: number;
};

const ITEMS_PER_PAGE = 5;

const ONGOING_STATUSES = [
  "Waiting Timesheet Approval",
  "Waiting Project Approval",
  "Project Approved",
  "Need Revision",
];

function parseDate(d: string | Date | undefined | null): Date | null {
  if (!d) return null;
  if (typeof d === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const dt = new Date(d as any);
  return isNaN(dt.getTime()) ? null : dt;
}

const TopMagang = ({ userId }: { userId?: string | number }) => {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredDollar, setHoveredDollar] = useState<string | null>(null);
  const [membersMap, setMembersMap] = useState<Record<number, any[]>>({});
  const [incentiveMap, setIncentiveMap] = useState<
    Record<number, IncentiveData>
  >({});
  const [loadingIncentive, setLoadingIncentive] = useState<
    Record<number, boolean>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const API_ENDPOINT =
    process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";

  const formatDate = (d: Date | null | undefined) => {
    if (!d) return "";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return String(d);
    }
  };

  // Fetch ALL projects (Completed + ongoing for crossing-year detection)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const url = userId
          ? `${API_ENDPOINT}/api/masterProject/myproject/${userId}?size=50`
          : `${API_ENDPOINT}/api/masterProject?size=100`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setAllProjects(json?.data?.data || json?.data || []);
      } catch (err) {
        console.error(err);
        setAllProjects([]);
      }
    };
    fetchAll();
  }, [API_ENDPOINT, userId]);

  /**
   * Build the "finished" list:
   * 1. Status = Completed projects
   * 2. Crossing-year ongoing projects → add the "previous-year" (Dec) slice
   */
  const finishedProjects = useMemo((): ProjectDisplay[] => {
    const result: ProjectDisplay[] = [];

    allProjects.forEach((p) => {
      // Use planned dates for crossing-year detection;
      // backend overrides tanggal_mulai/selesai with last-timesheet dates.
      const start = parseDate(p.tanggal_mulai_project || p.tanggal_mulai);
      const end = parseDate(p.tanggal_selesai_project || p.tanggal_selesai);
      const startYear = start?.getFullYear() ?? new Date().getFullYear();
      const endYear = end?.getFullYear() ?? startYear;

      if (String(p.status).trim() === "Completed") {
        result.push({ ...p, _uniqueKey: `${p.id}` });
      } else if (
        ONGOING_STATUSES.includes(String(p.status).trim()) &&
        start &&
        end &&
        startYear < endYear
      ) {
        // Crossing-year ongoing: add the "start-year" completed slice (mulai → Dec 31)
        result.push({
          ...p,
          _displayStart: start,
          _displayEnd: new Date(startYear, 11, 31),
          _crossingYear: true,
          _uniqueKey: `${p.id}-prev`,
        });
      }
    });

    return result;
  }, [allProjects]);

  // Filter by search
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return finishedProjects;
    return finishedProjects.filter((p) =>
      p.nama?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [finishedProjects, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fetch members on people-icon hover
  const handleMouseEnter = async (index: number, projectId: number) => {
    setHoveredRow(index);
    if (membersMap[projectId]) return;
    try {
      const res = await fetch(
        `${API_ENDPOINT}/api/masterProject/${projectId}/applicants`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch applicants");
      const json = await res.json();
      setMembersMap((prev) => ({ ...prev, [projectId]: json?.data || [] }));
    } catch (err) {
      console.error(err);
      setMembersMap((prev) => ({ ...prev, [projectId]: [] }));
    }
  };
  const handleMouseLeave = () => setHoveredRow(null);

  // Fetch incentive data from project detail on $ hover
  const handleDollarEnter = async (key: string, projectId: number) => {
    setHoveredDollar(key);
    if (incentiveMap[projectId] || loadingIncentive[projectId]) return;
    setLoadingIncentive((prev) => ({ ...prev, [projectId]: true }));
    try {
      const res = await fetch(
        `${API_ENDPOINT}/api/masterProject/${projectId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch project detail");
      const json = await res.json();
      const data = json?.data ?? {};
      const estimasi = Number(data.totalEstimasi ?? 0);
      const aktualArr: number[] = Array.isArray(data.insentif_aktual)
        ? data.insentif_aktual
        : [];
      const aktulsSum =
        aktualArr.length > 0
          ? aktualArr.reduce((s: number, v: any) => s + (Number(v) || 0), 0)
          : Number(data.totalAktual ?? 0);

      setIncentiveMap((prev) => ({
        ...prev,
        [projectId]: { totalEstimasi: estimasi, totalAktual: aktulsSum },
      }));
    } catch (err) {
      console.error(err);
      setIncentiveMap((prev) => ({
        ...prev,
        [projectId]: { totalEstimasi: 0, totalAktual: 0 },
      }));
    } finally {
      setLoadingIncentive((prev) => ({ ...prev, [projectId]: false }));
    }
  };
  const handleDollarLeave = () => setHoveredDollar(null);

  return (
    <div className="rounded-lg bg-slate-50 h-full min-h-[20rem] md:min-h-[24rem] p-4 shadow-lg shadow-gray-500 flex flex-col">
      <div className="flex flex-col sm:flex-row w-full backdrop-blur-md p-2 shadow-sm sticky top-0 justify-between bg-slate-50 z-10 gap-2">
        <div className="text-base md:text-lg font-semibold leading-7">
          Finished Project
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-sm input-bordered w-full sm:w-40 text-sm"
        />
      </div>
      <div className="px-2 overflow-y-auto flex-1">
        {paginatedProjects.length === 0 ? (
          <p className="text-sm text-gray-500">
            {searchTerm
              ? "Tidak ada project ditemukan"
              : "Tidak ada project selesai"}
          </p>
        ) : (
          paginatedProjects.map((p, i) => {
            const dispStart = p._displayStart ?? parseDate(p.tanggal_mulai);
            const dispEnd = p._displayEnd ?? parseDate(p.tanggal_selesai);
            const incentive = incentiveMap[p.id];
            return (
              <dl
                key={p._uniqueKey}
                className="flex flex-row gap-4 md:gap-6 py-3 md:py-4 border-2 rounded-lg p-2 my-3 md:my-4"
              >
                {/* Number circle */}
                <div className="border-4 border-lime-600 rounded-full w-8 h-8 md:w-10 md:h-10 flex justify-center items-center flex-shrink-0">
                  {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                </div>

                <div className="flex-1 flex items-center justify-between">
                  {/* Left: people icon + info */}
                  <div className="flex items-center gap-3">
                    <div
                      className="relative flex items-center"
                      onMouseEnter={() => handleMouseEnter(i, p.id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <BsFillPeopleFill className="text-base md:text-lg" />
                      {hoveredRow === i && (
                        <div className="absolute left-0 top-6 bg-[#FEF3C7] p-2 rounded-lg shadow-lg z-10 text-left min-w-[220px] text-xs md:text-sm">
                          {membersMap[p.id] && membersMap[p.id].length > 0 ? (
                            membersMap[p.id].map((m: any, idx: number) => {
                              const name = m.mahasiswa?.nama ?? m.nama ?? "-";
                              const mid =
                                m.mahasiswa?.id ?? m.tmst_pengguna?.id ?? null;
                              return (
                                <div
                                  key={`${mid ?? idx}-${idx}`}
                                  className="whitespace-nowrap"
                                >
                                  {name}
                                  {mid ? ` (${mid})` : ""}
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-center gap-2 text-amber-700">
                              <AiOutlineClose /> Belum ada mahasiswa disetujui
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="mb-1 font-semibold text-sm md:text-base flex items-center gap-1">
                        {userId && p.nama ? p.nama.split(" - ")[0] : p.nama}
                      </div>
                      <div className="text-xs md:text-sm">
                        {formatDate(dispStart)}
                        {dispEnd ? ` - ${formatDate(dispEnd)}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Right: dollar icon + incentive tooltip */}
                  <div
                    className="relative flex items-center ml-2 cursor-pointer flex-shrink-0"
                    onMouseEnter={() => handleDollarEnter(p._uniqueKey, p.id)}
                    onMouseLeave={handleDollarLeave}
                  >
                    <BsCurrencyDollar className="text-lg md:text-xl text-green-600 hover:text-green-800 transition-colors" />
                    {hoveredDollar === p._uniqueKey && (
                      <div
                        className={`absolute right-0 ${
                          i >= paginatedProjects.length - 1
                            ? "bottom-6"
                            : "top-6"
                        } bg-white border border-gray-200 p-3 rounded-lg shadow-xl z-20 text-left min-w-[200px] text-xs md:text-sm`}
                      >
                        <div className="font-semibold text-gray-700 mb-2 border-b pb-1">
                          Insentif
                        </div>
                        {loadingIncentive[p.id] ? (
                          <div className="flex items-center gap-2 text-gray-400">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                            Memuat...
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Estimasi</span>
                              <span className="font-medium text-blue-700 whitespace-nowrap">
                                Rp{" "}
                                {(incentive?.totalEstimasi ?? 0).toLocaleString(
                                  "id-ID",
                                )}
                                ,-
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Aktual</span>
                              <span className="font-medium text-green-700 whitespace-nowrap">
                                Rp{" "}
                                {(incentive?.totalAktual ?? 0).toLocaleString(
                                  "id-ID",
                                )}
                                ,-
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </dl>
            );
          })
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3 border-t bg-slate-50">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn btn-xs btn-ghost disabled:opacity-50"
          >
            <MdChevronLeft className="text-lg" />
          </button>
          <span className="text-xs text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-xs btn-ghost disabled:opacity-50"
          >
            <MdChevronRight className="text-lg" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TopMagang;
