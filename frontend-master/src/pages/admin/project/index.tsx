import Layout from "@/src/components/Layout";
import PageLoader from "@/src/components/PageLoader";
import React, { useState, useEffect, useMemo } from "react";
import ProjectHistoryTable from "@/src/components/AdminProject/ProjectHistoryTable";
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

interface Category {
  id: number;
  kategori: string;
}

type Props = {
  id: any;
  role: string;
};

const AdminProject = ({ id, role: _role }: Props) => {
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

  // New filter states
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  const monthOptions = [
    { value: "", label: "Semua Bulan" },
    { value: "01", label: "Januari" },
    { value: "02", label: "Februari" },
    { value: "03", label: "Maret" },
    { value: "04", label: "April" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "Agustus" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  const statusOptions = [
    { value: "", label: "Semua Status" },
    { value: "2", label: "Open" },
    { value: "3", label: "Waiting Timesheet Approval" },
    { value: "5", label: "Project Approved" },
    { value: "6", label: "Completed" },
    { value: "7", label: "Need Revision" },
  ];

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

  // Fetch categories from incentive API (requires auth)
  useEffect(() => {
    const fetchCategories = async () => {
      if (!token) return;
      try {
        const response = await axiosJWT.get(
          `${APIEndpoint}/api/incentive?page=1&size=100`,
        );
        const data = response.data.data || [];
        // Deduplicate by kategori name
        const unique: Category[] = [];
        const seen = new Set<string>();
        for (const item of data) {
          if (item.kategori && !seen.has(item.kategori)) {
            seen.add(item.kategori);
            unique.push({ id: item.id_kategori, kategori: item.kategori });
          }
        }
        setCategories(unique);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, [APIEndpoint, token, axiosJWT]);

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
        const params = new URLSearchParams();
        params.append("page", String(currentPage));
        params.append("size", String(perPage));
        params.append("status_ne", "2"); // Exclude Submitted
        if (filter) params.append("namaProjek", filter);
        if (selectedCategory) params.append("id_kategori", selectedCategory);
        if (selectedStatus) params.append("status", selectedStatus);
        if (filterMonth) params.append("filterMonth", filterMonth);
        // Admin view: request per-split rows (do not merge crossing-year splits)
        params.append("merge", "false");

        const url = `${APIEndpoint}/api/masterProject?${params.toString()}`;
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
  }, [
    filter,
    selectedCategory,
    selectedStatus,
    filterMonth,
    APIEndpoint,
    currentPage,
    perPage,
    token,
    axiosJWT,
  ]);

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
          <div className="flex justify-between gap-4 flex-wrap">
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
            {/* Filter Controls */}
            <div className="flex gap-2 flex-wrap items-center">
              <select
                className="select select-bordered select-md"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Semua Jenis</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.kategori}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-md"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-md"
                value={filterMonth ? filterMonth.split("-")[1] : ""}
                onChange={(e) => {
                  const monthVal = e.target.value;
                  if (monthVal) {
                    const currentYear = new Date().getFullYear();
                    setFilterMonth(`${currentYear}-${monthVal}`);
                  } else {
                    setFilterMonth("");
                  }
                }}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="searchProject"
                className="input input-bordered input-md w-48"
                onChange={handleFilter}
                placeholder="Search..."
              />
            </div>
          </div>
          <div className="rounded-lg mb-60">
            {loading ? (
              <PageLoader />
            ) : dataNotFound ? (
              <p className="text-center text-red-600 font-bold">
                Data tidak ditemukan
              </p>
            ) : (
              <>
                <ProjectHistoryTable data={projects} filter={filter} />
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

export default withPage(AdminProject);
