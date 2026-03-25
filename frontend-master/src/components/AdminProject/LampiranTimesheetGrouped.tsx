import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { AxiosInstance } from "axios";

interface ProjectData {
  id?: number;
  nama: string;
  anggota: string[];
  id_anggota: string[];
  durasi: number[];
  tmst_kategori_magang?: {
    tran_insentif?: {
      id_satuan?: number;
    };
  };
}

interface PaymentData {
  id: number;
  id_tmst_project: number;
  periode: string;
  total_tagihan: number;
  id_status: number;
}

interface LampiranTimesheetGroupedProps {
  projectId: string | number;
  projectData: ProjectData;
  axiosJWT: AxiosInstance;
  APIEndpoint: string;
}

const LampiranTimesheetGrouped: React.FC<LampiranTimesheetGroupedProps> = ({
  projectId,
  projectData,
  axiosJWT,
  APIEndpoint,
}) => {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loadingPayment, setLoadingPayment] = useState(true);

  // selectedMember[periode] = member index
  const [selectedMember, setSelectedMember] = useState<Record<string, number>>(
    {},
  );

  // pdfUrls keyed by `${memberId}_${periode}`
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [loadingPdf, setLoadingPdf] = useState<Record<string, boolean>>({});

  // Single recap PDF modal (for the whole project)
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapPdfUrl, setRecapPdfUrl] = useState<string | null>(null);
  const [loadingRecapPdf, setLoadingRecapPdf] = useState(false);

  // Fetch ALL payments for project (sorted by periode asc)
  useEffect(() => {
    const fetchPayments = async () => {
      if (!projectId) return;
      setLoadingPayment(true);
      try {
        const res = await axiosJWT.get(`${APIEndpoint}/api/payments`);
        const all: PaymentData[] = res.data.data || [];
        const projectPayments = all
          .filter((p) => p.id_tmst_project === Number(projectId))
          .sort((a, b) => a.periode.localeCompare(b.periode));
        setPayments(projectPayments);

        // Initialize selectedMember to 0 for each period
        const init: Record<string, number> = {};
        projectPayments.forEach((p) => {
          init[p.periode] = 0;
        });
        setSelectedMember(init);
      } catch (err) {
        console.error("Error fetching payments:", err);
        toast.error("Gagal memuat data pembayaran");
      } finally {
        setLoadingPayment(false);
      }
    };
    fetchPayments();
  }, [projectId, axiosJWT, APIEndpoint]);

  // Load PDF for a specific member + period
  const loadPdf = useCallback(
    async (memberId: string, memberName: string, periodo: string) => {
      const key = `${memberId}_${periodo}`;
      if (pdfUrls[key] || loadingPdf[key]) return;

      setLoadingPdf((prev) => ({ ...prev, [key]: true }));
      try {
        const [year, month] = periodo.split("-");
        const res = await axiosJWT.get(
          `${APIEndpoint}/api/generatePdfTimesheet`,
          {
            params: {
              id_pengguna: memberId,
              month: parseInt(month, 10),
              year: parseInt(year, 10),
              project: projectData.nama,
              option: "lihat",
            },
            responseType: "arraybuffer",
          },
        );
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        setPdfUrls((prev) => ({ ...prev, [key]: url }));
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || err?.message || "Gagal memuat";
        toast.error(`Gagal memuat timesheet ${memberName}: ${msg}`);
      } finally {
        setLoadingPdf((prev) => ({ ...prev, [key]: false }));
      }
    },
    [pdfUrls, loadingPdf, axiosJWT, APIEndpoint, projectData.nama],
  );

  // When selectedMember changes for a period, auto-load the PDF
  useEffect(() => {
    payments.forEach((payment) => {
      const idx = selectedMember[payment.periode] ?? 0;
      const memberId = projectData.id_anggota[idx];
      const memberName = projectData.anggota[idx];
      if (memberId) {
        loadPdf(memberId, memberName, payment.periode);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMember, payments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pdfUrls).forEach((url) => window.URL.revokeObjectURL(url));
      if (recapPdfUrl) window.URL.revokeObjectURL(recapPdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single recap for the WHOLE project (no month/year filter)
  const handleLoadRecapPdf = async () => {
    setLoadingRecapPdf(true);
    try {
      const res = await axiosJWT.get(`${APIEndpoint}/api/project/recap-pdf`, {
        params: { projectId },
        responseType: "arraybuffer",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (recapPdfUrl) window.URL.revokeObjectURL(recapPdfUrl);
      setRecapPdfUrl(url);
      setShowRecapModal(true);
    } catch (err) {
      console.error("Error loading recap PDF:", err);
      toast.error("Gagal memuat PDF rekapitulasi project");
    } finally {
      setLoadingRecapPdf(false);
    }
  };

  const formatPeriode = (periode: string) => {
    try {
      const [year, month] = periode.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return periode;
    }
  };

  if (loadingPayment) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">
          LAMPIRAN TIMESHEET
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Memuat data...</span>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">
          LAMPIRAN TIMESHEET
        </h2>
        <p className="text-gray-500 text-center py-4">
          Tidak ada data pembayaran ditemukan.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header: title + single PDF Rekapitulasi button */}
        <div className="flex items-center justify-between border-b pb-2 mb-6">
          <h2 className="text-2xl font-bold">LAMPIRAN TIMESHEET</h2>
          <button
            onClick={handleLoadRecapPdf}
            disabled={loadingRecapPdf}
            className="btn bg-[#FDCF6F] hover:bg-[#E6B85C] text-black px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap text-sm"
          >
            {loadingRecapPdf ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                Memuat...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2 inline"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                PDF Rekapitulasi
              </>
            )}
          </button>
        </div>

        {/* Render one section per period */}
        {payments.map((payment) => {
          const periode = payment.periode;
          const activeMemberIdx = selectedMember[periode] ?? 0;
          const activeMemberId = projectData.id_anggota[activeMemberIdx];
          const pdfKey = `${activeMemberId}_${periode}`;

          return (
            <div key={periode} className="mb-10">
              {/* Period label */}
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                {formatPeriode(periode)}:
              </h3>

              {/* Member tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {projectData.anggota.map((anggota, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedMember((prev) => ({
                        ...prev,
                        [periode]: idx,
                      }));
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeMemberIdx === idx
                        ? "bg-primary text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {anggota}
                  </button>
                ))}
              </div>

              {/* PDF viewer */}
              <div className="border rounded-lg overflow-hidden">
                {loadingPdf[pdfKey] ? (
                  <div className="h-[600px] flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">Memuat timesheet...</p>
                    </div>
                  </div>
                ) : pdfUrls[pdfKey] ? (
                  <iframe
                    src={pdfUrls[pdfKey]}
                    className="w-full h-[600px]"
                    title={`Timesheet ${projectData.anggota[activeMemberIdx]} - ${formatPeriode(periode)}`}
                  />
                ) : (
                  <div className="h-[600px] flex items-center justify-center bg-gray-50">
                    <p className="text-gray-500">
                      Tidak dapat memuat timesheet
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal PDF Rekapitulasi */}
      {showRecapModal && recapPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold">PDF Rekapitulasi Project</h3>
              <button
                onClick={() => {
                  setShowRecapModal(false);
                  if (recapPdfUrl) {
                    window.URL.revokeObjectURL(recapPdfUrl);
                    setRecapPdfUrl(null);
                  }
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={recapPdfUrl}
                className="w-full h-full"
                title="PDF Rekapitulasi Project"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LampiranTimesheetGrouped;
