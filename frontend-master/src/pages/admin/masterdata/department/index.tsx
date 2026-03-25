import React, { useState, useEffect, useMemo } from "react";
/* eslint-disable react-hooks/exhaustive-deps */

import Layout from "@/src/components/Layout";
import { MdAdd } from "react-icons/md";
import Link from "next/link";
import { useRouter } from "next/router";
import Pagination from "@/src/components/Pagination";
import { toast } from "react-toastify";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { showDeleteConfirmation } from "@/src/utils/swalHelper";

interface DecodedToken {
  exp: number;
}

type Props = {
  username: any;
  role: string;
  id: string;
  name: string;
};

interface Department {
  id: number;
  department: string;
}

const DepartmentManagement = (_props: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [departmentData, setDepartmentData] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(0);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${APIEndpoint}/token`, {
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
  }, [APIEndpoint]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();

    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${APIEndpoint}/token`, {
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
        toast.error(error.response?.data?.message || "Request error");
        return Promise.reject(error);
      },
    );

    return instance;
  }, [token, expire, APIEndpoint]);

  const fetchDepartmentData = async () => {
    setLoading(true);
    try {
      if (isFirstLoad === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const params: any = {
        page: currentPage,
        size: perPage,
      };
      if (search) {
        params.name = search;
      }

      const response = await axiosJWT.get(`${APIEndpoint}/api/department`, {
        params: params,
      });
      // console.log(response.data.data);

      setDepartmentData(response.data.data);
      setTotalPages(response.data.paging.total_page);
      setIsFirstLoad(1);
    } catch (error) {
      if (currentPage > 1 || search) {
        toast.error("Failed to fetch department data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (token) {
        fetchDepartmentData();
      }
    }, 100);

    return () => clearTimeout(delayDebounceFn);
  }, [search, currentPage, perPage, token]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  const confirmDeletion = async (departmentId: number) => {
    const result = await showDeleteConfirmation({
      title: "Konfirmasi Penghapusan",
      text: "Apakah Anda yakin ingin menghapus data ini?",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await handleDelete(departmentId);
    }
  };

  const handleDelete = async (departmentId: number) => {
    try {
      const response = await axiosJWT.delete(
        `${APIEndpoint}/api/department/${departmentId}`,
      );
      if (response.status === 200) {
        toast.success("Data berhasil dihapus!");
        fetchDepartmentData();
      } else {
        toast.error(`Gagal menghapus data: ${response.data.message}`);
      }
    } catch (error: any) {
      toast.error(JSON.parse(error.request.response).message);
      console.error(error);
    }
  };

  return (
    <Layout title="Master Data - Program Studi">
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex justify-between gap-4">
            <Link
              href={"/admin/masterdata/department/new"}
              className="btn bg-primary flex items-center justify-center"
            >
              <div className="text-white">
                <MdAdd className="text-xl text-blue-100" color="white" />{" "}
              </div>
              Tambah
            </Link>
            <input
              type="text"
              className="input input-bordered w-72 shadow-inner"
              onChange={handleSearch}
              placeholder="Search by department name..."
            />
          </div>
          <div className="rounded-lg p-6">
            {loading ? (
              <div className="flex justify-center items-center mt-4 text-lg font-bold text-blue-500">
                Loading...
              </div>
            ) : departmentData.length === 0 ? (
              <div className="flex justify-center items-center mt-4 text-lg font-bold text-red-500">
                Tidak ada data
              </div>
            ) : (
              <>
                <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
                  <thead>
                    <tr className="bg-transparent border-b border-gray-200 shadow-md">
                      <th className="font-bold text-black py-3 px-6 text-lg">
                        Department
                      </th>
                      <th className="font-bold text-black py-3 px-6 text-center">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentData.map((department) => (
                      <tr
                        key={department.id}
                        className="border-b border-gray-200"
                      >
                        <td className="py-3 px-6 text-black">
                          {department.department}
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex flex-row justify-center items-center h-full m-1 gap-4">
                            <Link
                              href={`/admin/masterdata/department/edit/${department.id}`}
                              className="bg-gray-300 text-black font-semibold py-2 px-4 rounded-md shadow-md hover:bg-gray-500"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => confirmDeletion(department.id)}
                              className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-red-800"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4">
                  <Pagination
                    pageCount={totalPages}
                    onPageChange={handlePageChange}
                    perPage={perPage}
                    setPerPage={setPerPage}
                    currentPage={currentPage}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(DepartmentManagement);
