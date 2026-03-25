import Layout from "@/src/components/Layout";
import { MdAdd } from "react-icons/md";
import { FaFilePdf, FaDownload, FaEye } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import React, { useState, useEffect, useMemo } from "react";
import ProjectTable from "@/src/components/MyProject/ProjectTable";
import Pagination from "@/src/components/Pagination";
import axios from "axios";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { useRole } from "@/src/context/RoleContext";
import { showDeleteConfirmation } from "@/src/utils/swalHelper";

interface DecodedToken {
  exp: number;
}

type Props = {
  id: string | number;
  role?: string;
};

const MyProject = ({ id }: Props) => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const pageTitle = "My Project";
  const [filter, setFilter] = useState("");
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [perPage, setPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [Category, setCategory] = useState<{ id: number; kategori: string }[]>(
    [],
  );
  const [paymentData, setPaymentData] = useState<Record<string, unknown>[]>([]);
  const router = useRouter();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dataNotFound, setDataNotFound] = useState(false);
  const { setId } = useRole();

  // PDF states
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    setId(String(id ?? null));
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
      } catch {
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
          ? `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}&namaProjek=${filter}`
          : `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}`;
        const response = await axiosJWT.get(url);
        setProjects(response.data.data.data);
        setTotalPages(response.data.data.paging.total_page);
        setDataNotFound((response.data.data.data || []).length === 0);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [filter, APIEndpoint, currentPage, perPage, token, axiosJWT, router, id]);

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && projects.length === 0 && currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      router.push({
        pathname: router.pathname,
        query: { ...router.query, page: prevPage },
      });
    }
  }, [projects, hydrated, currentPage, router]);

  useEffect(() => {
    const fetchCat = async () => {
      try {
        const response = await axiosJWT.get(
          `${APIEndpoint}/api/internCategory`,
        );
        const result = await response.data;
        setCategory(result.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    if (hydrated && token) fetchCat();
  }, [hydrated, token, APIEndpoint, axiosJWT]);

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        const response = await axiosJWT.get(`${APIEndpoint}/api/payments`);
        setPaymentData(response.data.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    if (hydrated && token) fetchPaymentData();
  }, [hydrated, token, APIEndpoint, axiosJWT]);

  const confirmDeletion = async (projectId: number) => {
    const result = await showDeleteConfirmation({
      title: "Konfirmasi Penghapusan",
      text: "Apakah Anda yakin ingin menghapus data ini?",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await deletion(projectId);
    }
  };

  const deletion = async (projectId: number) => {
    try {
      const response_project = await axiosJWT.delete(
        `${APIEndpoint}/api/project/deleteMany/${projectId}`,
      );
      if (response_project.status !== 200) {
        const errorMessage = await response_project.data;
        throw new Error(errorMessage.message);
      }
      const response_master = await axiosJWT.delete(
        `${APIEndpoint}/api/masterProject/${projectId}`,
      );
      if (response_master.status !== 200) {
        const errorMessage = await response_master.data;
        throw new Error(errorMessage.message);
      }
      toast.success("Data berhasil dihapus!");

      // Refresh the project list with the correct endpoint and user ID
      const url = filter
        ? `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}&namaProjek=${filter}`
        : `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}`;
      const response_master_updated = await axiosJWT.get(url);

      const updatedProjects = response_master_updated.data.data.data || [];
      const updatedTotalPages =
        response_master_updated.data.data.paging.total_page || 1;

      setProjects(updatedProjects);
      setTotalPages(updatedTotalPages);
      setDataNotFound(updatedProjects.length === 0);

      // If current page has no data and we're not on page 1, go to previous page
      if (updatedProjects.length === 0 && currentPage > 1) {
        const prevPage = currentPage - 1;
        setCurrentPage(prevPage);
        router.push({
          pathname: router.pathname,
          query: { ...router.query, page: prevPage },
        });
      }

      // Refresh payment data to update the display
      const paymentResponse = await axiosJWT.get(`${APIEndpoint}/api/payments`);
      setPaymentData(paymentResponse.data.data || []);

      const response_category_updated = await axiosJWT.get(
        `${APIEndpoint}/api/internCategory`,
      );
      const result_category_updated = await response_category_updated.data;
      setCategory(result_category_updated.data || []);
    } catch (error: unknown) {
      const msg = ((): string => {
        try {
          const parsed = JSON.parse((error as any)?.request?.response || "{}");
          return (
            parsed?.message ||
            String((error as any)?.message || "Unknown error")
          );
        } catch {
          return String((error as any)?.message || "Unknown error");
        }
      })();
      toast.error(`Gagal menghapus data: ${msg}`);
      console.error((error as any)?.request?.response || error);
    }
  };

  // Handler untuk mengajukan timesheet ke admin approval
  const handleSubmitTimesheet = async (
    projectId: number,
    _projectName: string,
    totalInsentif: number,
    periode?: string,
  ) => {
    // Use provided periode or fallback to current date for period (YYYY-MM format)
    const selectedPeriode =
      periode ||
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      })();

    try {
      // Create payment with status "Submitted" (id_status = 1)
      const response = await axiosJWT.post(`${APIEndpoint}/api/payments`, {
        id_tmst_project: projectId,
        id_status: 1, // "Submitted" status
        periode: selectedPeriode,
        total_tagihan: totalInsentif,
      });

      if (response.status === 200) {
        // Refresh payment data
        const paymentResponse = await axiosJWT.get(
          `${APIEndpoint}/api/payments`,
        );
        setPaymentData(paymentResponse.data.data || []);

        // Refresh project list
        const url = filter
          ? `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}&namaProjek=${filter}`
          : `${APIEndpoint}/api/masterProject/myproject/${id}?page=${currentPage}&size=${perPage}`;
        const projectResponse = await axiosJWT.get(url);
        setProjects(projectResponse.data.data.data);

        // Return true to indicate success (so SwalHelper can show success)
        return Promise.resolve();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage =
        err.response?.data?.message || "Gagal mengajukan timesheet.";
      // Re-throw with proper error message so SwalHelper can catch it
      throw new Error(errorMessage);
    }
  };

  // PDF handlers
  const handleViewPdf = async () => {
    if (!token) return;
    setPdfLoading(true);
    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/myproject/recap-pdf?userId=${id}&year=${selectedYear}&option=lihat`,
      );

      // Check if response is JSON with success: false (no data)
      if (
        typeof response.data === "object" &&
        response.data.success === false
      ) {
        toast.info(
          response.data.message ||
            `Tidak ada data rekapitulasi untuk tahun ${selectedYear}`,
        );
        return;
      }

      setPdfDataUri(response.data);
      setShowPdfModal(true);
    } catch (error: unknown) {
      const msg = (() => {
        try {
          const parsed = JSON.parse((error as any)?.request?.response || "{}");
          return parsed?.message || "Gagal memuat PDF";
        } catch {
          return "Gagal memuat PDF";
        }
      })();
      toast.error(msg);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!token) return;
    setPdfLoading(true);
    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/myproject/recap-pdf?userId=${id}&year=${selectedYear}&option=unduh`,
        { responseType: "blob" },
      );

      // Check if response is JSON error (blob might contain JSON)
      const contentType = response.headers["content-type"];
      if (contentType && contentType.includes("application/json")) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        if (json.success === false) {
          toast.info(
            json.message ||
              `Tidak ada data rekapitulasi untuk tahun ${selectedYear}`,
          );
          return;
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Rekapitulasi_MyProject_${selectedYear}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF berhasil diunduh!");
    } catch (error: unknown) {
      const msg = (() => {
        try {
          const parsed = JSON.parse((error as any)?.request?.response || "{}");
          return parsed?.message || "Gagal mengunduh PDF";
        } catch {
          return "Gagal mengunduh PDF";
        }
      })();
      toast.error(msg);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!hydrated) return null;

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/user/myproject/new"
                className="btn bg-primary flex items-center justify-center"
              >
                <div className="text-white">
                  <MdAdd className="text-xl text-blue-100" color="white" />
                </div>
                New Project
              </Link>

              {/* PDF Section */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                <FaFilePdf className="text-red-500" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="select select-bordered select-sm py-0.5"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleViewPdf}
                  disabled={pdfLoading}
                  className="btn btn-sm btn-info text-white"
                  title="Lihat PDF"
                >
                  <FaEye />
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="btn btn-sm btn-success text-white"
                  title="Download PDF"
                >
                  <FaDownload />
                </button>
                {pdfLoading && (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
              </div>
            </div>

            <input
              type="text"
              name="searchProject"
              className="input input-bordered input-secondary w-72 shadow-inner"
              onChange={handleFilter}
              placeholder="Cari..."
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
                <ProjectTable
                  data={projects}
                  category={Category}
                  filter={filter}
                  onDelete={confirmDeletion}
                  onSubmitTimesheet={handleSubmitTimesheet}
                  currentPage={currentPage}
                  perPage={perPage}
                  paymentData={paymentData}
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

      {/* PDF Modal */}
      {showPdfModal && pdfDataUri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">
                Rekapitulasi Project Tahun {selectedYear}
              </h3>
              <button
                onClick={() => {
                  setShowPdfModal(false);
                  setPdfDataUri(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                <IoClose className="text-xl" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={pdfDataUri}
                className="w-full h-full rounded"
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;
export default withPage(MyProject);
