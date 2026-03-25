import React from "react";
import Layout from "@/src/components/Layout";
import Card from "@/src/components/Dashboard/Card";
import Expenses from "@/src/components/Dashboard/Expenses";
import KategoriMagangStats from "@/src/components/Dashboard/KategoriMagangStats";
import OnGoingProject from "@/src/components/Dashboard/OnGoingProject";
import TopMagang from "@/src/components/Dashboard/TopMagang";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { FaSortUp, FaSortDown } from "react-icons/fa";

type Props = {
  user: any;
  role: string;
};

type Student = {
  id: string;
  nama: string;
  username: string;
  departemen: string;
  projectCount: number;
};

const ITEMS_PER_PAGE = 12;

const Monitoring = ({ user: _user, role: _role }: Props) => {
  const pageTitle = "Monitoring";
  const API_ENDPOINT =
    process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"mahasiswa" | "user">(
    "mahasiswa",
  );

  // User tab states
  const [users, setUsers] = React.useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState<boolean>(true);
  const [errorUsers, setErrorUsers] = React.useState<string | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [summary, setSummary] = React.useState<{
    total_estimasi?: number;
    finished_projects?: number;
    approved_projects?: number;
    waiting_payment?: number;
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = React.useState<boolean>(false);
  const [userPage, setUserPage] = React.useState(1);

  // Mahasiswa tab states
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState<boolean>(false);
  const [errorStudents, setErrorStudents] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [searchStudent, setSearchStudent] = React.useState<string>("");
  const [studentPage, setStudentPage] = React.useState(1);
  const [totalStudentPages, setTotalStudentPages] = React.useState(1);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  // Sorted students
  const sortedStudents = React.useMemo(() => {
    return [...students].sort((a, b) => {
      if (sortOrder === "asc") {
        return a.projectCount - b.projectCount;
      } else {
        return b.projectCount - a.projectCount;
      }
    });
  }, [students, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  // Fetch users for User tab
  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await fetch(`${API_ENDPOINT}/api/masterUser?size=200`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        const json = await res.json();
        const list = json?.data?.data || json?.data || [];
        const stafOnly = (list || []).filter(
          (u: any) => String(u.status || "").toUpperCase() === "STAF",
        );
        setUsers(stafOnly);
      } catch (err: any) {
        console.error(err);
        setErrorUsers(err.message || "Error fetching users");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [API_ENDPOINT]);

  // Fetch students for Mahasiswa tab
  React.useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        setErrorStudents(null);

        let url = `${API_ENDPOINT}/api/mahasiswa/project-counts?size=${ITEMS_PER_PAGE}&page=${studentPage}`;
        if (startDate && endDate) {
          url += `&startDate=${startDate}&endDate=${endDate}`;
        }
        if (searchStudent) {
          // Search by both nama and nim
          url += `&nama=${encodeURIComponent(searchStudent)}&nim=${encodeURIComponent(searchStudent)}`;
        }

        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch students");
        const json = await res.json();
        setStudents(json?.data || []);
        setTotalStudentPages(json?.paging?.total_page || 1);
      } catch (err: any) {
        console.error(err);
        setErrorStudents(err.message || "Error fetching students");
      } finally {
        setLoadingStudents(false);
      }
    };

    if (activeTab === "mahasiswa") {
      fetchStudents();
    }
  }, [API_ENDPOINT, activeTab, startDate, endDate, searchStudent, studentPage]);

  // Reset page when search/filter changes
  React.useEffect(() => {
    setStudentPage(1);
  }, [startDate, endDate, searchStudent]);

  // Pagination for users (client-side)
  const totalUserPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = React.useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return users.slice(start, start + ITEMS_PER_PAGE);
  }, [users, userPage]);

  const handleSelectUser = async (u: any) => {
    setSelectedUser(u);
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_ENDPOINT}/api/dashboard/summary/${u.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch user summary");
      const json = await res.json();
      setSummary({
        total_estimasi: Number(json?.data?.total_estimasi || 0),
        finished_projects: Number(json?.data?.finished_projects || 0),
        approved_projects: Number(json?.data?.approved_projects || 0),
        waiting_payment: Number(json?.data?.waiting_payment || 0),
      });
    } catch (e: any) {
      console.error(e);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleCloseDashboard = () => {
    setSelectedUser(null);
    setSummary(null);
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setSearchStudent("");
  };

  // Pagination component
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="btn btn-sm btn-ghost disabled:opacity-50"
        >
          <MdChevronLeft className="text-lg" />
        </button>
        <span className="text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="btn btn-sm btn-ghost disabled:opacity-50"
        >
          <MdChevronRight className="text-lg" />
        </button>
      </div>
    );
  };

  return (
    <Layout title={pageTitle}>
      <div className="p-2 sm:p-4">
        {/* DaisyUI Tabs with border */}
        <div className="border-b border-gray-300 mb-4">
          <div role="tablist" className="tabs">
            <a
              role="tab"
              className={`tab tab-md ${activeTab === "mahasiswa" ? "tab-active border-b-2 border-primary" : ""}`}
              onClick={() => setActiveTab("mahasiswa")}
            >
              Mahasiswa
            </a>
            <a
              role="tab"
              className={`tab tab-md ${activeTab === "user" ? "tab-active border-b-2 border-primary" : ""}`}
              onClick={() => setActiveTab("user")}
            >
              User
            </a>
          </div>
        </div>

        {/* Mahasiswa Tab Content */}
        {activeTab === "mahasiswa" && (
          <div>
            {/* Date Range Filter */}
            <div className="flex flex-wrap gap-3 mb-4 items-end">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm">Tanggal Awal</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm">Tanggal Akhir</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm">Search</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama / NIM..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="input input-bordered input-sm w-48"
                />
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={handleClearFilter}
              >
                Clear
              </button>
            </div>

            {/* Student Table */}
            {loadingStudents && <div>Loading mahasiswa...</div>}
            {errorStudents && (
              <div className="text-red-600">{errorStudents}</div>
            )}

            {!loadingStudents && students.length === 0 && (
              <div className="text-sm text-gray-500">
                Tidak ada mahasiswa ditemukan
              </div>
            )}

            {!loadingStudents && students.length > 0 && (
              <div className="flex justify-center">
                <table className="table-auto text-center w-full shadow-2xl bg-[#F5F9F8] rounded-lg">
                  <thead>
                    <tr className="bg-transparent border-b border-gray-200 shadow-md">
                      <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                        No.
                      </th>
                      <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                        NIM
                      </th>
                      <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                        Nama
                      </th>
                      <th className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm">
                        Departemen
                      </th>
                      <th
                        className="py-2 md:py-3 px-3 md:px-6 font-bold text-black text-xs md:text-sm cursor-pointer hover:bg-gray-100"
                        onClick={toggleSortOrder}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {sortOrder === "desc" ? (
                            <FaSortDown className="text-blue-500" />
                          ) : (
                            <FaSortUp className="text-blue-500" />
                          )}
                          Jumlah Projek
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s, index) => (
                      <tr
                        key={s.id || s.username}
                        className="border-b border-gray-300 hover:bg-gray-100"
                      >
                        <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                          {(studentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                          {s.id || "-"}
                        </td>
                        <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm font-medium">
                          {s.nama || s.username || "-"}
                        </td>
                        <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                          {s.departemen || "-"}
                        </td>
                        <td className="py-2 md:py-4 px-3 md:px-6 text-black text-xs md:text-sm">
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                            {s.projectCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination for Mahasiswa */}
            <PaginationControls
              currentPage={studentPage}
              totalPages={totalStudentPages}
              onPageChange={setStudentPage}
            />
          </div>
        )}

        {/* User Tab Content */}
        {activeTab === "user" && (
          <>
            {loadingUsers && <div>Loading users...</div>}
            {errorUsers && <div className="text-red-600">{errorUsers}</div>}

            {!loadingUsers && users.length === 0 && (
              <div className="text-sm text-gray-500">No users found</div>
            )}

            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Dashboard -{" "}
                    {selectedUser.nama ||
                      selectedUser.name ||
                      selectedUser.username}
                  </h2>
                  <button
                    className="text-sm px-3 py-1 bg-gray-200 rounded"
                    onClick={handleCloseDashboard}
                  >
                    Close
                  </button>
                </div>

                {loadingSummary ? (
                  <div>Loading summary...</div>
                ) : summary ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card
                      title="Total Expense"
                      data={new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(summary.total_estimasi || 0)}
                    />
                    <Card
                      title="Finished Project"
                      data={String(summary.finished_projects ?? 0)}
                      bgHex="#FDCF6F"
                      textColor="#000000"
                    />
                    <Card
                      title="Approved Project"
                      data={String(summary.approved_projects ?? 0)}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No summary available
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 mb-6">
                  <div className="md:col-span-3">
                    <Expenses userId={selectedUser?.id} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="md:col-span-3">
                    <KategoriMagangStats />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OnGoingProject userId={selectedUser?.id} />
                  <TopMagang userId={selectedUser?.id} />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {paginatedUsers.map((u: any) => (
                    <div
                      key={u.id || u.username || JSON.stringify(u)}
                      onClick={() => handleSelectUser(u)}
                      className="cursor-pointer"
                    >
                      <Card
                        title={u.nama || u.name || u.username || "-"}
                        data={
                          <div className="flex flex-col text-sm">
                            <span className="font-medium">
                              ID: {u.id ?? u.username ?? "-"}
                            </span>
                            <span className="text-xs">
                              Departemen: {u.departemen ?? "-"}
                            </span>
                          </div>
                        }
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination for Users */}
                <PaginationControls
                  currentPage={userPage}
                  totalPages={totalUserPages}
                  onPageChange={setUserPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(Monitoring);
