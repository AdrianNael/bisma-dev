import React, { useState } from "react";
import Link from "next/link";
import {
  IoPencilOutline,
  IoSearchOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { BsFillPeopleFill } from "react-icons/bs";
import { AiOutlineClose } from "react-icons/ai";
import Swal from "sweetalert2";
import { showLoading, showSuccess, showError } from "@/src/utils/swalHelper";
import { getStatusBadgeClassName } from "@/src/constants/badge";

function formatDate(d?: string | Date | null): string {
  if (!d) return "-";
  const dt =
    typeof d === "string" || d instanceof Date
      ? new Date(d)
      : new Date(String(d));
  if (isNaN(dt.getTime())) return "-";
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return dt.toLocaleDateString("id-ID", opts);
}

type Props = {
  data: Array<Record<string, unknown>>;
  category: Array<{ id: number; kategori: string }>;
  filter: string;
  onDelete: (id: number) => void;
  onSubmitTimesheet?: (
    projectId: number,
    projectName: string,
    totalInsentif: number,
    periode?: string,
  ) => Promise<void>;
  currentPage: number;
  perPage: number;
  paymentData?: Array<Record<string, unknown>>;
};

const ProjectTable: React.FC<Props> = ({
  data,
  category,
  filter: _filter,
  onDelete,
  onSubmitTimesheet,
  currentPage,
  perPage,
  paymentData = [],
}) => {
  // Helper function to get total_tagihan from payment for a project
  const getPaymentTotalTagihan = (projectId: number): number | null => {
    const payment = paymentData.find(
      (p: any) => Number(p.id_tmst_project) === Number(projectId),
    );
    return payment ? Number((payment as any).total_tagihan) || null : null;
  };

  // Helper function to calculate realized incentive from payments
  const getReceivedInsentif = (projectId: number): number => {
    // Find all payments for this project
    const relatedPayments = paymentData.filter(
      (p: any) => Number(p.id_tmst_project) === Number(projectId),
    );

    // Sum total_tagihan from all related payments
    return relatedPayments.reduce((sum: number, p: any) => {
      return sum + (Number(p.total_tagihan) || 0);
    }, 0);
  };

  // Helper function to check if timesheet status is "Approved" for a project
  const getTimesheetStatus = (projectId: number): string | null => {
    const payment = paymentData.find(
      (p: any) => p.id_tmst_project === projectId || p.id_project === projectId,
    );
    return payment ? String((payment as any).status || "") : null;
  };

  // Check if both project status and timesheet status are "Approved"
  // Also show if project is "Need Revision" AND timesheet is "Approved" (re-submission flow)
  // For crossing-year grouped projects: show Ajukan if any grouped split has approved months
  const shouldShowAjukan = (
    projectStatus: string,
    projectId: number,
    groupedProjects?: Array<any>,
  ): boolean => {
    // Only show Ajukan for Project Approved or Need Revision statuses
    const isAllowedStatus =
      projectStatus === "Project Approved" || projectStatus === "Need Revision";

    if (!isAllowedStatus) return false;

    const timesheetStatus = getTimesheetStatus(projectId);
    const baseCondition = timesheetStatus === "Approved";

    if (baseCondition) return true;

    // If groupedProjects provided (crossing-year), check if any split has approved payment
    if (Array.isArray(groupedProjects) && groupedProjects.length > 0) {
      const anyApprovedInGroup = groupedProjects.some((g) => {
        const gid = Number(g.id);
        if (!gid) return false;
        const found = paymentData.some((p: any) => {
          const pid = Number(p.id_tmst_project ?? p.id_project ?? 0);
          if (pid !== gid) return false;
          const st = String(p.status || "");
          const idst = Number(p.id_status || 0);
          return /approved/i.test(st) || idst === 1;
        });
        return found;
      });
      if (anyApprovedInGroup) return true;
    }

    return false;
  };
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleMouseEnter = (index: number) => setHoveredRow(index);
  const handleMouseLeave = () => setHoveredRow(null);

  const toggleExpand = (i: number) =>
    setExpandedIndex((prev) => (prev === i ? null : i));

  const handleAjukanClick = async (
    projectId: number,
    projectName: string,
    totalInsentif: number,
    tanggalMulai?: string | Date | null,
    tanggalSelesai?: string | Date | null,
    tanggalMulaiProject?: string | Date | null,
    tanggalSelesaiProject?: string | Date | null,
    groupedProjects?: Array<any>,
  ) => {
    if (!onSubmitTimesheet) return;

    // Build month options from paymentData where timesheet/payment status is Approved
    const buildApprovedMonthOptions = () => {
      const set = new Set<string>();
      const groupedIds =
        Array.isArray(groupedProjects) && groupedProjects.length > 0
          ? groupedProjects.map((g) => Number(g.id)).filter(Boolean)
          : [projectId];

      paymentData.forEach((p: any) => {
        const pid = Number(p.id_tmst_project ?? p.id_project ?? 0);
        if (!groupedIds.includes(pid)) return;
        const st = String(p.status || "");
        const idst = Number(p.id_status || 0);
        // Treat id_status === 1 as Approved (and optionally 2 as Complete if needed)
        if (/approved/i.test(st) || idst === 1) {
          const periode = String(p.periode || "");
          if (periode) {
            // normalize YYYY-M to YYYY-MM
            const parts = periode.split("-");
            if (parts.length === 2) {
              const y = parts[0];
              const m = String(parts[1]).padStart(2, "0");
              set.add(`${y}-${m}`);
            }
          }
        }
      });

      // Return options object { 'YYYY-MM': 'Month YYYY' }
      const options: { [key: string]: string } = {};
      Array.from(set)
        .sort()
        .forEach((peri) => {
          const [y, m] = peri.split("-").map((v) => Number(v));
          if (!y || !m) return;
          const temp = new Date(y, m - 1, 1);
          const label = temp.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          });
          options[peri] = label;
        });
      return options;
    };

    const monthOptions = buildApprovedMonthOptions();
    const monthKeys = Object.keys(monthOptions);
    if (monthKeys.length === 0) {
      await showError({
        title: "Tidak ada periode",
        text: "Tidak ditemukan periode timesheet yang berstatus Approved untuk project ini.",
      });
      return;
    }

    const selectHtml = `
  <select 
    id="swal-periode" 
    style="
      width: auto;
      min-width: 120px;
      padding: 4px 8px;
      padding-right: 32px;
      font-size: 14px;
      display: inline-block;
      vertical-align: middle;
      margin: 0 12px 0 4px;
      border-radius: 6px;
    "
  >
    ${monthKeys
      .map((k) => `<option value="${k}">${monthOptions[k]}</option>`)
      .join("")}
  </select>
`;

    const result = await Swal.fire({
      title: "Konfirmasi Pengajuan Timesheet",
      html: `<div style="font-size:15px; line-height:1.5">
  Ajukan timesheet <strong>${projectName}</strong> 
  untuk bulan ${selectHtml}?
  <br/>
  <span style="font-size:13px; color:#6B7280">
    Total: <strong>Rp${totalInsentif.toLocaleString("id-ID")}</strong>
  </span>
</div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#EAB308",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Ya, Ajukan",
      cancelButtonText: "Batal",
      reverseButtons: true,
      preConfirm: () => {
        const el = document.getElementById(
          "swal-periode",
        ) as HTMLSelectElement | null;
        if (!el || !el.value) {
          Swal.showValidationMessage("Anda harus memilih periode!");
          return null;
        }
        return el.value;
      },
    });

    if (result.isConfirmed && result.value) {
      try {
        showLoading({
          title: "Mengajukan...",
          text: "Mohon tunggu",
        });

        const selectedPeriode = result.value as string; // Format: YYYY-MM
        // If groupedProjects provided, find the split project id matching the selected periode
        let submitProjectId = projectId;
        if (Array.isArray(groupedProjects) && groupedProjects.length > 0) {
          const found = groupedProjects.find((g) => {
            if (g.periode === selectedPeriode) return true;
            if (g.tanggal_mulai && g.tanggal_selesai) {
              const startMonth = new Date(g.tanggal_mulai)
                .toISOString()
                .slice(0, 7);
              const endMonth = new Date(g.tanggal_selesai)
                .toISOString()
                .slice(0, 7);
              return (
                selectedPeriode >= startMonth && selectedPeriode <= endMonth
              );
            }
            // Fallback to start date only if end date missing
            if (g.tanggal_mulai) {
              return (
                new Date(g.tanggal_mulai).toISOString().slice(0, 7) ===
                selectedPeriode
              );
            }
            return false;
          });

          if (found) {
            submitProjectId = found.id;
          } else {
            // Additional check: maybe try checking purely by year if months span widely?
            // But usually splits are per year anyway.
            await showError({
              title: "Gagal!",
              text: "No project record found for this period.",
            });
            return;
          }
        }

        await onSubmitTimesheet(
          submitProjectId,
          projectName,
          totalInsentif,
          selectedPeriode,
        );

        await showSuccess({
          title: "Berhasil!",
          text: "Timesheet berhasil diajukan untuk approval.",
        });

        // Reload page to refresh data
        window.location.reload();
      } catch (error: any) {
        await showError({
          title: "Gagal!",
          text:
            error?.message || "Terjadi kesalahan saat mengajukan timesheet.",
        });
      }
    }
  };

  // Desktop table view (md+), Mobile accordion view (block md:hidden)
  return (
    <div className="w-full">
      {/* Mobile / small screens: accordion/cards */}
      <div className="block md:hidden space-y-3">
        {!data || data.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Data pencarian tidak ditemukan
          </div>
        ) : (
          data.map((value, index: number) => {
            const _rowNo = (currentPage - 1) * perPage + (index + 1);
            const id = Number(value.id ?? value.id_project ?? 0);

            const tMulai = formatDate(
              (value as any).tanggal_mulai_project ||
                ((value as any).tanggal_mulai as string | Date | null),
            );
            const tSelesai = formatDate(
              (value as any).tanggal_selesai_project ||
                ((value as any).tanggal_selesai as string | Date | null),
            );
            const pMulai = formatDate(
              (value as any).pendaftaran_mulai as string | Date | null,
            );
            const pSelesai = formatDate(
              (value as any).pendaftaran_selesai as string | Date | null,
            );
            // Get estimation first
            const estimationDisplay = Number(
              value.totalIntensifDisplay ?? value.totalEstimasi ?? 0,
            );
            // Pure actual from timesheets (for crossing year when totalIntensifDisplay = 0)
            const actualFromTimesheets = Number(
              (value as any).totalAktualTimesheets ?? 0,
            );
            const isCrossingYear =
              !!(value as any).project_group_id ||
              !!(value as any).grouped_project_ids;

            const statusText = String(value.status ?? "").replace(/_/g, " ");
            const isProjectApproved = /project approved|^approved$/i.test(
              statusText,
            );
            const totalMonthsVal = Number((value as any).totalMonths || 0);
            const completeMonthsVal = Number(
              (value as any).completeMonths || 0,
            );
            // Show completed months as numerator: admin approval marks periods COMPLETE
            const displayStatus =
              isProjectApproved && totalMonthsVal > 1
                ? `Project Approved ${completeMonthsVal}/${totalMonthsVal}`
                : statusText;
            const isCompleted = statusText === "Completed";
            const isWaitingTimesheetApproval =
              statusText === "Waiting Timesheet Approval";
            const isNeedRevision = statusText === "Need Revision";

            // Get total from payment when status is Waiting Timesheet Approval or Need Revision
            const paymentTotal = getPaymentTotalTagihan(id);
            const receivedInsentif = isCompleted ? getReceivedInsentif(id) : 0;

            // Determine which total to display:
            // - Completed: use received insentif from payment
            // - Waiting Timesheet Approval / Need Revision: use total_tagihan from payment
            // - For crossing year: prioritize actual timesheet, fallback to estimation if actual = 0
            // - Otherwise: use estimation
            let totalDisplay = estimationDisplay;
            if (isCompleted && receivedInsentif > 0) {
              totalDisplay = receivedInsentif;
            } else if (isWaitingTimesheetApproval || isNeedRevision) {
              // Prioritize actual timesheet total (all months) over payment total_tagihan (1 period only)
              if (actualFromTimesheets > 0) {
                totalDisplay = actualFromTimesheets;
              } else if (paymentTotal) {
                totalDisplay = paymentTotal;
              }
            } else if (isCrossingYear) {
              // For crossing year: prioritize actual, use estimation only if actual = 0
              totalDisplay =
                actualFromTimesheets > 0
                  ? actualFromTimesheets
                  : estimationDisplay;
            }

            const kategoriNama =
              category.find(
                (cat) => Number(cat.id) === Number(value.id_kategori),
              )?.kategori ?? "-";

            return (
              <div
                key={`${id}-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(index)}
                  className="w-full text-left p-4 flex items-center justify-between bg-[#F5F9F8]"
                >
                  <div>
                    <div className="text-sm font-semibold">
                      {(value as any).nama
                        ? String((value as any).nama).substring(
                            0,
                            String((value as any).nama).lastIndexOf(" - "),
                          ) || String((value as any).nama)
                        : ""}
                    </div>
                    <div className="text-xs text-gray-600">{kategoriNama}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={getStatusBadgeClassName(
                        String(value.status ?? "").replace(/_/g, " "),
                        "text-xs",
                      )}
                    >
                      {displayStatus}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      Apply: {Number(value.applyCount || 0)}
                    </div>
                  </div>
                </button>

                <div
                  className={`${expandedIndex === index ? "block" : "hidden"} p-4 bg-white`}
                >
                  <div className="mb-2 text-sm">
                    <strong>Tanggal Pelaksanaan:</strong> {tMulai} - {tSelesai}
                  </div>
                  <div className="mb-2 text-sm">
                    <strong>Tanggal Pendaftaran:</strong> {pMulai} - {pSelesai}
                  </div>
                  <div className="mb-2 text-sm">
                    <strong>
                      {String(value.status) === "Completed"
                        ? "Total Insentif:"
                        : "Total Estimasi Insentif:"}
                    </strong>{" "}
                    {totalDisplay > 0
                      ? `Rp${totalDisplay.toLocaleString("id-ID")}`
                      : "Rp0"}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Link
                      href={`/user/myproject/${id}/applications`}
                      className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-yellow-400 text-green-700 "
                    >
                      Pelamar ({Number(value.applyCount || 0)})
                    </Link>
                    {isCompleted ? (
                      <Link
                        href={`/user/myproject/view/${id}`}
                        className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                        title="Lihat"
                      >
                        <IoSearchOutline className="text-xl" />
                      </Link>
                    ) : shouldShowAjukan(
                        statusText,
                        id,
                        (value as any).grouped_projects || [],
                      ) ? (
                      <>
                        <Link
                          href={`/user/myproject/view/${id}`}
                          className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                          title="Lihat"
                        >
                          <IoSearchOutline className="text-xl" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            handleAjukanClick(
                              id,
                              String(
                                (value as any).nama
                                  ? String((value as any).nama).substring(
                                      0,
                                      String((value as any).nama).lastIndexOf(
                                        " - ",
                                      ),
                                    ) || String((value as any).nama)
                                  : "",
                              ),
                              totalDisplay,
                              (value as any).tanggal_mulai,
                              (value as any).tanggal_selesai,
                              (value as any).tanggal_mulai_project,
                              (value as any).tanggal_selesai_project,
                              (value as any).grouped_projects || [],
                            )
                          }
                          className="bg-yellow-400 hover:bg-yellow-500 text-green-700 font-semibold py-2 px-4 rounded shadow"
                          title="Ajukan"
                        >
                          Ajukan
                        </button>
                      </>
                    ) : statusText === "Waiting Timesheet Approval" ||
                      statusText === "Waiting Project Approval" ||
                      statusText === "Need Revision" ? (
                      <Link
                        href={`/user/myproject/view/${id}`}
                        className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                        title="Lihat"
                      >
                        <IoSearchOutline className="text-xl" />
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/user/myproject/view/${id}`}
                          className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                          title="Lihat"
                        >
                          <IoSearchOutline className="text-xl" />
                        </Link>
                        {!isProjectApproved && (
                          <>
                            <Link
                              href={`/user/myproject/edit/${id}`}
                              className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                              title="Edit"
                            >
                              <IoPencilOutline className="text-xl" />
                            </Link>
                            <button
                              onClick={() => onDelete(id)}
                              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded shadow"
                              title="Hapus"
                            >
                              <IoTrashOutline className="text-xl" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block">
        <div className="flex justify-center">
          <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
            <thead>
              <tr className="bg-transparent border-b border-gray-200 shadow-md">
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  No.
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Nama Kegiatan
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Jenis Kegiatan
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Tanggal Pendaftaran
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Tanggal Pelaksanaan
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Total Insentif
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Apply
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Status
                </th>
                <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-4 px-6 text-gray-500">
                    Data pencarian tidak ditemukan
                  </td>
                </tr>
              ) : (
                data.map((value, index: number) => {
                  const rowNo = (currentPage - 1) * perPage + (index + 1);
                  const id = Number(value.id ?? value.id_project ?? 0);
                  const tMulai = formatDate(
                    (value as any).tanggal_mulai_project ||
                      ((value as any).tanggal_mulai as string | Date | null),
                  );
                  const tSelesai = formatDate(
                    (value as any).tanggal_selesai_project ||
                      ((value as any).tanggal_selesai as string | Date | null),
                  );
                  const pMulai = formatDate(
                    (value as any).pendaftaran_mulai as string | Date | null,
                  );
                  const pSelesai = formatDate(
                    (value as any).pendaftaran_selesai as string | Date | null,
                  );
                  // Get estimation first
                  const estimationDisplay = Number(
                    value.totalIntensifDisplay ?? value.totalEstimasi ?? 0,
                  );
                  // Pure actual from timesheets (for crossing year when totalIntensifDisplay = 0)
                  const actualFromTimesheets = Number(
                    (value as any).totalAktualTimesheets ?? 0,
                  );
                  const isCrossingYear =
                    !!(value as any).project_group_id ||
                    !!(value as any).grouped_project_ids;

                  const statusText = String(value.status ?? "").replace(
                    /_/g,
                    " ",
                  );
                  // normalize approved check for project
                  const isProjectApproved = /project approved|^approved$/i.test(
                    statusText,
                  );
                  // If status is "Completed", try to get realized incentive from payments
                  const isCompleted = statusText === "Completed";
                  const receivedInsentif = isCompleted
                    ? getReceivedInsentif(id)
                    : 0;

                  // Check if waiting timesheet approval or need revision - show from payment total_tagihan
                  const isWaitingTimesheetApprovalDesktop =
                    statusText === "Waiting Timesheet Approval";
                  const isNeedRevisionDesktop = statusText === "Need Revision";
                  const paymentTotalDesktop = getPaymentTotalTagihan(id);

                  // New helper: Sum total_tagihan for grouped projects
                  const getGroupedTotalTagihan = (
                    pid: number,
                    groups: any[],
                  ): number => {
                    const allIds = new Set<number>();
                    allIds.add(pid);
                    if (Array.isArray(groups)) {
                      groups.forEach((g) => allIds.add(Number(g.id)));
                    }

                    let sum = 0;
                    allIds.forEach((currId) => {
                      const p = paymentData.find(
                        (pay: any) =>
                          Number(pay.id_tmst_project ?? pay.id_project) ===
                          Number(currId),
                      );
                      if (p) {
                        sum += Number((p as any).total_tagihan) || 0;
                      }
                    });
                    return sum;
                  };

                  const groupedTotalTagihan = getGroupedTotalTagihan(
                    id,
                    (value as any).grouped_projects || [],
                  );

                  let totalDisplay = estimationDisplay;
                  if (isCompleted && receivedInsentif > 0) {
                    totalDisplay = receivedInsentif;
                  } else if (
                    isWaitingTimesheetApprovalDesktop ||
                    isNeedRevisionDesktop
                  ) {
                    // Prioritize actual timesheet total (all months) over payment total_tagihan (1 period only)
                    if (actualFromTimesheets > 0) {
                      totalDisplay = actualFromTimesheets;
                    } else if (groupedTotalTagihan > 0) {
                      totalDisplay = groupedTotalTagihan;
                    } else if (paymentTotalDesktop) {
                      totalDisplay = paymentTotalDesktop;
                    }
                  } else if (isCrossingYear) {
                    // For crossing year: prioritize actual, use estimation only if actual = 0
                    totalDisplay =
                      actualFromTimesheets > 0
                        ? actualFromTimesheets
                        : estimationDisplay;
                  }

                  const members: Array<{ id?: string; nama?: string }> =
                    Array.isArray((value as any).members)
                      ? (value as any).members
                      : [];
                  const kategoriNama =
                    category.find(
                      (cat) => Number(cat.id) === Number(value.id_kategori),
                    )?.kategori ?? "-";

                  return (
                    <tr
                      key={`${id}-${index}`}
                      className="border-b border-gray-300 relative"
                    >
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        {rowNo}
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-black text-xs md:text-sm">
                            {(value as any).nama
                              ? String((value as any).nama).substring(
                                  0,
                                  String((value as any).nama).lastIndexOf(
                                    " - ",
                                  ),
                                ) || String((value as any).nama)
                              : ""}
                          </span>
                          <span className="text-xs md:text-sm text-black flex items-center justify-center gap-2">
                            Mahasiswa
                            <div
                              className="relative flex items-center"
                              onMouseEnter={() => handleMouseEnter(index)}
                              onMouseLeave={handleMouseLeave}
                            >
                              <BsFillPeopleFill className="text-base md:text-lg" />
                              {hoveredRow === index && (
                                <div className="absolute left-0 top-6 bg-[#FEF3C7] p-2 rounded-lg shadow-lg z-10 text-left min-w-[220px] text-xs md:text-sm">
                                  {members.length > 0 ? (
                                    members.map((m, i) => (
                                      <div
                                        key={`${m.id}-${i}`}
                                        className="whitespace-nowrap"
                                      >
                                        {m.nama ?? "-"}
                                        {m.id ? ` (${m.id})` : ""}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex items-center gap-2 text-amber-700">
                                      <AiOutlineClose /> Belum ada mahasiswa
                                      disetujui
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </span>
                        </div>
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        {kategoriNama}
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        {pMulai} - {pSelesai}
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        {tMulai} - {tSelesai}
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        {totalDisplay > 0
                          ? `Rp${totalDisplay.toLocaleString("id-ID")}`
                          : "Rp0"}
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6">
                        <Link
                          href={`/user/myproject/${id}/applications`}
                          className="inline-flex items-center justify-center min-w-10 px-2 md:px-3 py-1 rounded-md bg-yellow-400 text-green-700 font-semibold hover:bg-yellow-500 hover:text-green-800 transition-all duration-200 text-xs md:text-sm"
                          title="Lihat pelamar"
                        >
                          {Number(value.applyCount || 0)}
                        </Link>
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                        <span
                          className={getStatusBadgeClassName(
                            String(value.status ?? "").replace(/_/g, " "),
                          )}
                        >
                          {/project approved|^approved$/i.test(statusText) &&
                          Number((value as any).totalMonths || 0) > 1
                            ? `Project Approved ${Number((value as any).completeMonths || 0)}/${Number((value as any).totalMonths || 0)}`
                            : statusText}
                        </span>
                      </td>
                      <td className="py-2 md:py-4 px-3 md:px-6 flex justify-center gap-1 md:gap-2 text-black">
                        {isCompleted ? (
                          <Link
                            href={`/user/myproject/view/${id}`}
                            className="bg-white hover:bg-gray-100 text-black font-semibold py-1 md:py-2 px-2 md:px-4 border border-gray-400 rounded shadow"
                            title="Lihat"
                          >
                            <IoSearchOutline className="text-base md:text-lg" />
                          </Link>
                        ) : shouldShowAjukan(
                            statusText,
                            id,
                            (value as any).grouped_projects || [],
                          ) ? (
                          <>
                            <Link
                              href={`/user/myproject/view/${id}`}
                              className="bg-white hover:bg-gray-100 text-black font-semibold py-1 md:py-2 px-2 md:px-4 border border-gray-400 rounded shadow"
                              title="Lihat"
                            >
                              <IoSearchOutline className="text-base md:text-lg" />
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                handleAjukanClick(
                                  id,
                                  String(
                                    (value as any).nama
                                      ? String((value as any).nama).substring(
                                          0,
                                          String(
                                            (value as any).nama,
                                          ).lastIndexOf(" - "),
                                        ) || String((value as any).nama)
                                      : "",
                                  ),
                                  totalDisplay,
                                  (value as any).tanggal_mulai,
                                  (value as any).tanggal_selesai,
                                  (value as any).tanggal_mulai_project,
                                  (value as any).tanggal_selesai_project,
                                  (value as any).grouped_projects || [],
                                )
                              }
                              className="bg-yellow-400 hover:bg-yellow-500 text-green-700 font-semibold py-1 md:py-2 px-2 md:px-4 rounded shadow"
                              title="Ajukan"
                            >
                              Ajukan
                            </button>
                          </>
                        ) : statusText === "Waiting Timesheet Approval" ||
                          statusText === "Waiting Project Approval" ||
                          statusText === "Need Revision" ? (
                          <Link
                            href={`/user/myproject/view/${id}`}
                            className="bg-white hover:bg-gray-100 text-black font-semibold py-1 md:py-2 px-2 md:px-4 border border-gray-400 rounded shadow"
                            title="Lihat"
                          >
                            <IoSearchOutline className="text-base md:text-lg" />
                          </Link>
                        ) : (
                          <>
                            <Link
                              href={`/user/myproject/view/${id}`}
                              className="bg-white hover:bg-gray-100 text-black font-semibold py-1 md:py-2 px-2 md:px-4 border border-gray-400 rounded shadow"
                              title="Lihat"
                            >
                              <IoSearchOutline className="text-base md:text-lg" />
                            </Link>
                            {!isProjectApproved && (
                              <>
                                <Link
                                  href={`/user/myproject/edit/${id}`}
                                  className="bg-white hover:bg-gray-100 text-black font-semibold py-1 md:py-2 px-2 md:px-4 border border-gray-400 rounded shadow"
                                  title="Edit"
                                >
                                  <IoPencilOutline className="text-base md:text-lg" />
                                </Link>
                                <button
                                  onClick={() => onDelete(id)}
                                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 md:py-2 px-2 md:px-4 rounded shadow"
                                  title="Hapus"
                                >
                                  <IoTrashOutline className="text-base md:text-lg" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectTable;
