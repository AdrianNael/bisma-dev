import React, { useEffect, useState, useMemo } from "react";
import {
  IoPencilOutline as _IoPencilOutline,
  IoSearchOutline as _IoSearchOutline,
  IoNewspaperOutline as _IoNewspaperOutline,
} from "react-icons/io5";
import { AiOutlineClose as _AiOutlineClose } from "react-icons/ai";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/router";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import CryptoJS from "crypto-js";
import { getStatusBadgeClassName } from "@/src/constants/badge";
import {
  showDeleteConfirmation,
  showSuccess,
  showError,
} from "@/src/utils/swalHelper";
import Swal from "sweetalert2";

interface DecodedToken {
  exp: number;
}

const isValidDate = (d: Date) => {
  return d instanceof Date && !isNaN(d.getTime());
};

const formatDateRange = (
  startDateString: string | null,
  endDateString: string | null,
): string => {
  if (!startDateString || !endDateString) {
    return "Tanpa batas waktu";
  }
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return "Tanpa batas waktu";
  }

  const formattedStartDate = format(startDate, "dd MMMM yyyy");
  const formattedEndDate = format(endDate, "dd MMMM yyyy");
  return `${formattedStartDate} - ${formattedEndDate}`;
};

const TimeSheetTable = ({ id, data, perPage, currentPage }: any) => {
  const timesheetEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [_Category, setCategory] = useState<{ id: number; kategori: string }[]>(
    [],
  );
  const _router = useRouter();

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${timesheetEndpoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (error: any) {
        console.error("Error refreshing token:", error);
      }
    };

    refreshToken();
  }, [timesheetEndpoint]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();

    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${timesheetEndpoint}/token`, {
              withCredentials: true,
            });
            config.headers.Authorization = `Bearer ${response.data.data.token}`;
            setToken(response.data.data.token);
            const decoded: DecodedToken = jwtDecode(response.data.data.token);
            setExpire(decoded.exp);
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }, [token, expire, timesheetEndpoint]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosJWT.get(
          `${timesheetEndpoint}/api/internCategory`,
        );
        setCategory(response.data.data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    if (token) {
      fetchData();
    }
  }, [axiosJWT, timesheetEndpoint, token]);

  const deletion = async (projectId: any, userId: any, date: any) => {
    try {
      await axiosJWT.delete(
        `${timesheetEndpoint}/api/timesheet/deleteMany/${projectId}`,
        {
          params: { userId, date },
        },
      );
      _router.reload();
      await showSuccess({ title: "Terhapus!", text: "Data telah dihapus." });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Gagal menghapus data";
      await showError({ title: "Error!", text: errorMessage });
    }
  };

  const handleDelete = async (projectId: any, userId: any, date: any) => {
    const result = await showDeleteConfirmation({
      title: "Apakah Anda yakin?",
      text: "Anda tidak akan dapat mengembalikan ini!",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await deletion(projectId, userId, date);
    }
  };

  const handleShowRevision = (revisiMessage: string | null) => {
    Swal.fire({
      title: "Pesan Revisi",
      html: `<div style="text-align: left; white-space: pre-wrap;">${revisiMessage || "Tidak ada pesan revisi"}</div>`,
      icon: "info",
      confirmButtonText: "Tutup",
      confirmButtonColor: "#3085d6",
      customClass: {
        popup: "swal-wide",
      },
    });
  };

  return (
    <div className="flex justify-center">
      <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
        <thead>
          <tr className="bg-transparent border-b border-gray-200 shadow-md">
            <th className="py-3 px-6 font-bold text-black text-base"></th>
            <th className="py-3 px-6 font-bold text-black text-base">
              Project
            </th>
            <th className="py-3 px-6 font-bold text-black text-base">
              Tanggal
            </th>
            <th className="py-3 px-6 font-bold text-black text-base">
              Estimasi Insentif
            </th>
            <th className="py-3 px-6 font-bold text-black text-base">Status</th>
            <th className="py-3 px-6 font-bold text-black text-base">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((value: any, index: any) => {
            // Handle null dates for karya category
            const hasValidDates = value.tanggal_mulai && value.tanggal_selesai;
            const date = hasValidDates
              ? new Date(value.tanggal_mulai)
              : new Date();

            if (hasValidDates && !isValidDate(date)) {
              console.error(`Invalid date: ${value.tanggal_mulai}`);
              return null;
            }
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`; // Format tanggal ke YYYY-MM

            // Tentukan estimasi insentif berdasarkan kategori
            // Untuk kategori karya (id_kategori 7 atau 8), gunakan estimasi dari tran_project
            const isKaryaCategory =
              value.id_kategori === 7 || value.id_kategori === 8;
            const estimasiInsentif = isKaryaCategory
              ? value.estimasi || 0
              : value.total_besaran_insentif || 0;

            // AES encryption with Base64 encoding
            const secretKey = "my-secret-key";
            const encryptedProjectId = CryptoJS.AES.encrypt(
              value.id_project.toString(),
              secretKey,
            ).toString();
            const encryptedDate = CryptoJS.AES.encrypt(
              formattedDate,
              secretKey,
            ).toString();
            const encryptedUserId = CryptoJS.AES.encrypt(
              id.toString(),
              secretKey,
            ).toString();

            // Encode the encrypted string to Base64 for safe URL transmission
            const encodedProjectId = encodeURIComponent(encryptedProjectId);
            const encodedDate = encodeURIComponent(encryptedDate);
            const encodedUserId = encodeURIComponent(encryptedUserId);
            return (
              <tr
                key={value.id_project}
                className="border-b border-gray-300 relative"
              >
                <th className="text-black py-3 px-6">
                  {(currentPage - 1) * perPage + (index + 1)}
                </th>
                <td className="text-black py-3 px-6">
                  <div className="flex flex-col justify-start">
                    <div className="text-center items-center">
                      {value.nama_project}
                    </div>
                  </div>
                </td>
                <td className="text-black py-3 px-6">
                  {formatDateRange(value.tanggal_mulai, value.tanggal_selesai)}
                </td>
                <td className="text-black py-3 px-6">
                  {estimasiInsentif.toLocaleString("id-ID")}
                </td>
                <td className="text-black py-3 px-6">
                  <span
                    className={getStatusBadgeClassName(value.status, "text-sm")}
                  >
                    {value.status}
                  </span>
                  {value.status === "Revision Required" && value.revisi && (
                    <button
                      onClick={() => handleShowRevision(value.revisi)}
                      className="ml-2 text-blue-600 hover:text-blue-800 inline-flex items-center"
                      title="Lihat Pesan Revisi"
                    >
                      <_IoNewspaperOutline className="text-xl" />
                    </button>
                  )}
                </td>
                <td className="text-black py-3 px-6">
                  <div className="flex flex-row justify-center items-center h-full m-1 ">
                    <Link
                      href={{
                        pathname:
                          "/mahasiswa/timesheet/detail?[id_tran_project]&[date]&[userId]",
                        query: {
                          id_tran_project: encodedProjectId,
                          date: encodedDate,
                          userId: encodedUserId,
                        },
                      }}
                      as={`/mahasiswa/timesheet/detail?${encodedProjectId}&${encodedDate}&${encodedUserId}`}
                      className="btn btn-ghost btn-xs"
                    >
                      <div
                        className="tooltip tooltip-top text-xs normal-case"
                        data-tip="View"
                      >
                        <_IoSearchOutline className="text-xl" />
                      </div>
                    </Link>
                    {value.status === "Revision Required" && (
                      <Link
                        href={{
                          pathname:
                            "/mahasiswa/timesheet/edit?[id_tran_project]&[date]&[userId]",
                          query: {
                            id_tran_project: encodedProjectId,
                            date: encodedDate,
                            userId: encodedUserId,
                          },
                        }}
                        as={`/mahasiswa/timesheet/edit?${encodedProjectId}&${encodedDate}&${encodedUserId}`}
                        className="btn btn-warning btn-xs ml-1"
                      >
                        Revisi
                      </Link>
                    )}
                    {value.status !== "Approved" &&
                      value.status !== "Completed" &&
                      value.status !== "Revision Required" && (
                        <>
                          <Link
                            href={{
                              pathname:
                                "/mahasiswa/timesheet/edit?[id_tran_project]&[date]&[userId]",
                              query: {
                                id_tran_project: encodedProjectId,
                                date: encodedDate,
                                userId: encodedUserId,
                              },
                            }}
                            as={`/mahasiswa/timesheet/edit?${encodedProjectId}&${encodedDate}&${encodedUserId}`}
                            className="btn btn-ghost btn-xs"
                          >
                            <div
                              className="tooltip tooltip-top text-xs normal-case"
                              data-tip="Edit"
                            >
                              <_IoPencilOutline className="text-xl" />
                            </div>
                          </Link>
                          <div
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              handleDelete(value.id_project, id, formattedDate)
                            }
                          >
                            <div
                              className="tooltip tooltip-top text-xs normal-case"
                              data-tip="Delete"
                            >
                              <_AiOutlineClose className="text-2xl text-red-600" />
                            </div>
                          </div>
                        </>
                      )}
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

export default TimeSheetTable;
