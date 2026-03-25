import React from "react";
import { IoPencilOutline as _IoPencilOutline } from "react-icons/io5";
import { AiOutlineClose as _AiOutlineClose } from "react-icons/ai";
import Link from "next/link";
import { useRouter as _useRouter } from "next/router";

type Props = {
  data: Array<{ id: number; kategori: string; besaran_insentif?: number }>;
  filter: string;
  onDelete: (id: number) => void;
};

const MasterTable = ({ data, filter: _filter, onDelete }: Props) => {
  const _router = _useRouter();

  return (
    <div className="flex justify-center">
      <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
        <thead>
          <tr className="bg-transparent border-b border-gray-200 shadow-md">
            <th className="font-bold text-black py-3 px-6 text-lg">
              Nama Kegiatan
            </th>
            <th className="font-bold text-black py-3 px-6 text-lg">Insentif</th>
            <th className="font-bold text-black py-3 px-6 text-lg">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.map((value: any) => (
            <tr key={value.id} className="border-b border-gray-300 relative">
              <td className="py-3 px-6 text-black">
                <div className="flex flex-col font-semibold justify-center">
                  {value.kategori}
                </div>
              </td>
              <td className="py-3 px-6 text-black">
                <div className="flex flex-col font-semibold justify-center">
                  Rp {(value.besaran_insentif || 0).toLocaleString("id-ID")}
                </div>
              </td>
              <td className="py-3 px-6 text-black">
                <div className="flex flex-row justify-center items-center h-full m-1 gap-4">
                  <Link
                    href={`/admin/masterdata/category/edit/${value.id}`}
                    className="bg-gray-300 text-black font-semibold py-2 px-4 rounded-md shadow-md hover:bg-gray-500"
                  >
                    <div>Edit</div>
                  </Link>
                  <button
                    onClick={() => onDelete(value.id)}
                    className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-red-800"
                  >
                    <div>Delete</div>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MasterTable;
