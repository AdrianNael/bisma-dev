import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import CryptoJS from "crypto-js";
import { BsFillPeopleFill } from "react-icons/bs";
import { AiOutlineClose } from "react-icons/ai";
import { MdExpandMore, MdExpandLess } from "react-icons/md";
import { getStatusBadgeClassName } from "@/src/constants/badge";

type Props = {
  timesheetData: any[];
  paymentData: any[];
};

const isValidDate = (d: Date) =>
  d instanceof Date && !Number.isNaN(d.getTime());

const statusStyles = (statusRaw: string | null | undefined) => {
  const status = (statusRaw || "Pending").toLowerCase();
  if (
    status.includes("complete") ||
    status.includes("finish") ||
    status.includes("approved")
  ) {
    return { label: "Selesai", bg: "bg-[#E2F4EF]", text: "text-[#0E6F5E]" };
  }
  if (
    status.includes("progress") ||
    status.includes("submit") ||
    status.includes("pending") ||
    status.includes("waiting payment")
  ) {
    return {
      label: "Dalam Proses",
      bg: "bg-[#DBEAFE]",
      text: "text-[#2563EB]",
    };
  }
  return { label: "Pending", bg: "bg-[#FEF3C7]", text: "text-[#92400E]" };
};

/**
 * Determine the display status for a timesheet row.
 * Priority: if payment is "Complete" → show "Complete".
 * Otherwise, use the backend-computed item.status which considers ALL assigned students.
 */
const getDisplayStatus = (item: any, matchedPayment: any): string => {
  const paymentStatus = matchedPayment?.status;
  // If payment is finalized (Complete), always show that
  if (paymentStatus && paymentStatus.toLowerCase().includes("complete")) {
    return paymentStatus;
  }
  // Use backend-computed status that checks all assigned students
  const timesheetStatus = item?.status;
  if (timesheetStatus) {
    // Map backend status values to display labels
    const statusMap: Record<string, string> = {
      approved: "Approved",
      waiting: "Submitted",
      // backend may return several variants — map them explicitly
      revision: "On Revision",
      "revision required": "On Revision",
      revised: "Revised",
    };
    return statusMap[timesheetStatus.toLowerCase()] || timesheetStatus;
  }
  // Fallback to payment status or default
  return paymentStatus || "Submitted";
};

const formatDateRange = (
  startDateString: string,
  endDateString: string,
): string => {
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);
  if (!isValidDate(startDate) || !isValidDate(endDate))
    return "Tanggal tidak valid";
  return `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`;
};

const _formatLastUpdated = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (!isValidDate(date)) return "-";
  return format(date, "dd MMM yyyy");
};

