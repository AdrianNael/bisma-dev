import Layout from "@/src/components/Layout";
import { useState, useEffect, useMemo } from "react";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { toast } from "react-toastify";
import { useRole } from "@/src/context/RoleContext";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useRouter } from "next/router";
import ModalDetailLowongan from "@/src/components/ModalDetailLowongan";
import { FaEye } from "react-icons/fa";

const toDateStr = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Strip user name suffix from project name (e.g., "Project - User Name" -> "Project")
const stripUserSuffix = (nama: string): string => {
  const parts = nama.split(" - ");
  return parts.length > 1 ? parts.slice(0, -1).join(" - ") : nama;
};

type ApplicationItem = {
  id: number;
  tanggal_lamaran: string;
  status: "Pending" | "Accepted" | "Rejected";
  project: {
    id: number;
    nama: string;
    kriteria: string;
    kategori: string;
    pic: string;
    pic_email?: string;
    kuota: number;
    pendaftaran_mulai: string;
    pendaftaran_selesai: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    insentif_per_jam: number;
    durasi_satuan: number | null;
    satuan_insentif: string;
    durasi_default?: number | null;
  };
};

type PageProps = {
  name: string;
  role: string;
  id: string;
  username: string;
};

interface DecodedToken {
  exp: number;
}

