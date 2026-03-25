import React from "react";
import { useSidebar } from "@/src/context/SidebarContext";
import { HiMenu } from "react-icons/hi";

const HamburgerButton = () => {
  const { toggleMobileSidebar } = useSidebar();

  return (
    <button
      onClick={toggleMobileSidebar}
      className="lg:hidden z-30 p-2 bg-transparant text-[#1E2A38] rounded-lg hover:text-[#2A3A4C] transition-colors duration-200"
      aria-label="Toggle menu"
    >
      <HiMenu size={24} />
    </button>
  );
};

export default HamburgerButton;
