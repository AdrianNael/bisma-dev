import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface KategoriMagangChartProps {
  year?: number;
}

const getChartOptions = () => {
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

const KategoriMagangChart = ({ year }: KategoriMagangChartProps) => {
  const [chartData, setChartData] = useState({
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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

          setChartData({
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
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  if (loading) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <Bar options={getChartOptions()} data={chartData} />
    </div>
  );
};

export default KategoriMagangChart;
