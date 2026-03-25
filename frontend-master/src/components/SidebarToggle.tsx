import { useSidebar } from "@/src/context/SidebarContext";

const SidebarToggle = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <button
      className={`hidden lg:flex fixed top-2 ${isSidebarOpen ? "left-4" : "left-7"} z-[50] ${
        isSidebarOpen
          ? "text-white hover:bg-teal-950"
          : "text-white hover:bg-teal-950"
      } text-2xl w-10 h-10 rounded-full items-center justify-center transition-all duration-300`}
      onClick={toggleSidebar}
      aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
    >
      <span className="font-bold">{isSidebarOpen ? "«" : "»"}</span>
    </button>
  );
};

export default SidebarToggle;
