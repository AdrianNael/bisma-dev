import { Inter } from "next/font/google";
import React, { ReactNode } from "react";
import Image from "next/image";
import Navbar from "@/src/components/Navbar";
import Sidebar from "@/src/components/Sidebar";
import SidebarToggle from "@/src/components/SidebarToggle";
import Footer from "@/src/components/Footer";
import Head from "next/head";
import Breadcrumb from "@/src/components/Breadcrumb";
import { SidebarProvider } from "@/src/context/SidebarContext";
import { useRouter } from "next/router";

type LayoutProps = {
  children: ReactNode;
  title: string;
  // Optional: Map of URL segment values to display labels for breadcrumb
  // e.g., { "15": "Project Name" } to show "Project Name" instead of "15"
  breadcrumbLabels?: Record<string, string>;
  // Optional: Extra segments to add at the end of breadcrumb (not clickable)
  // e.g., ["Project Name"] to add as last breadcrumb item
  extraBreadcrumbSegments?: string[];
};

const inter = Inter({ subsets: ["latin"] });

const LayoutContent = ({
  children,
  title,
  breadcrumbLabels,
  extraBreadcrumbSegments,
}: LayoutProps) => {
  const router = useRouter();
  const currentPath = router.pathname;
  const currentLink = router.asPath;
  const isHomePage = currentPath === "/";

  // Custom loader for local images
  const localImageLoader = ({ src }: { src: string }) => src;

  return (
    <div className={`${inter.className} flex min-h-screen relative`}>
      {/* Mobile full-width header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-stone-50 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-3 py-3 flex justify-center items-center">
          <Image
            loader={localImageLoader}
            src="/Logo-UniversitasPertamina.png"
            alt="Logo Universitas Pertamina"
            className="object-contain h-10 w-10"
            width={40}
            height={40}
          />
        </div>
      </div>

      <Sidebar />
      <SidebarToggle />
      <div className="flex flex-col flex-1 gap-2">
        <header className="pt-16 lg:pt-0">
          {isHomePage ? "" : <Navbar title={title} />}
        </header>
        <main
          className={`flex-grow ml-0 transition-margin duration-150 ease-in-out`}
        >
          <Breadcrumb
            link={currentLink}
            labels={breadcrumbLabels}
            extraSegments={extraBreadcrumbSegments}
          />
          <div className="mx-2">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

const Layout = ({
  children,
  title,
  breadcrumbLabels,
  extraBreadcrumbSegments,
}: LayoutProps) => {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <SidebarProvider>
        <LayoutContent
          title={title}
          breadcrumbLabels={breadcrumbLabels}
          extraBreadcrumbSegments={extraBreadcrumbSegments}
        >
          {children}
        </LayoutContent>
      </SidebarProvider>
    </>
  );
};

export default Layout;
