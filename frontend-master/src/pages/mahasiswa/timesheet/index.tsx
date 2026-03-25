import Layout from "@/src/components/Layout";
import { MdAdd } from "react-icons/md";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Link from "next/link";
import TimesheetTable from "@/src/components/Timesheet/TimesheetTable";
import Pagination from "@/src/components/Pagination";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { useRole } from "@/src/context/RoleContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import CryptoJS from "crypto-js";
import { getStatusBadgeClassName } from "@/src/constants/badge";
import { showDeleteConfirmation, showError } from "@/src/utils/swalHelper";

interface DecodedToken {
  exp: number;
}

type Props = {
  user: any;
  role: string;
  id: string;
};

const Timesheet = ({ user: _user, role: _role, id }: Props) => {
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [perPage, setPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const [totalPages, setTotalPages] = useState(1);
  const { setId } = useRole();
  const [dataNotFound, setDataNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const pageTitle = "Timesheet";
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // State untuk pengecekan signature
  const [signatureChecking, setSignatureChecking] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    setId(id);
  }, [id, setId]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${ApiEndPoint}/token`, {
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
  }, [ApiEndPoint, router]);

  useEffect(() => {
    if (router.isReady) {
      const queryPage = router.query.page
        ? parseInt(router.query.page as string, 10)
        : 1;
      setCurrentPage(queryPage);
    }
  }, [router.isReady, router.query.page]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${ApiEndPoint}/token`, {
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
  }, [token, expire, ApiEndPoint]);

  useEffect(() => {
    const fetchAllTimesheets = async () => {
      setLoading(true);
      try {
        const url = filter
          ? `${ApiEndPoint}/api/timesheet/getOneShow/${id}?page=${currentPage}&size=${perPage}&project=${filter}`
          : `${ApiEndPoint}/api/timesheet/getOneShow/${id}?page=${currentPage}&size=${perPage}`;
        const res = await axiosJWT.get(url);
        setTimesheets(res.data.data);
        setTotalPages(res.data.paging.total_page);
        setDataNotFound(
          res.data.data.length === 0 || res.data.data.length === null,
        );
      } catch (_err) {
      } finally {
        setLoading(false);
      }
    };

    const checkSignature = async () => {
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/student/${id}`,
        );
        if (res.data?.url) {
          setHasSignature(true);
          setSignatureChecking(false);
          fetchAllTimesheets();
        } else {
          throw new Error("Signature not found");
        }
      } catch (e) {
        setSignatureChecking(false);
        toast.warning("Silakan lengkapi tanda tangan Anda terlebih dahulu");
        setTimeout(() => {
          router.push("/mahasiswa/signature");
        }, 3000);
      }
    };

    if (token) {
      checkSignature();
    }
  }, [filter, ApiEndPoint, currentPage, perPage, token, axiosJWT, id, router]);

  // Mobile accordion state
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggleAccordion = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  const handleDeleteMobile = async (projectId: any, userId: any, date: any) => {
    const result = await showDeleteConfirmation({
      title: "Hapus data?",
      text: "Data akan dihapus permanen",
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        await axiosJWT.delete(
          `${ApiEndPoint}/api/timesheet/deleteMany/${projectId}`,
          {
            params: { userId, date },
          },
        );
        toast.success("Data telah dihapus.");
        router.reload();
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Gagal menghapus data";
        await showError({ title: "Error", text: errorMessage });
      }
    }
  };

  const handleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handlePageChange = ({ selected }: { selected: number }) => {
    const page = selected + 1;
    setCurrentPage(page);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page },
    });
  };

  useEffect(() => {
    if (timesheets.length === 0 && currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      router.push({
        pathname: router.pathname,
        query: { ...router.query, page: prevPage },
      });
    }
  }, [timesheets, currentPage, router]);

  if (signatureChecking || !hasSignature) {
    return (
      <Layout title={pageTitle}>
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-center text-blue-600 font-bold">
            Memeriksa data tanda tangan...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex justify-between gap-4">
            <Link
              href={"timesheet/new"}
              className="btn btn-sm sm:btn-md bg-primary flex items-center justify-center rounded-lg border-none"
            >
              <div className="text-white">
                <MdAdd className="text-base text-blue-100" color="white" />{" "}
              </div>
              {""}Add Timesheet
            </Link>
            <input
              type="text"
              name="searchProject"
              className="input input-bordered input-secondary w-72 sm:w-72 input-sm sm:input-md shadow-inner"
              onChange={handleFilter}
              placeholder="Search..."
            />
          </div>

          <div className="rounded-lg">
            {loading ? (
              <p className="text-center text-blue-600 font-bold">Loading...</p>
            ) : dataNotFound ? (
              <p className="text-center text-red-600 font-bold">
                Data tidak ditemukan
              </p>
            ) : (
              <>
                {/* Mobile accordion view */}
                <div className="block sm:hidden w-full">
                  {timesheets.length > 0 ? (
                    <div className="space-y-2">
                      {timesheets.map((value: any, idx: number) => {
                        const date = value.tanggal_mulai
                          ? new Date(value.tanggal_mulai)
                          : new Date();
                        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
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
                        const encodedProjectId =
                          encodeURIComponent(encryptedProjectId);
                        const encodedDate = encodeURIComponent(encryptedDate);
                        const encodedUserId =
                          encodeURIComponent(encryptedUserId);
                        const isOpen = openIndex === idx;
                        return (
                          <div
                            key={value.id_project}
                            className={`collapse collapse-arrow border border-gray-200 bg-base-100 min-w-0 rounded-lg overflow-hidden ${isOpen ? "collapse-open" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleAccordion(idx)}
                              className="w-full text-left collapse-title text-sm font-medium flex items-center justify-between pr-4 min-w-0"
                            >
                              <div className="truncate flex-1 min-w-0">
                                {value.nama_project}
                              </div>
                              <span
                                className={getStatusBadgeClassName(
                                  value.status,
                                  "ml-2 text-[10px] whitespace-nowrap",
                                )}
                              >
                                {value.status}
                              </span>
                            </button>
                            <div className="collapse-content text-xs space-y-2">
                              <div>
                                <div className="font-semibold">Periode:</div>
                                <div className="text-gray-600 text-sm">
                                  {value.tanggal_mulai && value.tanggal_selesai
                                    ? `${new Date(value.tanggal_mulai).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })} - ${new Date(value.tanggal_selesai).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}`
                                    : "Tanpa batas waktu"}
                                </div>
                              </div>
                              <div className="flex gap-2">
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
                                  className="btn btn-ghost btn-xs flex-1"
                                >
                                  View
                                </Link>
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
                                  className="btn btn-ghost btn-xs flex-1"
                                >
                                  Edit
                                </Link>
                                <button
                                  onClick={() =>
                                    handleDeleteMobile(
                                      value.id_project,
                                      id,
                                      formattedDate,
                                    )
                                  }
                                  className="btn btn-ghost btn-xs text-red-600 flex-1"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      Data tidak ditemukan
                    </div>
                  )}
                </div>

                {/* Desktop table view - hidden on mobile */}
                <div className="hidden sm:block">
                  <TimesheetTable
                    data={timesheets}
                    id={id}
                    perPage={perPage}
                    currentPage={currentPage}
                  />
                </div>

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
export default withPage(Timesheet);
