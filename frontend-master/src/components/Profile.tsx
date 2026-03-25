import Image from "next/image";
import React from "react";
import Profpict from "@/public/profile.jpg";
import { useRole } from "@/src/context/RoleContext";
import { useSidebar } from "@/src/context/SidebarContext";
import { FaFileSignature } from "react-icons/fa";
import { useRouter } from "next/router";

const Profile = () => {
  const { isSidebarOpen, isMobileSidebarOpen } = useSidebar();
  const { name, role } = useRole();
  const router = useRouter();

  // avoid reading localStorage during server render / synchronous render to prevent
  // hydration mismatches. Read fallback values only after mount.
  const [fallbackName, setFallbackName] = React.useState<string | null>(null);
  const [fallbackRole, setFallbackRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const ln = localStorage.getItem("name");
      const lr = localStorage.getItem("role");
      setFallbackName(ln);
      setFallbackRole(lr);
    } catch (e) {
      // ignore
    }
  }, []);

  const displayName = name || fallbackName || "";
  const displayRole = role || fallbackRole || "";

  const handleSignatureClick = () => {
    if (displayRole === "MAHASISWA") {
      router.push("/mahasiswa/signature");
    } else if (["STAF", "MANAGER", "DIRMAWA"].includes(displayRole)) {
      router.push("/user/signature");
    }
  };

  return (
    <div className="flex flex-col bg-[#0A5F59] h-48 rounded-tr-3xl justify-center items-center">
      <div className="flex flex-col items-center gap-1 mt-2">
        <Image
          src={Profpict}
          alt=""
          width={65}
          height={65}
          priority={true}
          loader={() => Profpict.src}
          className="rounded-full border-2 mb-2 drop-shadow-xl hover:drop-shadow-2xl"
          unoptimized
        />

        {/* Show name & role only when sidebar (desktop) or mobile sidebar is open */}
        {(isSidebarOpen || isMobileSidebarOpen) && (
          <>
            <div className="flex flex-col items-center w-full px-2">
              <div className="font-bold text-lg text-center leading-tight max-w-[200px]">
                {displayName}{" "}
                <button
                  onClick={handleSignatureClick}
                  className="text-white hover:text-gray-300 transition-colors align-middle inline-block ml-1"
                  title="Manage Signature"
                >
                  <FaFileSignature size={18} />
                </button>
              </div>
            </div>
            <div className="text-gray-400 text-center">{displayRole}</div>
          </>
        )}

        <div className=""></div>
      </div>
    </div>
  );
};

export default Profile;
