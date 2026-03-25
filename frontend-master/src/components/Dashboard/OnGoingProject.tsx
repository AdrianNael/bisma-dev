import React, { useEffect, useState, useMemo } from "react";
import { BsFillPeopleFill } from "react-icons/bs";
import { AiOutlineClose } from "react-icons/ai";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

type Project = {
  id: number;
  nama?: string;
  tanggal_mulai?: string | Date;
  tanggal_selesai?: string | Date;
  // Backend also returns original planned dates (before timesheet-date override)
  tanggal_mulai_project?: string | Date;
  tanggal_selesai_project?: string | Date;
};

type ProjectDisplay = Project & {
  _displayStart?: Date;
  _displayEnd?: Date;
  _crossingYear?: boolean;
  _uniqueKey?: string;
};

const ITEMS_PER_PAGE = 5;

function parseDate(d: string | Date | undefined | null): Date | null {
  if (!d) return null;
  if (typeof d === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const dt = new Date(d as any);
  return isNaN(dt.getTime()) ? null : dt;
}

const OnGoingProject = ({ userId }: { userId?: string | number }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [membersMap, setMembersMap] = useState<Record<number, any[]>>({});
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

  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const url = userId
          ? `${API_ENDPOINT}/api/masterProject/myproject/${userId}?size=50`
          : `${API_ENDPOINT}/api/masterProject?size=100`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch projects");
        const json = await res.json();
        const list = json?.data?.data || json?.data || [];
        const ongoingStatuses = [
          "Waiting Timesheet Approval",
          "Project Approved",
          "Need Revision",
        ];
        setProjects(
          (list || []).filter((p: any) =>
            ongoingStatuses.includes(String(p.status).trim()),
          ),
        );
      } catch (err) {
        console.error(err);
        setProjects([]);
      }
    };
    fetchApproved();
  }, [API_ENDPOINT, userId]);

  // Filter by search term
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    return projects.filter((p) =>
      p.nama?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [projects, searchTerm]);

  /**
   * For crossing-year projects, only show the "ongoing" (later-year) portion.
   * e.g. Dec 15, 2026 – Feb 15, 2027  →  show as Jan 1, 2027 – Feb 15, 2027
   * (Dec portion is "done" and handled by Finished Project)
   */
  const displayProjects = useMemo((): ProjectDisplay[] => {
    return filteredProjects.map((p) => {
      // Use the original *planned* project dates for crossing-year detection.
      // The backend overrides tanggal_mulai/selesai with last-timesheet dates,
      // but preserves the planned dates in tanggal_mulai_project / tanggal_selesai_project.
      const start = parseDate(p.tanggal_mulai_project || p.tanggal_mulai);
      const end = parseDate(p.tanggal_selesai_project || p.tanggal_selesai);
      const startYear = start?.getFullYear() ?? new Date().getFullYear();
      const endYear = end?.getFullYear() ?? startYear;

      if (startYear < endYear) {
        // Crossing-year: show only the "end-year" slice (Jan 1 of end year → planned selesai)
        return {
          ...p,
          _displayStart: new Date(endYear, 0, 1),
          _displayEnd: end ?? undefined,
          _crossingYear: true,
          _uniqueKey: `${p.id}`,
        };
      }
      return { ...p, _uniqueKey: `${p.id}` };
    });
  }, [filteredProjects]);

  // Pagination
  const totalPages = Math.ceil(displayProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [displayProjects, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleMouseEnter = async (key: string, projectId: number) => {
    setHoveredRow(key);
    if (membersMap[projectId]) return;
    try {
      const res = await fetch(
        `${API_ENDPOINT}/api/masterProject/${projectId}/applicants`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setMembersMap((prev) => ({ ...prev, [projectId]: json?.data || [] }));
    } catch (e) {
      console.error(e);
      setMembersMap((prev) => ({ ...prev, [projectId]: [] }));
    }
  };

  const handleMouseLeave = () => setHoveredRow(null);

  return (
    <div className="rounded-lg bg-slate-50 h-full min-h-[20rem] md:min-h-[24rem] shadow-lg shadow-gray-500 overflow-hidden flex flex-col">
      <div className="flex flex-col sm:flex-row w-full backdrop-blur-md p-4 shadow-sm sticky top-0 justify-between bg-slate-50 z-10 gap-2">
        <div className="text-base md:text-lg font-semibold leading-7">
          On Going Project
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-sm input-bordered w-full sm:w-40 text-sm"
        />
      </div>
      <div className="px-4 overflow-y-auto flex-1">
        {displayProjects.length === 0 ? (
          <p className="text-sm text-gray-500">
            {searchTerm
              ? "Tidak ada project ditemukan"
              : "Tidak ada project berjalan"}
          </p>
        ) : (
          paginatedProjects.map((p, i) => {
            const key = p._uniqueKey ?? `${p.id}-${i}`;
            const dispStart = p._displayStart ?? parseDate(p.tanggal_mulai);
            const dispEnd = p._displayEnd ?? parseDate(p.tanggal_selesai);
            return (
              <dl
                key={key}
                className="flex flex-row gap-4 md:gap-6 py-3 md:py-4 border-2 rounded-lg p-2 my-3 md:my-4"
              >
                <div className="border-4 border-lime-600 rounded-full w-8 h-8 md:w-10 md:h-10 flex justify-center items-center flex-shrink-0">
                  {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="relative flex items-center"
                      onMouseEnter={() => handleMouseEnter(key, p.id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <BsFillPeopleFill className="text-base md:text-lg" />
                      {hoveredRow === key && (
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
                              <AiOutlineClose /> Belum ada mahasiswa
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="mb-1 font-semibold text-sm md:text-base flex items-center gap-1">
                        {userId && p.nama ? p.nama.split(" - ")[0] : p.nama}
                      </div>
                      <div className="text-xs md:text-sm text-gray-500">
                        {formatDate(dispStart)}
                        {dispEnd ? ` – ${formatDate(dispEnd)}` : ""}
                      </div>
                    </div>
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

export default OnGoingProject;
