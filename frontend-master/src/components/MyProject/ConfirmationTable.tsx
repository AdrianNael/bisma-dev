import React, { useEffect, useState } from "react";
// unused icon imports kept for future UI; prefix with _ to satisfy lint
import {
  IoPencilOutline as _IoPencilOutline,
  IoSearchOutline as _IoSearchOutline,
} from "react-icons/io5";
import { AiOutlineClose as _AiOutlineClose } from "react-icons/ai";
import { BsFillPeopleFill as _BsFillPeopleFill } from "react-icons/bs";
import _Link from "next/link";
import { format as _format, parseISO as _parseISO } from "date-fns";

function _formatDate(dateString: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return new Date(dateString).toLocaleDateString("id-ID", options);
}

const ConfirmationTable = ({ data, judul }: { data: any[]; judul: string }) => {
  const apiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [_Category, setCategory] = useState([]);
  useEffect(() => {
    fetch(`${apiEndPoint}/api/internCategory`)
      .then((data) => {
        return data.json();
      })
      .then((objectData) => {
        setCategory(objectData.data);
      });
  }, [apiEndPoint]);

  return (
    <>
      <table className="table w-full text-center">
        <thead>
          <tr>
            <th>Kegiatan Magang</th>
            <th>Nama Mahasiswa</th>
            <th>Durasi Kegiatan</th>
            <th>Insentif</th>
          </tr>
        </thead>
        <tbody>
          {data.map((Mahasiswa: any, index: any) => {
            return (
              <tr key={index} className="text-center">
                <th>{judul}</th>
                <td>
                  <div className="flex flex-col justify-start">
                    {Mahasiswa.mahasiswa.recap}
                  </div>
                </td>
                <td>{Mahasiswa.durasi}</td>
                <td>
                  Rp{" "}
                  {Mahasiswa.insentif
                    ? Mahasiswa.insentif.toLocaleString("id-ID")
                    : Mahasiswa.estimasi.toLocaleString("id-ID")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

export default ConfirmationTable;
