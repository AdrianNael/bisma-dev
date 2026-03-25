import React, { useEffect, useState } from "react";
import Modal from "./Modal";

interface LowonganDetail {
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
}

type AppStatus = "Pending" | "Accepted" | "Rejected" | null;

interface ModalDetailLowonganProps {
  isOpen: boolean;
  onClose: () => void;
  lowongan: LowonganDetail;
  onApply: () => void;

  applicationStatus?: AppStatus;
  applying?: boolean;
}

const ModalDetailLowongan: React.FC<ModalDetailLowonganProps> = ({
  isOpen,
  onClose,
  lowongan,
  onApply,
  applicationStatus = null,
  applying = false,
}) => {
  const [activeTab, setActiveTab] = useState<"lowongan" | "rincian">(
    "lowongan",
  );

  useEffect(() => {
    if (isOpen) setActiveTab("lowongan");
  }, [isOpen]);

  const safeFormatDate = (s?: string | null) => {
    if (s === null || s === undefined || String(s).trim() === "") return "-";
    const d = new Date(s as string);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const parseToDate = (s?: string | null) => {
    if (s === null || s === undefined || String(s).trim() === "") return null;
    const str = String(s).trim();
    // handle DD/MM/YYYY
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    // try ISO / normal parse
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  const formatRange = (start?: string | null, end?: string | null) => {
    const a = safeFormatDate(start);
    const b = safeFormatDate(end);

    if (a === "-" && b === "-") {
      const regEndStr = (lowongan as any)?.pendaftaran_selesai;
      const regEndDate = parseToDate(regEndStr);
      if (regEndDate) {
        const startDate = new Date(regEndDate);
        startDate.setDate(startDate.getDate() + 1);
        const formattedStart = startDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        return `${formattedStart} – Selesai`;
      }
      return "-";
    }

    return `${a} – ${b}`;
  };

  const satuan = String(lowongan.satuan_insentif || "").toLowerCase();
  const besaranInsentif = Number(lowongan.insentif_per_jam ?? 0);
  const durasiSatuan = lowongan.durasi_satuan ?? (satuan === "menit" ? 50 : 1);

  const insentifLabel =
    besaranInsentif > 0
      ? `Rp ${besaranInsentif.toLocaleString("id-ID")} per ${durasiSatuan} ${satuan || "unit"}`
      : "Rp 0";

  const btn = (() => {
    if (applicationStatus === "Pending")
      return { text: "Waiting Approval", disabled: true, cls: "bg-yellow-500" };
    if (applicationStatus === "Accepted")
      return { text: "Accepted", disabled: true, cls: "bg-green-600" };
    if (applicationStatus === "Rejected")
      return { text: "Rejected", disabled: true, cls: "bg-red-600" };
    if (applying)
      return { text: "Mengirim...", disabled: true, cls: "bg-yellow-400" };
    return {
      text: "Lamar Sekarang",
      disabled: false,
      cls: "bg-[#f3cb19] hover:bg-[#f3cb19]/80 text-[#0c5b5b] font-semibold border-2 border-[#0c5b5b]",
    };
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lowongan.nama}>
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              type="button"
              onClick={() => setActiveTab("lowongan")}
              className={`inline-block p-4 ${
                activeTab === "lowongan"
                  ? "text-[#0c5b5b] border-b-2 border-[#0c5b5b]"
                  : "text-gray-500 hover:text-[#0c5b5b]"
              }`}
            >
              Lowongan
            </button>
          </li>
          <li className="mr-2">
            <button
              type="button"
              onClick={() => setActiveTab("rincian")}
              className={`inline-block p-4 ${
                activeTab === "rincian"
                  ? "text-[#0c5b5b] border-b-2 border-[#0c5b5b]"
                  : "text-gray-500 hover:text-[#0c5b5b]"
              }`}
            >
              Rincian Lowongan
            </button>
          </li>
        </ul>
      </div>

      {activeTab === "lowongan" && (
        <div className="space-y-6">
          {/* Row 1: Kategori dan PIC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-gray-700 mb-2">Kategori:</h4>
              <p className="text-gray-800">{lowongan.kategori}</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-700 mb-2">
                Penanggung Jawab (PIC):
              </h4>
              <p className="text-gray-800">{lowongan.pic}</p>
              {lowongan.pic_email && (
                <p className="text-gray-600 text-sm mt-1">
                  {lowongan.pic_email}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-gray-700 mb-2">
                Periode Pendaftaran:
              </h4>
              <p className="text-gray-800">
                {formatRange(
                  lowongan.pendaftaran_mulai,
                  lowongan.pendaftaran_selesai,
                )}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-700 mb-2">
                Periode Kegiatan:
              </h4>
              <p className="text-gray-800">
                {formatRange(lowongan.tanggal_mulai, lowongan.tanggal_selesai)}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-700 mb-2">Kuota:</h4>
            <p className="text-gray-800">
              {lowongan.kuota ? `${lowongan.kuota} mahasiswa` : "mahasiswa"}
            </p>
          </div>
        </div>
      )}

      {activeTab === "rincian" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-gray-700 mb-2">Deskripsi:</h4>
              <p className="whitespace-pre-line text-gray-800">
                {lowongan.kriteria}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-700 mb-2">Insentif:</h4>
              <p className="text-gray-800">{insentifLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-gray-700 mb-2">
                Ketentuan Jam Kerja:
              </h4>
              <ul className="list-disc pl-5 text-gray-800">
                <li>Maksimal 4 jam per hari</li>
                <li>Maksimal 10 jam per minggu</li>
                <li>Maksimal 40 jam per bulan</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-700 mb-2">
                {satuan.toLowerCase().includes("karya") ? "Karya:" : "Durasi:"}
              </h4>
              <div className="text-gray-800">
                {lowongan.durasi_default != null ? (
                  <p>
                    {lowongan.durasi_default}{" "}
                    {satuan.toLowerCase().includes("karya") ? "karya" : "jam"}
                  </p>
                ) : (
                  <p className="text-gray-500">Belum ditentukan</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="mr-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Tutup
        </button>

        <button
          type="button"
          onClick={btn.disabled ? undefined : onApply}
          disabled={btn.disabled}
          aria-disabled={btn.disabled}
          className={`px-4 py-2 rounded text-white transition-colors ${btn.cls}`}
        >
          {btn.text}
        </button>
      </div>
    </Modal>
  );
};

export default ModalDetailLowongan;
