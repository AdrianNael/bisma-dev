import React, { useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useRole } from "@/src/context/RoleContext";
import PageLoader from "@/src/components/PageLoader";

const LogoutPage = () => {
  const router = useRouter();
  const { setId, setUsername, setName, setRole } = useRole();
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Attempt to call backend logout endpoint (optional, best effort)
        await axios.delete(`${APIEndpoint}/logout`, {
          withCredentials: true,
        });
      } catch (error) {
        console.error(
          "Logout API call failed, proceeding with client-side cleanup",
          error,
        );
      } finally {
        // Always perform client-side cleanup
        localStorage.removeItem("token");

        // Reset context state
        setId(null);
        setUsername(null);
        setName(null);
        setRole(null);

        // Redirect to login
        router.push("/login");
      }
    };

    performLogout();
  }, [router, setId, setUsername, setName, setRole, APIEndpoint]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <PageLoader />
        <p className="mt-4 text-gray-600 font-medium">Logging out...</p>
      </div>
    </div>
  );
};

export default LogoutPage;