const ApplicationHistoryPage = ({ name, role, id }: PageProps) => {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<ApplicationItem | null>(null);
  const { setRole, setName, setId } = useRole();
  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (role && name && id) {
      setRole(role);
      if (setName) setName(name);
      if (setId) setId(id);
    }
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    } else {
      router.push("/login");
    }
  }, [role, name, id, setRole, setName, setId, router]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const decodedToken: DecodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            try {
              const response = await axios.get(`${API_ENDPOINT}/token`, {
                withCredentials: true,
              });
              const newToken = response.data.data.token;
              localStorage.setItem("token", newToken);
              setToken(newToken);
              config.headers.Authorization = `Bearer ${newToken}`;
            } catch (error) {
              router.push("/login");
              return Promise.reject(error);
            }
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
    return instance;
  }, [token, API_ENDPOINT, router]);

  useEffect(() => {
    if (!token) return;

    const fetchApplicationHistory = async () => {
      setIsLoading(true);
      try {
        const response = await axiosJWT.get(
          `${API_ENDPOINT}/api/mahasiswa/applications`,
        );
        setApplications(response.data.data || []);
      } catch (error) {
        console.error("Failed to fetch application history:", error);
        toast.error("Failed to load application history.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicationHistory();
  }, [token, axiosJWT, API_ENDPOINT]);

  const handleOpenModal = (application: ApplicationItem) => {
    setSelectedApplication(application);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedApplication(null);
  };

  // accordion state for mobile: index of open item (or null)
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleAccordion = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  // filter & pagination state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showPerPage, setShowPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredApplications = useMemo(() => {
    if (!startDate && !endDate) return applications;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return applications.filter((app) => {
      const appDate = new Date(app.tanggal_lamaran);
      if (start && appDate < start) return false;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (appDate > endOfDay) return false;
      }
      return true;
    });
  }, [applications, startDate, endDate]);

  const totalItems = filteredApplications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / showPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const paginatedApplications = useMemo(() => {
    const startIdx = (currentPage - 1) * showPerPage;
    return filteredApplications.slice(startIdx, startIdx + showPerPage);
  }, [filteredApplications, currentPage, showPerPage]);

  return (
    <Layout title="Application History">
      <div className="p-4 md:p-6 overflow-hidden">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input input-sm"
                />
                <label className="text-sm font-medium">s.d.</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input input-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setCurrentPage(1);
                  }}
                  className="btn btn-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Memuat data...</div>
        ) : (
          <>
            {/* Mobile view - controlled accordion (single open) */}
            <div className="block sm:hidden w-full">
              {paginatedApplications.length > 0 ? (
                <div className="space-y-2">
                  {paginatedApplications.map((application, idx) => {
                    const isOpen = openIndex === idx;
                    return (
                      <div
                        key={application.id}
                        className={`collapse collapse-arrow border border-gray-200 bg-base-100 rounded-lg overflow-hidden ${isOpen ? "collapse-open" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAccordion(idx)}
                          className="w-full text-left collapse-title text-xs sm:text-sm font-medium flex items-center justify-between pr-8 sm:pr-12"
                        >
                          <span className="truncate flex-1 mr-2 max-w-[60%]">
                            {stripUserSuffix(application.project.nama)}
                          </span>
                          <span
                            className={`py-1 px-2 rounded-full text-[9px] sm:text-[10px] font-semibold whitespace-nowrap shrink-0
                              ${application.status === "Accepted" ? "bg-green-100 text-green-700" : ""}
                              ${application.status === "Rejected" ? "bg-red-100 text-red-700" : ""}
                              ${application.status === "Pending" ? "bg-yellow-100 text-yellow-700" : ""}
                            `}
                          >
                            {application.status}
                          </span>
                        </button>
                        <div className="collapse-content text-xs space-y-2">
                          <div>
                            <span className="font-semibold">
                              Tanggal Melamar:
                            </span>
                            <p className="text-gray-600">
                              {new Date(
                                application.tanggal_lamaran,
                              ).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            <button
                              onClick={() => handleOpenModal(application)}
                              className="btn btn-sm w-full mt-2 bg-[#0A5F59] text-white border-none hover:bg-[#0A5F59]/90"
                              style={{ backgroundColor: "#0A5F59" }}
                            >
                              Lihat Detail
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500 text-sm">
                  Anda belum pernah melamar pekerjaan apapun.
                </div>
              )}
            </div>

            {/* Desktop view - Table */}
            <div className="hidden sm:block overflow-x-auto bg-[#dfebe9] rounded-lg">
              <table className="w-full text-center bg-[#F5F9F8] table-auto">
                <thead>
                  <tr className="border-b border-gray-200 shadow-md">
                    <th className="py-3 px-4 font-semibold text-sm text-gray-600">
                      #
                    </th>
                    <th className="py-3 px-4 font-semibold text-sm text-gray-600">
                      Nama Proyek
                    </th>
                    <th className="py-3 px-4 font-semibold text-sm text-gray-600">
                      Tanggal Melamar
                    </th>
                    <th className="py-3 px-4 font-semibold text-sm text-gray-600">
                      Status
                    </th>
                    <th className="py-3 px-4 font-semibold text-sm text-gray-600">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApplications.length > 0 ? (
                    paginatedApplications.map((application, index) => (
                      <tr
                        key={application.id}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {(currentPage - 1) * showPerPage + index + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {stripUserSuffix(application.project.nama)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {new Date(
                            application.tanggal_lamaran,
                          ).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`py-1 px-3 rounded-full text-xs font-semibold
                                ${application.status === "Accepted" ? "bg-green-100 text-green-700" : ""}
                                ${application.status === "Rejected" ? "bg-red-100 text-red-700" : ""}
                                ${application.status === "Pending" ? "bg-yellow-100 text-yellow-700" : ""}
                              `}
                          >
                            {application.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleOpenModal(application)}
                            className="text-[#252B42] hover:text-[#252B42]/80"
                            title="Lihat Detail Lowongan"
                          >
                            <FaEye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-10 text-gray-500"
                      >
                        Anda belum pernah melamar pekerjaan apapun.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Pagination controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Show</label>
                  <select
                    value={showPerPage}
                    onChange={(e) => {
                      setShowPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="select text-xs select-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <div className="text-sm">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedApplication && (
          <ModalDetailLowongan
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            lowongan={{
              ...selectedApplication.project,
              nama: stripUserSuffix(selectedApplication.project.nama),
              pendaftaran_mulai: toDateStr(
                selectedApplication.project.pendaftaran_mulai,
              ),
              pendaftaran_selesai: toDateStr(
                selectedApplication.project.pendaftaran_selesai,
              ),
              tanggal_mulai: toDateStr(
                selectedApplication.project.tanggal_mulai,
              ),
              tanggal_selesai: toDateStr(
                selectedApplication.project.tanggal_selesai,
              ),
            }}
            onApply={() => {}}
            applicationStatus={selectedApplication.status}
          />
        )}
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(ApplicationHistoryPage);
