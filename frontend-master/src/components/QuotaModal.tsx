import React, { useEffect, useState } from "react";
import axios from "axios";
import Modal from "./Modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  apiEndpoint?: string;
  token?: string | null;
};

type QuotaRow = {
  month: string;
  used: number;
  remaining: number;
  limit: number;
};

const QuotaModal = ({ isOpen, onClose, apiEndpoint, token }: Props) => {
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const formatMonth = (monthStr: string) => {
    if (!monthStr) return "";
    const m = monthStr.trim();
    const ymMatch = /^\s*(\d{4})-(\d{1,2})\s*$/.exec(m);
    if (ymMatch) {
      const year = parseInt(ymMatch[1], 10);
      const month = parseInt(ymMatch[2], 10) - 1;
      const d = new Date(year, month, 1);
      return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }
    const asDate = new Date(m);
    if (!isNaN(asDate.getTime())) {
      return asDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    }
    return monthStr;
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const instance = axios.create({
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const today = new Date();
        const months: string[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
          months.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          );
        }

        const promises = months.map((m) =>
          instance.get(`${apiEndpoint}/api/mahasiswa/quota?month=${m}`, {
            withCredentials: true,
          }),
        );
        const res = await Promise.all(promises);
        const data = res.map(
          (r) => r.data?.data || { month: "", used: 0, remaining: 0, limit: 0 },
        );
        setRows(data);
      } catch (err) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, apiEndpoint, token]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kuota 6 bulan kedepan">
      {loading ? (
        <div>Memuat...</div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {rows.length ? (
            rows.map((r: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-2 border rounded"
              >
                <div>
                  <div className="font-medium">{formatMonth(r.month)}</div>
                  <div className="text-sm text-gray-500">
                    {r.used} / {r.limit}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {r.remaining} jam tersisa
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">Tidak ada data</div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default QuotaModal;
