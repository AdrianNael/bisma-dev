import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";
import { useSidebar } from "@/src/context/SidebarContext";
import { useRole } from "@/src/context/RoleContext";
import axios from "axios";

type Props = {};

const Logout = (_props: Props) => {
  const endPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const { isSidebarOpen, isMobileSidebarOpen } = useSidebar();
  const { setId, setUsername, setName, setRole } = useRole();

  const handleLogout = async () => {
    try {
      const _pesan = await axios.delete(`${endPoint}/logout`, {
        withCredentials: true,
      });

      setId(null);
      setUsername(null);
      setName(null);
      setRole(null);

      localStorage.removeItem("token");

      router.push("/login");
    } catch (_error) {
      setId(null);
      setUsername(null);
      setName(null);
      setRole(null);
      localStorage.removeItem("token");

      router.push("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`flex ${isSidebarOpen ? "py-2 justify-start items-start ml-2 pl-10" : "justify-center py-2"} text-white font-semibold hover:bg-gray-700 rounded-l-full shadow-inner`}
    >
      <div
        className={`flex items-center justify-center text-xl text-[#FDCF6F]`}
      >
        <FiLogOut />
      </div>
      {(isSidebarOpen || isMobileSidebarOpen) && (
        <div className="ml-2">Logout</div>
      )}
    </button>
  );
};

export default Logout;
