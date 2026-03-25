import Layout from "@/src/components/Layout";
import Card from "@/src/components/Dashboard/Card";
import Expenses from "@/src/components/Dashboard/Expenses";
import OnGoingProject from "@/src/components/Dashboard/OnGoingProject";
import TopMagang from "@/src/components/Dashboard/TopMagang";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { useEffect, useState } from "react";

type Props = {
  id?: string | null;
  role?: string | null;
};

const AdminDashboard = ({ id: _userId, role: _role }: Props) => {
  const pageTitle = "Dashboard";
  const [totalExpense, setTotalExpense] = useState<number | null>(null);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [finishedCount, setFinishedCount] = useState<number | null>(null);
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const [_waitingPayment, setWaitingPayment] = useState<number | null>(null);

  useEffect(() => {
    const fetchGlobalSummary = async () => {
      try {
        setLoadingExpense(true);
        const API_ENDPOINT =
          process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";
        const res = await fetch(
          `${API_ENDPOINT}/api/dashboard/global/summary`,
          {
            credentials: "include",
          },
        );
        if (!res.ok)
          throw new Error("Failed to fetch global dashboard summary");
        const json = await res.json();
        setTotalExpense(Number(json?.data?.total_estimasi || 0));
        setFinishedCount(Number(json?.data?.finished_projects || 0));
        setApprovedCount(Number(json?.data?.approved_projects || 0));
        setWaitingPayment(Number(json?.data?.waiting_payment || 0));
      } catch (err) {
        console.error(err);
        setTotalExpense(0);
        setFinishedCount(0);
        setApprovedCount(0);
        setWaitingPayment(0);
      } finally {
        setLoadingExpense(false);
      }
    };

    fetchGlobalSummary();
  }, []);

  const formatIDR = (value: number | null) => {
    if (value == null) return loadingExpense ? "Loading..." : "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout title={pageTitle}>
      <div className="p-2 sm:p-4">
        {/* Dashboard Cards: 2x2 on mobile, 4 columns on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <Card title="Total Expense" data={formatIDR(totalExpense)} />
          <Card
            title="Finished Project"
            data={finishedCount != null ? String(finishedCount) : "-"}
            bgHex="#FDCF6F"
            textColor="#000000"
          />
          <Card
            title="Approved Project"
            data={approvedCount != null ? String(approvedCount) : "-"}
          />
        </div>

        {/* Expenses Chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-3">
            <Expenses showKategoriChart={true} />
          </div>
        </div>

        {/* OnGoingProject + TopMagang */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OnGoingProject />
          <TopMagang />
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(AdminDashboard);
