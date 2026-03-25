import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo } from "react";
import ProjectWaitingTable from "@/src/components/AdminProject/ProjectHistoryTable";
import Pagination from "@/src/components/Pagination";
import axios from "axios";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { useRole } from "@/src/context/RoleContext";

interface DecodedToken {
  exp: number;
}

type Props = {
  id: any;
  role: string;
};

const HistoryProject = ({ id, role: _role }: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const pageTitle = "Project History";
  const [filter, setFilter] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [perPage, setPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dataNotFound, setDataNotFound] = useState(false);
  const { setId } = useRole();
  const [_error, _setError] = useState<string | null>(null);
  const [_activeTab, _setActiveTab] = useState<string>("semua");
  const [_filterStatus, _setFilterStatus] = useState<string>("semua");

  useEffect(() => {
    setId(id);
  }, [id, setId]);

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

  const handleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  useEffect(() => {
    if (router.isReady) {
      const queryPage = router.query.page
        ? parseInt(router.query.page as string, 10)
        : 1;
      setCurrentPage(queryPage);
    }
  }, [router.isReady, router.query.page]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = filter
          ? `${APIEndpoint}/api/masterProject?page=${currentPage}&size=${perPage}&status_ne=2&namaProjek=${filter}&merge=false`
          : `${APIEndpoint}/api/masterProject?page=${currentPage}&size=${perPage}&status_ne=2&merge=false`;
        const response = await axiosJWT.get(url);
        setProjects(response.data.data);
        setTotalPages(response.data.paging.total_page);
        setDataNotFound(response.data.data.length === 0);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [filter, APIEndpoint, currentPage, perPage, token, axiosJWT]);

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex justify-between gap-4">
            <div>
              <Link
                className="btn border-0 bg-transparent text-gray-800 border-b border-gray-800 rounded-none hover:bg-transparent"
                href="/admin/project"
              >
                History
              </Link>
              <Link
                href="/admin/project/approval"
                className="btn border-0 bg-transparent text-gray-600 hover:border-b hover:border-gray-600 hover:bg-transparent hover:rounded-none ml-2"
              >
                Waiting Approval
              </Link>
            </div>
            <input
              type="text"
              name="searchProject"
              className="input input-bordered input-secondary w-72 shadow-inner"
              onChange={handleFilter}
              placeholder="Search..."
            />
          </div>
          <div className="rounded-lg mb-60">
            {loading ? (
              <p className="text-center text-blue-600 font-bold">Loading...</p>
            ) : dataNotFound ? (
              <p className="text-center text-red-600 font-bold">
                Data tidak ditemukan
              </p>
            ) : (
              <>
                <ProjectWaitingTable data={projects} filter={filter} />
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

export default withPage(HistoryProject);
