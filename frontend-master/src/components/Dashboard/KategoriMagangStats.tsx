import React, { useState, useEffect } from "react";
import KategoriMagangChart from "./KategoriMagangChart";

const KategoriMagangStats = () => {
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [availableYears, setAvailableYears] = useState<number[]>([
    new Date().getFullYear(),
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        setLoading(true);
        const API_ENDPOINT =
          process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";

        const url = `${API_ENDPOINT}/api/dashboard/global/available-years`;

        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch available years");
        const json = await res.json();
        if (json.success && json.data?.years?.length > 0) {
          setAvailableYears(json.data.years);
          setSelectedYear(json.data.years[0]);
        }
      } catch (err) {
        console.error("Error fetching available years:", err);
        setAvailableYears([new Date().getFullYear()]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableYears();
  }, []);

  return (
    <div className="flex flex-col rounded-lg shadow-lg shadow-gray-500 w-full p-4 bg-slate-50 h-full min-h-[20rem] md:min-h-[26rem]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-base md:text-lg font-semibold">
          Statistik Kategori Magang {selectedYear}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="year-filter-kategori"
            className="text-sm font-medium text-gray-600"
          >
            Tahun:
          </label>
          <select
            id="year-filter-kategori"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            disabled={loading}
            className="border border-gray-300 rounded-lg py-1.5 text-sm font-medium bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all duration-200"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="w-full flex justify-center flex-1">
        <KategoriMagangChart year={selectedYear} />
      </div>
    </div>
  );
};

export default KategoriMagangStats;
