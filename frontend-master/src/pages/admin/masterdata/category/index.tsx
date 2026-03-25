import Layout from "@/src/components/Layout";
import { MdAdd } from "react-icons/md";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import MasterTable from "@/src/components/MasterData/MasterTable";
import { useRouter } from "next/router";
import Pagination from "@/src/components/Pagination";
import { toast } from "react-toastify";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import axios from "axios";
import { AxiosError } from "axios";
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

const MasterData = (_props: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [filter, _setFilter] = useState("");
  const [Kegiatan, setData] = useState([]);
  const [Search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1); // State untuk total pages
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataNotFound, setDataNotFound] = useState(false);

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && router.isReady) {
      const queryPage = router.query.page
        ? parseInt(router.query.page as string, 10)
        : 1;
      setCurrentPage(queryPage);
    }
  }, [hydrated, router.isReady, router.query.page]);

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
        router.push("/login");
      }
    };

    refreshToken();
  }, [APIEndpoint, router]);

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

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const queryParam = Search
        ? `?kategori=${Search}&page=${currentPage}&size=${perPage}`
        : `?page=${currentPage}&size=${perPage}`;
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/incentive${queryParam}`,
      );
      const data = response.data;
      setData(data.data);
      setTotalPages(data.paging.total_page);
      setDataNotFound(data.data.length === 0);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [Search, currentPage, perPage, axiosJWT, APIEndpoint]);

  useEffect(() => {
    if (hydrated && token) {
      fetchCategories();
    }
  }, [
    hydrated,
    token,
    Search,
    perPage,
    currentPage,
    axiosJWT,
    fetchCategories,
  ]);

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

  const confirmDeletion = async (id: number) => {
    const result = await showDeleteConfirmation({
      title: "Konfirmasi Penghapusan",
      text: "Apakah Anda yakin ingin menghapus data ini?",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await handleDelete(id);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await axiosJWT.delete(
        `${APIEndpoint}/api/incentive/${id}`,
      );
      if (response.status === 200) {
        toast.success("Data berhasil dihapus!");
        fetchCategories();
      } else {
        toast.error(`Gagal menghapus data: ${response.data.message}`);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      toast.error(
        `Failed to delete data: ${axiosError.response?.data?.message || "Unknown Error"}`,
      );
      console.error(error);
    }
  };

  if (!hydrated) {
    return null;
  }

  return (
    <Layout title="Manage Kategori">
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex justify-between gap-4">
            <Link
              href={"/admin/masterdata/category/new"}
              className="btn bg-primary flex items-center justify-center"
            >
              <div className="text-white">
                <MdAdd className="text-xl text-blue-100" color="white" />{" "}
              </div>
              Tambah
            </Link>
            <input
              type="text"
              name="searchKegiatan"
              className="input input-bordered input-secondary w-72 shadow-inner"
              onChange={handleSearch}
              placeholder="Search..."
            />
          </div>
          <div className="rounded-lg mb-60">
            {loading ? (
              <div className="flex justify-center items-center mt-4 text-lg font-bold text-blue-500">
                Loading...
              </div>
            ) : dataNotFound ? (
              <div className="flex justify-center items-center mt-4 text-lg font-bold text-red-500">
                Data pencarian tidak ditemukan
              </div>
            ) : (
              <>
                <MasterTable
                  data={Kegiatan}
                  filter={filter}
                  onDelete={confirmDeletion}
                />
                <div className="mt-5 mb-2">
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

export default withPage(MasterData);