const SubmitPaymentTable: React.FC<Props> = ({
  timesheetData,
  paymentData,
}) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!Array.isArray(timesheetData) || timesheetData.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Mobile Accordion View */}
      <div className="block md:hidden space-y-3">
        {timesheetData.map((item, index) => {
          const date = new Date(item.tanggal_mulai);
          if (!isValidDate(date)) return null;

          const formattedPeriod = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
          const secretKey = "my-secret-key";
          // Use id_project (tran_project.id) for navigation
          const tranProjectId = item.id_project; // This is the actual tran_project.id
          const encryptedProjectId = CryptoJS.AES.encrypt(
            tranProjectId.toString(),
            secretKey,
          ).toString();
          const encryptedDate = CryptoJS.AES.encrypt(
            formattedPeriod,
            secretKey,
          ).toString();

          // Use first student ID from the data for navigation
          // This is needed because the view page fetches project data filtered by student ID
          const firstStudentId =
            Array.isArray(item.nim) && item.nim.length > 0 ? item.nim[0] : "";
          const userIdForEncryption = firstStudentId;

          const encryptedUserId = CryptoJS.AES.encrypt(
            userIdForEncryption.toString(),
            secretKey,
          ).toString();
          const encodedProjectId = encodeURIComponent(encryptedProjectId);
          const encodedDate = encodeURIComponent(encryptedDate);
          const encodedUserId = encodeURIComponent(encryptedUserId);

          const matchedPayment = paymentData.find(
            (payment: any) =>
              payment.id_tmst_project === item.id_tmst_project &&
              payment.periode === formattedPeriod,
          );

          const studentCount = Array.isArray(item.nama) ? item.nama.length : 0;
          const students = Array.isArray(item.nama)
            ? item.nama.map((nama: string, idx: number) => ({
                name: nama,
                nim: Array.isArray(item.nim) ? item.nim[idx] : item.nim,
              }))
            : [];

          return (
            <div
              key={`mobile-${item.id_project}-${index}-${formattedPeriod}`}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="w-full text-left p-4 flex items-center justify-between bg-[#F5F9F8]"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {item.nama_project?.includes(" - ")
                      ? item.nama_project.split(" - ")[0]
                      : item.nama_project}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {studentCount} Mahasiswa
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={getStatusBadgeClassName(
                      getDisplayStatus(item, matchedPayment),
                    )}
                  >
                    {getDisplayStatus(item, matchedPayment)}
                  </span>
                  {expandedIndex === index ? (
                    <MdExpandLess className="text-xl" />
                  ) : (
                    <MdExpandMore className="text-xl" />
                  )}
                </div>
              </button>

              {expandedIndex === index && (
                <div className="p-4 bg-white space-y-3 text-sm">
                  <div>
                    <strong className="text-gray-600">Tanggal:</strong>
                    <div className="mt-1">
                      {formatDateRange(
                        item.tanggal_mulai,
                        item.tanggal_selesai,
                      )}
                    </div>
                  </div>

                  <div>
                    <strong className="text-gray-600">
                      Mahasiswa ({studentCount}):
                    </strong>
                    <div className="mt-1 space-y-1">
                      {students.length > 0 ? (
                        students.map((m: any, i: number) => (
                          <div key={`${m.nim}-${i}`} className="text-xs">
                            {m.name ?? "-"}
                            {m.nim ? ` (${m.nim})` : ""}
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-amber-700 text-xs">
                          <AiOutlineClose className="h-3 w-3" /> Tidak ada
                          mahasiswa
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <strong className="text-gray-600">Status:</strong>
                    <div className="mt-1">
                      <span
                        className={getStatusBadgeClassName(
                          getDisplayStatus(item, matchedPayment),
                        )}
                      >
                        {getDisplayStatus(item, matchedPayment)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={{
                        pathname: `/user/timesheet/view/${item.id_tmst_project}`,
                        query: {
                          id_tran_project: encodedProjectId,
                          date: encodedDate,
                          userId: encodedUserId,
                        },
                      }}
                      as={`/user/timesheet/view/${item.id_tmst_project}?id_tran_project=${encodedProjectId}&date=${encodedDate}&userId=${encodedUserId}`}
                      className="inline-flex items-center justify-center w-full px-4 py-2 rounded-md bg-yellow-400 text-green-700 font-semibold hover:bg-yellow-500 hover:text-green-800 transition-all duration-200 text-sm"
                    >
                      View
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <table className="hidden md:table table-auto text-center w-full shadow-2xl bg-white rounded-lg text-xs md:text-sm">
        <thead>
          <tr className="shadow-2xl bg-[#F5F9F8] border-b border-gray-200  text-center">
            <th className="py-5 px-3 !bg-white md:px-6 font-bold text-black">
              No
            </th>
            <th className="py-5 px-3 !bg-white md:px-6 font-bold text-black">
              Kegiatan Magang
            </th>
            <th className="py-5 px-3 !bg-white md:px-6 font-bold text-black">
              Tanggal
            </th>
            <th className="py-5 px-3 !bg-white md:px-6 font-bold text-black">
              Status
            </th>
            <th className="py-5 px-3 !bg-white md:px-6 font-bold text-black">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {!timesheetData || timesheetData.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 px-6 text-gray-500">
                Data tidak ditemukan
              </td>
            </tr>
          ) : (
            timesheetData.map((item, index) => {
              const rowNo = index + 1;
              const date = new Date(item.tanggal_mulai);
              if (!isValidDate(date)) return null;
              const formattedPeriod = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
              const secretKey = "my-secret-key";
              // Use id_project (tran_project.id) for navigation
              const tranProjectId = item.id_project; // This is the actual tran_project.id
              const encryptedProjectId = CryptoJS.AES.encrypt(
                tranProjectId.toString(),
                secretKey,
              ).toString();
              const encryptedDate = CryptoJS.AES.encrypt(
                formattedPeriod,
                secretKey,
              ).toString();

              // Use first student ID from the data for navigation
              // This is needed because the view page fetches project data filtered by student ID
              const firstStudentId =
                Array.isArray(item.nim) && item.nim.length > 0
                  ? item.nim[0]
                  : "";
              const userIdForEncryption = firstStudentId;

              const encryptedUserId = CryptoJS.AES.encrypt(
                userIdForEncryption.toString(),
                secretKey,
              ).toString();
              const encodedProjectId = encodeURIComponent(encryptedProjectId);
              const encodedDate = encodeURIComponent(encryptedDate);
              const encodedUserId = encodeURIComponent(encryptedUserId);
              const matchedPayment = paymentData.find(
                (payment: any) =>
                  payment.id_tmst_project === item.id_tmst_project &&
                  payment.periode === formattedPeriod,
              );
              const { label: _label } = statusStyles(matchedPayment?.status);
              const studentCount = Array.isArray(item.nama)
                ? item.nama.length
                : 0;
              const students = Array.isArray(item.nama)
                ? item.nama.map((nama: string, idx: number) => ({
                    name: nama,
                    nim: Array.isArray(item.nim) ? item.nim[idx] : item.nim,
                  }))
                : [];
              return (
                <tr
                  key={`desktop-${item.id_project}-${index}-${formattedPeriod}`}
                  className="border-b border-gray-200 relative text-center"
                >
                  <td className="py-2 md:py-4 px-3 md:px-6 text-black">
                    {rowNo}
                  </td>
                  <td className="py-2 md:py-4 px-3 md:px-6">
                    <div className="flex flex-col items-center text-center">
                      <span className="font-semibold text-black">
                        {item.nama_project?.includes(" - ")
                          ? item.nama_project.split(" - ")[0]
                          : item.nama_project}
                      </span>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#0E6F5E]">
                        <span>{studentCount} Mahasiswa</span>
                        <div
                          className="relative flex items-center"
                          onMouseEnter={() => setHoveredRow(index)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <BsFillPeopleFill className="text-base md:text-lg cursor-pointer" />
                          {hoveredRow === index && (
                            <div className="absolute left-0 top-6 min-w-[220px] rounded-lg bg-[#FEF3C7] p-2 text-left text-xs font-medium text-[#4B5563] shadow-lg z-10">
                              {students.length > 0 ? (
                                students.map((m: any, i: number) => (
                                  <div
                                    key={`${m.nim}-${i}`}
                                    className="whitespace-nowrap"
                                  >
                                    {m.name ?? "-"}
                                    {m.nim ? ` (${m.nim})` : ""}
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center gap-2 text-amber-700">
                                  <AiOutlineClose className="h-4 w-4" /> Tidak
                                  ada mahasiswa
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 md:py-4 px-3 md:px-6 text-black text-center">
                    {formatDateRange(item.tanggal_mulai, item.tanggal_selesai)}
                  </td>
                  <td className="py-2 md:py-4 px-3 md:px-6 text-black">
                    <span
                      className={getStatusBadgeClassName(
                        getDisplayStatus(item, matchedPayment),
                        "text-sm",
                      )}
                    >
                      {getDisplayStatus(item, matchedPayment)}
                    </span>
                  </td>
                  <td className="py-2 md:py-4 px-3 md:px-6">
                    <Link
                      href={{
                        pathname: `/user/timesheet/view/${item.id_tmst_project}`,
                        query: {
                          id_tran_project: encodedProjectId,
                          date: encodedDate,
                          userId: encodedUserId,
                        },
                      }}
                      as={`/user/timesheet/view/${item.id_tmst_project}?id_tran_project=${encodedProjectId}&date=${encodedDate}&userId=${encodedUserId}`}
                      className="inline-flex items-center justify-center min-w-20 px-2 md:px-4 py-1 md:py-2 rounded-md bg-yellow-400 text-green-700 font-semibold hover:bg-yellow-500 hover:text-green-800 transition-all duration-200 text-xs md:text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SubmitPaymentTable;
