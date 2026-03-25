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

interface LampiranTimesheetProps {
  projectId: string | number;
  projectData: ProjectData;
  axiosJWT: AxiosInstance;
  APIEndpoint: string;
}

const formatPeriode = (periode: string): string => {
  try {
    const [year, month] = periode.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  } catch {
    return periode;
  }
};

const PdfIcon = () => (
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
);

const RecapModal: React.FC<{
  url: string;
  onClose: () => void;
}> = ({ url, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-xl font-bold">PDF Rekapitulasi Project</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full"
          title="PDF Rekapitulasi Project"
        />
      </div>
    </div>
  </div>
);

const PdfViewer: React.FC<{
  loading: boolean;
  url?: string;
  title: string;
}> = ({ loading, url, title }) => (
  <div className="border rounded-lg overflow-hidden">
    {loading ? (
      <div className="h-[600px] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Memuat timesheet...</p>
        </div>
      </div>
    ) : url ? (
      <iframe src={url} className="w-full h-[600px]" title={title} />
    ) : (
      <div className="h-[600px] flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Tidak dapat memuat timesheet</p>
      </div>
    )}
  </div>
);

const LampiranTimesheet: React.FC<LampiranTimesheetProps> = ({
  projectId,
  projectData,
  axiosJWT,
  APIEndpoint,
}) => {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loadingPayment, setLoadingPayment] = useState(true);

  // selectedMember keyed by periode (for grouped) or "single" (for single-month)
  const [selectedMember, setSelectedMember] = useState<Record<string, number>>(
    {},
  );

  // PDF cache: key = `${memberId}_${periode}`
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [loadingPdf, setLoadingPdf] = useState<Record<string, boolean>>({});

  // Recap PDF modal
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapPdfUrl, setRecapPdfUrl] = useState<string | null>(null);
  const [loadingRecapPdf, setLoadingRecapPdf] = useState(false);

  // Fetch all payments for this project, sorted by periode
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

        // Initialize selectedMember for each period to index 0
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

  // Load a specific member's PDF for a given period
  const loadPdf = useCallback(
    async (memberId: string, memberName: string, periode: string) => {
      const key = `${memberId}_${periode}`;
      if (pdfUrls[key] || loadingPdf[key]) return;

      setLoadingPdf((prev) => ({ ...prev, [key]: true }));
      try {
        const [year, month] = periode.split("-");
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

  // Auto-load PDF whenever selectedMember changes
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

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(pdfUrls).forEach((url) => window.URL.revokeObjectURL(url));
      if (recapPdfUrl) window.URL.revokeObjectURL(recapPdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadRecapPdf = async () => {
    setLoadingRecapPdf(true);
    try {
      const isSingleMonth = payments.length === 1;
      const extraParams: Record<string, number> = {};
      if (isSingleMonth) {
        const [year, month] = payments[0].periode.split("-");
        extraParams.month = parseInt(month, 10);
        extraParams.year = parseInt(year, 10);
      }

      const res = await axiosJWT.get(`${APIEndpoint}/api/project/recap-pdf`, {
        params: { projectId, ...extraParams },
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

  const RecapButton = () => (
    <button
      onClick={handleLoadRecapPdf}
      disabled={loadingRecapPdf}
      className="btn bg-[#FDCF6F] hover:bg-[#E6B85C] text-black px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap text-sm"
    >
      {loadingRecapPdf ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block" />
          Memuat...
        </>
      ) : (
        <>
          <PdfIcon />
          PDF Rekapitulasi
        </>
      )}
    </button>
  );

  const MemberTabs: React.FC<{ periode: string }> = ({ periode }) => {
    const activeMemberIdx = selectedMember[periode] ?? 0;
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {projectData.anggota.map((anggota, idx) => (
          <button
            key={idx}
            onClick={() =>
              setSelectedMember((prev) => ({ ...prev, [periode]: idx }))
            }
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
    );
  };

  if (loadingPayment) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">
          LAMPIRAN TIMESHEET
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

  const isSingleMonth = payments.length === 1;

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2 mb-6">
          <h2 className="text-2xl font-bold">LAMPIRAN TIMESHEET</h2>
          <RecapButton />
        </div>

        {isSingleMonth ? (
          /* ── Single-month layout ── */
          <>
            <MemberTabs periode={payments[0].periode} />
            {(() => {
              const periode = payments[0].periode;
              const idx = selectedMember[periode] ?? 0;
              const memberId = projectData.id_anggota[idx];
              const pdfKey = `${memberId}_${periode}`;
              return (
                <PdfViewer
                  loading={!!loadingPdf[pdfKey]}
                  url={pdfUrls[pdfKey]}
                  title={`Timesheet ${projectData.anggota[idx]}`}
                />
              );
            })()}
          </>
        ) : (
          /* ── Multi-month grouped layout ── */
          payments.map((payment) => {
            const periode = payment.periode;
            const idx = selectedMember[periode] ?? 0;
            const memberId = projectData.id_anggota[idx];
            const pdfKey = `${memberId}_${periode}`;

            return (
              <div key={periode} className="mb-10">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  {formatPeriode(periode)}:
                </h3>
                <MemberTabs periode={periode} />
                <PdfViewer
                  loading={!!loadingPdf[pdfKey]}
                  url={pdfUrls[pdfKey]}
                  title={`Timesheet ${projectData.anggota[idx]} - ${formatPeriode(periode)}`}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Recap PDF modal */}
      {showRecapModal && recapPdfUrl && (
        <RecapModal
          url={recapPdfUrl}
          onClose={() => {
            setShowRecapModal(false);
            if (recapPdfUrl) {
              window.URL.revokeObjectURL(recapPdfUrl);
              setRecapPdfUrl(null);
            }
          }}
        />
      )}
    </>
  );
};

export default LampiranTimesheet;
