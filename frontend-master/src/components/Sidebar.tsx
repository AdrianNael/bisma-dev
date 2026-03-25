import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { useSidebar } from "@/src/context/SidebarContext";
import { useRole } from "@/src/context/RoleContext";
import Profile from "@/src/components/Profile";
import Logout from "./Logout";
import { RxDashboard, RxPerson, RxDesktop } from "react-icons/rx";
import { MdCircle, MdHistory, MdTimer, MdWorkOutline } from "react-icons/md";
import {
  IoIosArrowForward,
  IoIosArrowDown,
  IoIosDocument,
  IoMdFolderOpen,
} from "react-icons/io";
import { FaDatabase } from "react-icons/fa";

type LinkItem = {
  url: string;
  name: string;
  icon: React.ReactNode;
  subMenu?: LinkItem[];
};

const Sidebar = () => {
  const {
    isSidebarOpen,
    isMobileSidebarOpen,
    closeMobileSidebar,
    toggleMobileSidebar,
  } = useSidebar();
  const { role } = useRole();
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
  const [isManageUserOpen, setIsManageUserOpen] = useState(false);
  const calendarRef = useRef<FullCalendar | null>(null);
  const { pathname } = useRouter();

  const isPathActive = (menuUrl: string) => {
    if (menuUrl === "#") return false;

    if (pathname === menuUrl) return true;

    if (pathname.startsWith(menuUrl + "/")) return true;

    return false;
  };

  useEffect(() => {
    const storedMasterDataState = localStorage.getItem("isMasterDataOpen");
    if (storedMasterDataState) {
      setIsMasterDataOpen(JSON.parse(storedMasterDataState));
    }
    const storedManageUserState = localStorage.getItem("isManageUserOpen");
    if (storedManageUserState) {
      setIsManageUserOpen(JSON.parse(storedManageUserState));
    }
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (pathname.startsWith("/admin/masterdata")) {
      setIsMasterDataOpen(true);
      setIsManageUserOpen(false);
    } else if (pathname.startsWith("/admin/manage")) {
      setIsManageUserOpen(true);
      setIsMasterDataOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    localStorage.setItem("isMasterDataOpen", JSON.stringify(isMasterDataOpen));
    localStorage.setItem("isManageUserOpen", JSON.stringify(isManageUserOpen));
  }, [isMasterDataOpen, isManageUserOpen]);

  const linksByRole: Record<string, LinkItem[]> = {
    STAF: [
      { url: "/user/dashboard", name: "Dashboard", icon: <RxDashboard /> },
      { url: "/user/myproject", name: "My Project", icon: <RxDesktop /> },
      {
        url: "/user/timesheet",
        name: "Time Sheet",
        icon: <IoIosDocument />,
      },
      {
        url: "/user/availablestudent",
        name: "Available Student",
        icon: <RxPerson />,
      },
    ],
    MANAGER: [
      { url: "/admin/project", name: "Project", icon: <RxDesktop /> },
      { url: "/admin/dashboard", name: "Dashboard", icon: <RxDashboard /> },
      { url: "/admin/monitoring", name: "Monitoring", icon: <RxDashboard /> },
      {
        url: "#",
        name: "Manage User",
        icon: <RxPerson />,
        subMenu: [
          { url: "/admin/manageuser/staf", name: "Staff", icon: <MdCircle /> },
          {
            url: "/admin/manageuser/student",
            name: "Student",
            icon: <MdCircle />,
          },
          {
            url: "/admin/manageuser/position",
            name: "Position",
            icon: <MdCircle />,
          },
          {
            url: "/admin/manageuser/department",
            name: "Program Studi",
            icon: <MdCircle />,
          },
        ],
      },
      {
        url: "#",
        name: "Master Data",
        icon: <FaDatabase />,
        subMenu: [
          {
            url: "/admin/masterdata/category",
            name: "Kategori",
            icon: <MdCircle />,
          },
        ],
      },
    ],
    MAHASISWA: [
      { url: "/mahasiswa/lowongan", name: "Lowongan", icon: <MdWorkOutline /> },
      { url: "/mahasiswa/history", name: "Riwayat", icon: <MdHistory /> },
      { url: "/mahasiswa/timesheet", name: "Timesheet", icon: <MdTimer /> },
    ],
    DIRMAWA: [
      { url: "/admin/dashboard", name: "Dashboard", icon: <RxDashboard /> },
      { url: "/admin/project", name: "Project", icon: <IoMdFolderOpen /> },
      { url: "/admin/monitoring", name: "Monitoring", icon: <RxDesktop /> },
      {
        url: "#",
        name: "Manage User",
        icon: <RxPerson />,
        subMenu: [
          { url: "/admin/manageuser/staf", name: "Staff", icon: <MdCircle /> },
          {
            url: "/admin/manageuser/student",
            name: "Student",
            icon: <MdCircle />,
          },
          {
            url: "/admin/manageuser/position",
            name: "Position",
            icon: <MdCircle />,
          },
        ],
      },
      {
        url: "#",
        name: "Master Data",
        icon: <FaDatabase />,
        subMenu: [
          {
            url: "/admin/masterdata/faculty",
            name: "Fakultas",
            icon: <MdCircle />,
          },
          {
            url: "/admin/masterdata/department",
            name: "Program Studi",
            icon: <MdCircle />,
          },
          {
            url: "/admin/masterdata/category",
            name: "Kategori",
            icon: <MdCircle />,
          },
        ],
      },
    ],
  };

  const arrlink = role ? linksByRole[role] || [] : [];

  const handleMasterDataClick = () => {
    setIsMasterDataOpen(!isMasterDataOpen);
    setIsManageUserOpen(false);
  };

  const handleManageUserClick = () => {
    setIsManageUserOpen(!isManageUserOpen);
    setIsMasterDataOpen(false);
  };

  useEffect(() => {
    if (isSidebarOpen && calendarRef.current) {
      setTimeout(() => {
        calendarRef.current?.getApi().updateSize();
      }, 300);
    }
  }, [isSidebarOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 lg:hidden`}
          onClick={closeMobileSidebar}
        />
      )}

      {/* Mobile Toggle Handle - Half Circle (only visible on mobile < lg) */}
      <button
        onClick={toggleMobileSidebar}
        className={`lg:hidden fixed top-12 z-50 transition-all duration-300 ease-in-out
                    ${isMobileSidebarOpen ? "left-64" : "left-0"}
                    bg-[#0A5F59] text-white rounded-r-full
                    w-8 h-16 flex items-center justify-center
                    hover:bg-[#0A5F59] focus:outline-none`}
        aria-label={isMobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <span className="text-xl font-bold">
          {isMobileSidebarOpen ? "«" : "»"}
        </span>
      </button>

      {/* Sidebar - visible at lg and above */}
      <aside
        className={`bg-[#1E2A38] flex flex-col transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden
                     rounded-r-3xl min-h-full
                     fixed lg:sticky top-0 h-screen w-64 z-50
                     ${isSidebarOpen ? `lg:w-72` : `lg:w-24`}
                     transform ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                     lg:translate-x-0 lg:relative`}
      >
        <div className="w-full text-white h-full flex flex-col overflow-y-auto">
          <Profile />

          <nav className="mt-6">
            <ul>
              {arrlink.map((value, index) => {
                const isActive = isPathActive(value.url);
                const isOpen =
                  value.name === "Master Data"
                    ? isMasterDataOpen
                    : value.name === "Manage User"
                      ? isManageUserOpen
                      : false;

                return (
                  <React.Fragment key={index}>
                    {value.subMenu ? (
                      <div>
                        <button
                          className={`w-full flex items-center my-3 justify-start ml-2 pl-10 ${isSidebarOpen ? "lg:justify-start lg:ml-2 lg:pl-10" : "lg:justify-center lg:ml-0 lg:pl-0"} py-2 rounded-l-full ${
                            isOpen
                              ? "sm:bg-transparent sm:text-[#FDCF6F]"
                              : "hover:bg-gray-700"
                          }`}
                          onClick={
                            value.name === "Master Data"
                              ? handleMasterDataClick
                              : handleManageUserClick
                          }
                        >
                          <div
                            className={`text-xl ${
                              isOpen ? "text-[#FDCF6F]" : "text-[#FDCF6F]"
                            }`}
                          >
                            {value.icon}
                          </div>
                          <span
                            className={`pl-2 font-medium flex items-center ${isOpen ? "underline underline-offset-2 decoration-2 lg:no-underline" : ""} ${isSidebarOpen ? "lg:inline" : "lg:hidden"}`}
                          >
                            {value.name}{" "}
                            {isOpen ? (
                              <IoIosArrowDown />
                            ) : (
                              <IoIosArrowForward />
                            )}
                          </span>
                        </button>

                        {isOpen && (
                          <ul className="ml-8">
                            {value.subMenu!.map((subValue, subIndex) => {
                              const isSubActive = isPathActive(subValue.url); // Gunakan isPathActive untuk submenu juga
                              return (
                                <li key={subIndex}>
                                  <Link
                                    href={subValue.url}
                                    onClick={closeMobileSidebar}
                                    className={`flex items-center my-2 py-2 pl-6 rounded-l-full
                                              ${
                                                isSubActive
                                                  ? "lg:bg-[#DFEBE9] lg:text-black"
                                                  : "hover:bg-gray-700"
                                              }`}
                                  >
                                    <div
                                      className={`text-xl ${
                                        isSubActive
                                          ? "text-[#FDCF6F] lg:text-[#252B42]"
                                          : "text-[#FDCF6F]"
                                      }`}
                                    >
                                      {subValue.icon}
                                    </div>
                                    <span
                                      className={`pl-2 font-medium ${isSubActive ? "underline underline-offset-2 decoration-2 lg:no-underline" : ""}`}
                                    >
                                      {subValue.name}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <li>
                        <Link
                          href={value.url}
                          onClick={closeMobileSidebar}
                          className={`flex items-center my-3 justify-start ml-2 pl-10 ${isSidebarOpen ? "lg:justify-start lg:ml-2 lg:pl-10" : "lg:justify-center lg:ml-0 lg:pl-0"} py-2 rounded-l-full ${
                            isActive
                              ? "lg:bg-[#DFEBE9] sm:text-[#252B42]"
                              : "hover:bg-gray-700"
                          }`}
                        >
                          <div
                            className={`text-xl ${
                              isActive
                                ? "text-[#FDCF6F] lg:text-[#252B42]"
                                : "text-[#FDCF6F]"
                            }`}
                          >
                            {value.icon}
                          </div>
                          <span
                            className={`pl-2 font-medium ${isActive ? "underline text-[#FDCF6F] lg:text-[#252B42] underline-offset-2 decoration-2 lg:no-underline" : ""} ${isSidebarOpen ? "lg:inline" : "lg:hidden"}`}
                          >
                            {value.name}
                          </span>
                        </Link>
                      </li>
                    )}
                  </React.Fragment>
                );
              })}
            </ul>
          </nav>

          <div
            className={`flex ${
              isSidebarOpen
                ? "justify-start"
                : "justify-center lg:justify-center"
            } lg:flex`}
          >
            <Logout />
          </div>

          {(isSidebarOpen || isMobileSidebarOpen) && (
            <div className="mt-4 m-2 p-2 bg-[#DFEBE9] text-black text-[9px] my-calendar rounded-xl overflow-x-hidden shadow-md shadow-black lg:block">
              <FullCalendar
                ref={calendarRef as any}
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                fixedWeekCount={false}
                weekends
                height="auto"
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
