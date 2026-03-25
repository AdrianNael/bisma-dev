import "@/src/styles/globals.css";
import type { AppProps } from "next/app";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { RoleProvider } from "@/src/context/RoleContext";
import { SignatureProvider } from "@/src/context/SignatureContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PageLoader from "@/src/components/PageLoader";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => {
      setLoading(true);
    };
    const handleComplete = () => {
      setLoading(false);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleComplete);
    router.events.on("routeChangeError", handleComplete);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleComplete);
      router.events.off("routeChangeError", handleComplete);
    };
  }, [router]);

  return (
    <>
      <RoleProvider>
        <SignatureProvider>
          {loading && <PageLoader />}
          <Component {...pageProps} />
          <ToastContainer />
        </SignatureProvider>
      </RoleProvider>
    </>
  );
}
