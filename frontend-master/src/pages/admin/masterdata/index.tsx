import Layout from "@/src/components/Layout";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";

const MasterData = () => {
  const router = useRouter();
  const pageTitle = "Master Data";

  useEffect(() => {
    if (router.isReady) {
      router.push("/masterdata/category");
    }
  }, [router.isReady, router]);

  return (
    <Layout title={pageTitle}>
      <div>Please reload.</div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(MasterData);
