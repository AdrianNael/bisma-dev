import React from "react";
import { IoSearchOutline } from "react-icons/io5";
import Link from "next/link";

type Quota = { month: string; used: number; remaining: number; limit: number };
type QuotaMap = Record<string, Quota | null | undefined>;

type Props = {
  data: any[];
  quotaMap?: QuotaMap;
};

const StudentTable = ({ data, quotaMap = {} }: Props) => {
  return (
    <div className="flex justify-center mt-4">
      <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
        <thead>
          <tr className="bg-transparent border-b border-gray-200 shadow-md">
            <th className="py-3 px-6 font-bold text-black text-sm">
              Program Studi
            </th>
            <th className="py-3 px-6 font-bold text-black text-sm">
              Nama Mahasiswa
            </th>
            <th className="py-3 px-6 font-bold text-black text-sm">NIM</th>
            <th className="py-3 px-6 font-bold text-black text-sm">Sisa Jam</th>
            <th className="py-3 px-6 font-bold text-black text-sm">
              Nomor Telepon
            </th>
            <th className="py-3 px-6 font-bold text-black text-sm">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((v: any) => {
            const q = quotaMap?.[String(v.id)];
            const remaining = q
              ? `${q.remaining}/${q.limit}`
              : (v.sisa_sesi ?? "-");
            return (
              <tr key={v.id} className="border-b border-gray-300">
                <td className="py-3 px-6 text-black">{v.departemen}</td>
                <td className="py-3 px-6 text-black">{v.nama}</td>
                <td className="py-3 px-6 text-black">{v.id}</td>
                <td className="py-3 px-6 text-black">{remaining}</td>
                <td className="py-3 px-6 text-black">{v.no_telp}</td>
                <td className="py-3 px-6 text-black">
                  <Link
                    href={`/user/availablestudent/detail/${v.id}`}
                    className="btn btn-ghost btn-xs"
                  >
                    <div
                      className="tooltip tooltip-top text-xs normal-case"
                      data-tip="View"
                    >
                      <IoSearchOutline className="text-xl" />
                    </div>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTable;
