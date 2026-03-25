import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface ExpensesChartProps {
  userId?: string;
  year?: number;
  showKategoriChart?: boolean;
}

const getChartOptions = (data: number[]) => {
  // Get January data (first element)
  const januaryData = data[0] || 0;

  // Cari nilai maximum dari data
  const maxValue = Math.max(...data);

  const scaleConfig: any = {
    display: true,
  };

  if (januaryData === 0) {
    // Januari = 0: mulai dari 0
    scaleConfig.beginAtZero = true;
    scaleConfig.min = 0;

    // Jika semua data 0, set max agar tidak jadi -1 to 1
    if (maxValue === 0) {
      scaleConfig.max = 1;
    }
  } else {
    // Januari != 0: mulai dari nilai Januari
    scaleConfig.beginAtZero = false;
    scaleConfig.min = januaryData;

    // Jika semua data sama (flat line), beri sedikit ruang di atas
    if (januaryData === maxValue) {
      scaleConfig.max = januaryData * 1.5;
    }
  }

  return {
    responsive: true,
    scales: {
      x: {
        display: true,
      },
      y: scaleConfig,
    },
    elements: {
      line: {
        borderWidth: 2,
        borderColor: "Black",
        fill: "start",
      },
      point: {
        radius: 5,
        hitRadius: 100,
        pointStyle: "circle" as const,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (tooltipItem: any) =>
            `Expense: Rp ${tooltipItem.raw.toLocaleString("id-ID")}`,
        },
      },
    },
    maintainAspectRatio: false,
  };
};

const ExpensesChart = ({
  userId,
  year,
  showKategoriChart = false,
}: ExpensesChartProps) => {
  const [chartData, setChartData] = useState({
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ],
    datasets: [
      {
        data: [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
        borderColor: "black",
        pointBackgroundColor: "black",
      },
    ],
  });

  const [kategoriData, setKategoriData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Jumlah Project",
        data: [] as number[],
        backgroundColor: "rgba(54, 162, 235, 0.6)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  });

  const [loadingKategori, setLoadingKategori] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentYear = year || new Date().getFullYear();
        const API_ENDPOINT =
          process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";

        // Use global API if no userId, otherwise use user-specific API
        const url = userId
          ? `${API_ENDPOINT}/api/dashboard/monthly-expenses/${userId}?year=${currentYear}`
          : `${API_ENDPOINT}/api/dashboard/global/monthly-expenses?year=${currentYear}`;

        const response = await fetch(url, { credentials: "include" });

        if (!response.ok) throw new Error("Failed to fetch monthly expenses");

        const json = await response.json();

        if (json.success) {
          const { data } = json.data;
          // Use short labels for chart
          const shortLabels = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "Mei",
            "Jun",
            "Jul",
            "Agu",
            "Sep",
            "Okt",
            "Nov",
            "Des",
          ];

          setChartData({
            labels: shortLabels,
            datasets: [
              {
                data: data, // Already cumulative from API
                borderColor: "black",
                pointBackgroundColor: "black",
              },
            ],
          });
        }
      } catch (error) {
        console.error("Error fetching monthly expenses:", error);
      }
    };

    fetchData();
  }, [userId, year]);

  useEffect(() => {
    if (!showKategoriChart) return;

    const fetchKategoriData = async () => {
      try {
        setLoadingKategori(true);
        const currentYear = year || new Date().getFullYear();
        const API_ENDPOINT =
          process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";

        const url = `${API_ENDPOINT}/api/dashboard/global/kategori-magang-stats?year=${currentYear}`;

        const response = await fetch(url, { credentials: "include" });

        if (!response.ok)
          throw new Error("Failed to fetch kategori magang stats");

        const json = await response.json();

        if (json.success && json.data) {
          const { labels, data } = json.data;

          setKategoriData({
            labels: labels,
            datasets: [
              {
                label: "Jumlah Project",
                data: data,
                backgroundColor: "rgba(54, 162, 235, 0.6)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1,
              },
            ],
          });
        }
      } catch (error) {
        console.error("Error fetching kategori magang stats:", error);
      } finally {
        setLoadingKategori(false);
      }
    };

    fetchKategoriData();
  }, [year, showKategoriChart]);

  const getBarChartOptions = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          display: true,
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            font: {
              size: 10,
            },
          },
        },
        y: {
          display: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (tooltipItem: any) => `Jumlah Project: ${tooltipItem.raw}`,
          },
        },
      },
    };
  };

  return (
    <div className="w-full space-y-8">
      <div className="w-full h-80">
        <Line
          width={610}
          options={getChartOptions(chartData.datasets[0].data)}
          data={chartData}
        />
      </div>

      {showKategoriChart && (
        <div className="w-full">
          <h3 className="text-lg font-semibold mb-4">
            Statistik Kategori Magang
          </h3>
          {loadingKategori ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="h-80">
              <Bar options={getBarChartOptions()} data={kategoriData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpensesChart;
