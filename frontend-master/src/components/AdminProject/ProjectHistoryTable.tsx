import React, { useState } from "react";
import Link from "next/link";
import { BsFillPeopleFill } from "react-icons/bs";
import { IoSearchOutline } from "react-icons/io5";
import { getStatusBadgeClassName } from "@/src/constants/badge";

interface ProjectTableProps {
  data: any[];
  filter: string;
}

function formatMonthRange(
  dateStringStart: string,
  dateStringEnd: string,
): string {
  const startDate = new Date(dateStringStart);
  const endDate = new Date(dateStringEnd);

  const startMonth = startDate.toLocaleDateString("id-ID", { month: "long" });
  const endMonth = endDate.toLocaleDateString("id-ID", { month: "long" });
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${endYear}`;
  }
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

const ProjectTable: React.FC<ProjectTableProps> = ({
  data,
  filter: _filter,
}) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const handleMouseEnter = (index: number) => {
    setHoveredRow(index);
  };

  const handleMouseLeave = () => {
    setHoveredRow(null);
  };

  return (
    <div className="flex justify-center">
      <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
        <thead>
          <tr className="bg-transparent border-b border-gray-200 shadow-md">
            <th className="py-3 px-6 font-bold text-black text-base">
              Nama Kegiatan
            </th>
            <th className="py-3 px-6 font-bold text-black text-base">
              Mahasiswa
            </th>
            <th className="py-3 px-6 font-bold text-black text-base">Bulan</th>
            <th className="py-3 px-6 font-bold text-black text-base">Status</th>
            <th className="py-3 px-6 font-bold text-black text-base">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 px-6 text-gray-500">
                Data pencarian tidak ditemukan
              </td>
            </tr>
          ) : (
            data.map((project: any, index: number) => (
              <tr
                key={`${project.id}-${index}`}
                className="border-b border-gray-300 relative"
              >
                <td className="py-4 px-6">
                  <div className="flex flex-col">
                    <span className="font-medium text-black">
                      {project.nama}
                    </span>
                    <span className="text-black">
                      {project.inisial_project}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6 text-black">
                  <div className="flex items-center justify-center">
                    <span>{project.countMember} Mahasiswa</span>
                    <div
                      className="relative flex items-center ml-2"
                      onMouseEnter={() => handleMouseEnter(index)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <BsFillPeopleFill className="text-lg mr-1" />
                      {hoveredRow === index && (
                        <div className="absolute left-0 top-6 bg-[#FEF3C7] p-2 rounded-lg shadow-lg z-10">
                          {project.members?.map((member: any) => (
                            <div key={member.id} className="whitespace-nowrap">
                              {member.nama} ({member.id})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-black">
                  {formatMonthRange(
                    project.tanggal_mulai_project || project.tanggal_mulai,
                    project.tanggal_selesai_project || project.tanggal_selesai,
                  )}
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={getStatusBadgeClassName(
                        project.status,
                        "text-sm",
                      )}
                    >
                      {project.statusProgress || project.status}
                    </span>
                    <div className="text-xs text-gray-600">
                      {(() => {
                        // const totalMonths = Number(project.totalMonths || 0);
                        // const approvedMonths = Number(
                        //   project.approvedMonths || 0,
                        // );
                        // if (totalMonths > 0) {
                        //   return `Approved Timesheet: ${approvedMonths}/${totalMonths}`;
                        // }
                        return "";
                      })()}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 flex justify-center gap-2 text-black">
                  <Link
                    href={`/admin/project/view/${project.id}`}
                    className="bg-white hover:bg-gray-100 text-black font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                  >
                    <IoSearchOutline className="text-xl" />
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectTable;
