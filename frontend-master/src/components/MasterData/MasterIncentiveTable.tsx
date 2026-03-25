import React from "react";
import { IoPencilOutline as _IoPencilOutline } from "react-icons/io5";
import { AiOutlineClose as _AiOutlineClose } from "react-icons/ai";
import Link from "next/link";
import { toast } from "react-toastify";
import _router from "next/router";

type Props = {
  data: Array<{ id: number; kategori: string; besaran_insentif: number }>;
  filter: string;
  onDelete: (id: number) => void;
};

const MasterInsentiveTable = ({ data, filter: _filter, onDelete }: Props) => {
  const deleting = async (id: number) => {
    try {
      await onDelete(id);
    } catch (error) {
      toast.error("Gagal menghapus data.");
      console.error(error);
    }
  };

  return (
    <div className="flex justify-center">
      <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
        <thead>
          <tr className="bg-transparent border-b border-gray-200 shadow-md p-15">
            <th className="font-bold text-black py-3 px-6 text-lg">
              Nama Kegiatan
            </th>
            <th className="font-bold text-black py-3 px-6 text-lg">Insentif</th>
            <th className="font-bold text-black py-3 px-6 text-lg">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.map((value: any, _index: any) => {
            return (
              <tr key={value.id} className="border-b border-gray-300 relative">
                <td className="py-3 px-6 text-black">
                  <div className="flex flex-col font-semibold py-3 px-6 justify-center">
                    {value.kategori}
                  </div>
                </td>
                <td className="py-3 px-6 text-black">
                  <div className="flex flex-col font-semibold py-3 px-6 justify-center">
                    Rp {value.besaran_insentif.toLocaleString("id-ID")}
                  </div>
                </td>
                <td className="py-3 px-6 text-black">
                  <div className="flex flex-row justify-center items-center gap-4 pl-10">
                    <Link
                      href={`/admin/masterdata/incentive/edit/${value.id}`}
                      className="bg-gray-300 text-black font-semibold py-2 px-4 rounded-md shadow-md hover:bg-gray-500"
                    >
                      <div>Edit</div>
                    </Link>
                    <button
                      onClick={() => deleting(value.id)}
                      className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-red-800"
                    >
                      <div>Delete</div>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MasterInsentiveTable;
