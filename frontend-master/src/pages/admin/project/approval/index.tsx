import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo } from "react";
import ProjectTable from "@/src/components/AdminProject/ProjectWaitingTable";
import Pagination from "@/src/components/Pagination";
import axios from "axios";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { useRole } from "@/src/context/RoleContext";
import { IoSearchOutline } from "react-icons/io5";

interface DecodedToken {
  exp: number;
}

type Props = {
  id: any;
  role: string;
};

type TabType = "project" | "timesheet";

const ProjectApproval = ({ id, role: _role }: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const pageTitle = "Approval";

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("project");

  // Project state (existing)
  const [filter, setFilter] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [perPage, setPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataNotFound, setDataNotFound] = useState(false);

  // Timesheet state
  const [timesheetFilter, setTimesheetFilter] = useState("");
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [timesheetPerPage, setTimesheetPerPage] = useState(15);
  const [timesheetCurrentPage, setTimesheetCurrentPage] = useState(1);
  const [timesheetTotalPages, setTimesheetTotalPages] = useState(1);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetDataNotFound, setTimesheetDataNotFound] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { setId } = useRole();
  const [_error, _setError] = useState<string | null>(null);

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

  const handleTimesheetFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimesheetFilter(e.target.value);
  };

  useEffect(() => {
    if (router.isReady) {
      const queryPage = router.query.page
        ? parseInt(router.query.page as string, 10)
        : 1;
      setCurrentPage(queryPage);
      setTimesheetCurrentPage(queryPage);
    }
  }, [router.isReady, router.query.page]);

  // Fetch project data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = filter
          ? `${APIEndpoint}/api/masterProject?page=${currentPage}&size=${perPage}&status=4&namaProjek=${filter}&merge=false`
          : `${APIEndpoint}/api/masterProject?page=${currentPage}&size=${perPage}&status=4&merge=false`;
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

    if (token && activeTab === "project") {
      fetchData();
    }
  }, [filter, APIEndpoint, currentPage, perPage, token, axiosJWT, activeTab]);

  // Fetch timesheet data
  useEffect(() => {
    const fetchTimesheetData = async () => {
      setTimesheetLoading(true);
      try {
        let url = `${APIEndpoint}/api/payments/listAdmin/submitted?page=${timesheetCurrentPage}`;
        if (timesheetFilter) {
          url += `&namaProjek=${timesheetFilter}`;
        }
        const response = await axiosJWT.get(url);
        // API wrapper structure: response.data = { status, success, data: { data: [...], paging: {...} } }
        const responseData = response.data?.data;
        const timesheetData = Array.isArray(responseData?.data)
          ? responseData.data
          : [];
        setTimesheets(timesheetData);
        setTimesheetTotalPages(responseData?.paging?.total_page || 1);
        setTimesheetDataNotFound(timesheetData.length === 0);
      } catch (error) {
        console.error(error);
      } finally {
        setTimesheetLoading(false);
      }
    };

    if (token && activeTab === "timesheet") {
      fetchTimesheetData();
    }
  }, [
    timesheetFilter,
    APIEndpoint,
    timesheetCurrentPage,
    timesheetPerPage,
    token,
    axiosJWT,
    activeTab,
  ]);

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  const handleTimesheetPageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setTimesheetCurrentPage(page);
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

  const formatPeriode = (periode?: string | null): string => {
    if (!periode) return "-";
    const [year, month] = periode.split("-").map(Number);
    if (!year || !month) return periode;
    const dt = new Date(year, month - 1, 1);
    return dt.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex justify-between gap-4">
            <div>
              <Link
                className="btn border-0 bg-transparent text-gray-600 hover:border-b hover:border-gray-600 hover:bg-transparent hover:rounded-none"
                href="/admin/project"
              >
                History
              </Link>
              <Link
                href="/admin/project/approval"
                className="btn border-0 bg-transparent text-gray-800 border-b border-gray-800 rounded-none hover:bg-transparent ml-2"
              >
                Waiting Approval
              </Link>
            </div>
            <input
              type="text"
              name="searchProject"
              className="input input-bordered input-secondary w-72 shadow-inner"
              onChange={
                activeTab === "project" ? handleFilter : handleTimesheetFilter
              }
              placeholder="Search..."
              value={activeTab === "project" ? filter : timesheetFilter}
            />
          </div>

          {/* Tab buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("project")}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === "project"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Project Approval
            </button>
            <button
              onClick={() => setActiveTab("timesheet")}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === "timesheet"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Timesheet Approval
            </button>
          </div>

          <div className="rounded-lg mb-60">
            {activeTab === "project" ? (
              // Project Approval content
              loading ? (
                <p className="text-center text-blue-600 font-bold">
                  Loading...
                </p>
              ) : dataNotFound ? (
                <p className="text-center text-red-600 font-bold">
                  Data tidak ditemukan
                </p>
              ) : (
                <>
                  <ProjectTable data={projects} filter={filter} />
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
              )
            ) : // Timesheet Approval content
            timesheetLoading ? (
              <p className="text-center text-blue-600 font-bold">Loading...</p>
            ) : timesheetDataNotFound ? (
              <p className="text-center text-red-600 font-bold">
                Data tidak ditemukan
              </p>
            ) : (
              <>
                {/* Timesheet table */}
                <div className="flex justify-center">
                  <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
                    <thead>
                      <tr className="bg-transparent border-b border-gray-200 shadow-md">
                        <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                          No.
                        </th>
                        <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                          Nama Project
                        </th>
                        <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                          Periode
                        </th>
                        <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesheets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 px-6 text-gray-500">
                            Data tidak ditemukan
                          </td>
                        </tr>
                      ) : (
                        timesheets.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-300 hover:bg-gray-100"
                          >
                            <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                              {(timesheetCurrentPage - 1) * timesheetPerPage +
                                index +
                                1}
                            </td>
                            <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                              {item.nama || "-"}
                            </td>
                            <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                              {formatPeriode(item.periode)}
                            </td>
                            <td className="py-2 md:py-4 md:px-6 text-black text-xs md:text-sm">
                              <div className="flex justify-center items-center">
                                <Link
                                  href={`/admin/project/approval/timesheet/${item.id_tmst_project || item.id}?projectId=${item.id_tmst_project || item.id}`}
                                  className="bg-transpa hover:bg-gray-100 text-black font-semibold p-2 rounded"
                                >
                                  <IoSearchOutline className="text-xl" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 mb-2">
                  <Pagination
                    pageCount={timesheetTotalPages}
                    onPageChange={handleTimesheetPageChange}
                    perPage={timesheetPerPage}
                    setPerPage={setTimesheetPerPage}
                    currentPage={timesheetCurrentPage}
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

export default withPage(ProjectApproval);
