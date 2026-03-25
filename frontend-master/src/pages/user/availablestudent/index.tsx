/* eslint-disable react-hooks/exhaustive-deps */

import Layout from "@/src/components/Layout";
import StudentTable from "@/src/components/AvailableStudent/StudentTable";
import { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import Search from "@/src/components/AvailableStudent/Search";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import Pagination from "@/src/components/Pagination";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { toast } from "react-toastify";

interface DecodedToken {
  exp: number;
}

type Props = {};

type Form = {
  keyword: string;
  periode: string; // YYYY-MM
  prodi: string;
  [key: string]: string | number | [];
};

type Quota = { month: string; used: number; remaining: number; limit: number };
type QuotaMap = Record<string, Quota | null>;

const AvailableStudent = (_props: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const searchParams = useSearchParams();
  const _keywordParams = searchParams.get("keyword") ?? "";
  const [projects, setProjects] = useState<any[]>([]);
  const [perPage, setPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { query } = router;
  const [dataNotFound, setDataNotFound] = useState(false);

  const pageTitle = "Available Student";

  const thisMonth = new Date();
  const y = thisMonth.getFullYear();
  const m = String(thisMonth.getMonth() + 1).padStart(2, "0");
  const defaultMonth = `${y}-${m}`;

  const [formData, setFormData] = useState<Form>({
    keyword: "",
    periode: defaultMonth, // default ke bulan ini
    prodi: "",
  });

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // quota map utk halaman aktif
  const [quotaMap, setQuotaMap] = useState<QuotaMap>({});

  useEffect(() => {
    if (router.isReady) {
      setFormData((prev) => ({
        ...prev,
        keyword: (router.query.keyword as string) || "",
        prodi: (router.query.prodi as string) || "",
        periode: (router.query.periode as string) || defaultMonth,
      }));
    }
  }, [router.isReady, router.query]);

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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    if (formData[name] === value) {
      return;
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const query = new URLSearchParams();

    if (formData.keyword) query.set("keyword", formData.keyword);
    if (formData.periode) query.set("periode", formData.periode); // <-- kirim periode
    if (formData.prodi) query.set("prodi", formData.prodi);

    const queryString = query.toString();
    router.push(`/user/availablestudent?${queryString}`);
  };

  // Sync form data with URL params on initial load
  useEffect(() => {
    if (router.isReady) {
      setFormData((prev) => ({
        ...prev,
        keyword: (router.query.keyword as string) || "",
        prodi: (router.query.prodi as string) || "",
        periode: (router.query.periode as string) || defaultMonth,
      }));
    }
  }, [
    router.isReady,
    router.query.keyword,
    router.query.prodi,
    router.query.periode,
  ]);

  // Fetch data only when token is ready and router is ready
  useEffect(() => {
    if (!router.isReady || !token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const queryString = new URLSearchParams(
          router.query as Record<string, string>,
        ).toString();
        const response = await axiosJWT.get(
          `${APIEndpoint}/api/availableStudent?${queryString}`,
        );
        const objectData = response.data;
        setProjects(objectData.data || []);
        setTotalPages(objectData.paging?.total_page || 1);
        setDataNotFound((objectData.data || []).length === 0);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, token, axiosJWT, JSON.stringify(router.query)]);

  // hitung page & currentData untuk render
  const page = Number(query.page) || 1;
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const currentData = projects.slice(startIndex, endIndex);

  // ambil quota untuk rows di halaman aktif
  const monthParam =
    typeof router.query.periode === "string" && router.query.periode
      ? (router.query.periode as string)
      : defaultMonth;

  useEffect(() => {
    // ketika list/halaman/ bulan berubah → fetch quota untuk visible rows
    if (!token || currentData.length === 0) {
      setQuotaMap({});
      return;
    }

    const ids = currentData.map((v: any) => v.id).filter(Boolean);
    (async () => {
      try {
        const results = await Promise.all(
          ids.map((id: string) =>
            axiosJWT.get(`${APIEndpoint}/api/mahasiswa/quota`, {
              params: { id, month: monthParam },
            }),
          ),
        );
        const map: QuotaMap = {};
        results.forEach((r, idx) => {
          map[String(ids[idx])] = r?.data?.data || null;
        });
        setQuotaMap(map);
      } catch (e) {
        console.error("fetch quota failed:", e);
      }
    })();
  }, [
    token,
    axiosJWT,
    APIEndpoint,
    monthParam,
    startIndex,
    endIndex,
    projects,
    perPage,
  ]); // depend on visible slice

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  return (
    <Layout title={pageTitle}>
      <div className="flex flex-col rounded-lg w-full p-6">
        <div className="flex justify-center">
          <Search
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
          />
        </div>
        {loading ? (
          <div className="flex justify-center items-center mt-4 text-lg font-bold text-blue-500">
            Loading...
          </div>
        ) : dataNotFound ? (
          <div className="flex justify-center items-center mt-4 text-lg font-bold text-red-500">
            Data tidak ditemukan
          </div>
        ) : (
          <>
            <StudentTable data={currentData} quotaMap={quotaMap} />
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
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(AvailableStudent);
