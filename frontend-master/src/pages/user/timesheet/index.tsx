import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo } from "react";
import { useSignature } from "@/src/context/SignatureContext";
import { useRouter } from "next/router";
import Pagination from "@/src/components/Pagination";
import { toast } from "react-toastify";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import MasterTable from "@/src/components/payment/paymentTable";
import { useRole } from "@/src/context/RoleContext";
import { EyeIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { IoClose } from "react-icons/io5";
import PageLoader from "@/src/components/PageLoader";
// import "react-toastify/dist/ReactToastify.css";

interface DecodedToken {
  exp: number;
  sub?: string;
  id?: string;
  userId?: string;
}

interface RecapFile {
  displayName: string;
  reportType: string;
}

interface MonthAccordion {
  month: number;
  expanded: boolean;
  files: RecapFile[];
  loading: boolean;
}

const SubmitPayment = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const { id: contextUserId } = useRole();
  const [timesheetData, setTimesheetData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [perPage, setPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataNotFound, setDataNotFound] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // State untuk accordion rekapitulasi
  const [showAccordion, setShowAccordion] = useState(false);
  const [monthAccordions, setMonthAccordions] = useState<MonthAccordion[]>([]);
  const [recapChecking, setRecapChecking] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

  // State untuk PDF modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [_pdfLoading, setPdfLoading] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${APIEndpoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (error: unknown) {
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

  useEffect(() => {
    const fetchTimesheetData = async () => {
      if (!contextUserId) {
        return;
      }

      setLoading(true);
      try {
        let queryParam = `?page=${currentPage}&size=${perPage}`;
        queryParam += `&pic=${contextUserId}`;

        if (searchTerm) {
          queryParam += `&project=${searchTerm}`;
        }

        const timesheetResponse = await axiosJWT.get(
          `${APIEndpoint}/api/timesheet/submitPayment${queryParam}`,
        );
        const responsePayload = timesheetResponse.data;

        setTimesheetData(responsePayload.data);
        setTotalPages(responsePayload.paging.total_page);
        setDataNotFound(responsePayload.data.length === 0);
      } catch (error) {
        toast.error("Tidak dapat memuat data timesheet.");
        console.error("Error fetching timesheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchPaymentData = async () => {
      try {
        const paymentResponse = await axiosJWT.get(
          `${APIEndpoint}/api/payments`,
        );
        setPaymentData(paymentResponse.data.data);
      } catch (error) {
        toast.error("Tidak dapat memuat data pembayaran.");
        console.error("Error fetching payment data:", error);
      }
    };

    if (token && contextUserId) {
      fetchTimesheetData();
      fetchPaymentData();
    }
  }, [
    token,
    contextUserId,
    currentPage,
    perPage,
    searchTerm,
    APIEndpoint,
    axiosJWT,
  ]);

  const handlePageChange = ({ selected }: { selected: number }) => {
    setCurrentPage(selected + 1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  useEffect(() => {
    setMonthAccordions([]);
  }, []);

  const handleViewRecap = async (year?: number) => {
    const targetYear = year ?? selectedYear;
    setShowAccordion(true);

    if (!contextUserId) {
      toast.error("User ID tidak ditemukan");
      return;
    }

    setRecapChecking(true);
    setMonthAccordions([]);

    try {
      const monthChecks = Array.from({ length: 12 }, (_, i) => i + 1).map((m) =>
        axiosJWT
          .get(
            `${APIEndpoint}/api/generateUserRecap?userId=${contextUserId}&month=${m}&year=${targetYear}`,
          )
          .then((res) => ({
            month: m,
            hasData: !!(
              res.data &&
              res.data.success &&
              res.data.files &&
              res.data.files.length > 0
            ),
            files: res.data?.files || [],
          }))
          .catch(() => ({ month: m, hasData: false, files: [] })),
      );

      const results = await Promise.all(monthChecks);

      const availableMonths: MonthAccordion[] = results
        .filter((r) => r.hasData)
        .map((r) => ({
          month: r.month,
          expanded: false,
          files: r.files,
          loading: false,
        }));

      if (availableMonths.length === 0) {
        toast.info(`Tidak ada data rekapitulasi untuk tahun ${targetYear}`);
      }
      setMonthAccordions(availableMonths);
      setRecapChecking(false);
    } catch (err) {
      console.error("Error checking months:", err);
      toast.error("Gagal memeriksa data rekapitulasi.");
      setMonthAccordions([]);
      setRecapChecking(false);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    handleViewRecap(year);
  };

  const handleCloseAccordion = () => {
    setShowAccordion(false);
    setMonthAccordions((prev) => prev.map((m) => ({ ...m, expanded: false })));
  };

  const handleMonthClick = async (monthIndex: number) => {
    const month = monthAccordions[monthIndex];

    if (month.expanded) {
      setMonthAccordions((prev) =>
        prev.map((m, i) => (i === monthIndex ? { ...m, expanded: false } : m)),
      );
      return;
    }

    setMonthAccordions((prev) =>
      prev.map((m, i) => ({
        ...m,
        expanded: i === monthIndex,
      })),
    );

    if (month.files.length > 0) {
      return;
    }

    if (!contextUserId) {
      toast.error("User ID tidak ditemukan");
      return;
    }

    setMonthAccordions((prev) =>
      prev.map((m, i) => (i === monthIndex ? { ...m, loading: true } : m)),
    );

    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/generateUserRecap?userId=${contextUserId}&month=${month.month}`,
      );

      if (
        response.data.success &&
        response.data.data &&
        response.data.data.length > 0
      ) {
        const files: RecapFile[] = [
          { displayName: "Rekapitulasi Mahasiswa", reportType: "main" },
        ];

        setMonthAccordions((prev) =>
          prev.map((m, i) =>
            i === monthIndex ? { ...m, files, loading: false } : m,
          ),
        );
      } else {
        toast.error("Tidak ada data rekapitulasi untuk bulan ini");
        setMonthAccordions((prev) =>
          prev.map((m, i) =>
            i === monthIndex ? { ...m, loading: false, expanded: false } : m,
          ),
        );
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Gagal memuat data rekapitulasi",
      );
      console.error("Error fetching recap files:", error);
      setMonthAccordions((prev) =>
        prev.map((m, i) =>
          i === monthIndex ? { ...m, loading: false, expanded: false } : m,
        ),
      );
    }
  };

  const handleViewPdf = async (month: number, reportType: string) => {
    if (!contextUserId) {
      toast.error("User ID tidak ditemukan");
      return;
    }

    setPdfLoading(true);
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    setPdfTitle(`Rekapitulasi ${monthNames[month - 1]} ${selectedYear}`);

    try {
      // If we have a lecturer signature in context, save it to server first
      if (lecturerSignature) {
        try {
          await axiosJWT.post(`${APIEndpoint}/api/signature/lecturer`, {
            key: `user_${contextUserId}`,
            dataUrl: lecturerSignature,
          });
        } catch (sigErr) {
          // don't block preview if save fails
          console.warn(
            "Failed to save lecturer signature before preview:",
            sigErr,
          );
        }
      }

      const url = `${APIEndpoint}/api/generateUserRecap?userId=${contextUserId}&month=${month}&year=${selectedYear}&option=lihat&reportType=${reportType}`;
      const response = await axiosJWT.get(url);

      if (response.data) {
        setPdfDataUri(response.data);
        setShowPdfModal(true);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menampilkan PDF");
      console.error("Error viewing PDF:", error);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async (month: number, reportType: string) => {
    if (!contextUserId) {
      toast.error("User ID tidak ditemukan");
      return;
    }

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const monthName = monthNames[month - 1];

    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/generateUserRecap?userId=${contextUserId}&month=${month}&year=${selectedYear}&option=unduh&reportType=${reportType}`,
        { responseType: "arraybuffer" },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Rekapitulasi_Pekerja_Paruh_Waktu_${monthName}_${selectedYear}_${reportType}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF berhasil diunduh");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal mengunduh PDF");
      console.error("Error downloading PDF:", error);
    }
  };

  const getMonthName = (month: number): string => {
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return monthNames[month - 1];
  };
  const { lecturerSignature } = useSignature();

  const _projectCount = Array.isArray(timesheetData) ? timesheetData.length : 0;

  return (
    <Layout title="Time Sheet">
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleViewRecap()}
                className="btn bg-primary flex items-center justify-center text-white"
              >
                Lihat Rekapitulasi
              </button>
            </div>

            <input
              type="text"
              name="searchProject"
              value={searchTerm}
              onChange={handleSearchChange}
              className="input input-bordered input-secondary w-72 shadow-inner"
              placeholder="Cari berdasarkan nama project"
            />
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
                <MasterTable
                  timesheetData={timesheetData}
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

      {showAccordion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                  Rekapitulasi Pekerja Paruh Waktu
                </h2>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="select select-bordered text-sm select-sm w-24 sm:w-auto"
                  disabled={recapChecking}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCloseAccordion}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {recapChecking && (
                <div className="p-4 text-center text-gray-500">
                  Memeriksa ketersediaan rekapitulasi...
                </div>
              )}

              {!recapChecking && monthAccordions.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  Tidak ada bulan dengan rekapitulasi untuk tahun {selectedYear}
                  .
                </div>
              )}

              {!recapChecking &&
                monthAccordions.length > 0 &&
                monthAccordions.map((month, index) => (
                  <div key={month.month} className="mb-2">
                    <button
                      onClick={() => handleMonthClick(index)}
                      className="w-full flex justify-between items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                    >
                      <span className="font-semibold text-gray-800">
                        {getMonthName(month.month)} {selectedYear}
                      </span>
                      <span
                        className={`transform transition-transform duration-300 ${month.expanded ? "rotate-180" : ""}`}
                      >
                        ▼
                      </span>
                    </button>

                    {month.expanded && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {month.loading ? (
                          <div className="p-4 text-center text-gray-500">
                            Memuat data...
                          </div>
                        ) : month.files.length > 0 ? (
                          month.files.map((file, fileIndex) => (
                            <div
                              key={fileIndex}
                              className="flex justify-between items-center px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                            >
                              <span className="text-sm text-gray-700">
                                {file.displayName}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleViewPdf(month.month, file.reportType)
                                  }
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                  title="Lihat PDF"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDownloadPdf(
                                      month.month,
                                      file.reportType,
                                    )
                                  }
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                  title="Download PDF"
                                >
                                  <ArrowDownTrayIcon className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            Tidak ada data untuk bulan ini
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleCloseAccordion}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && pdfDataUri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{pdfTitle}</h3>
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

export default SubmitPayment;
