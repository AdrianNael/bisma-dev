import Layout from "@/src/components/Layout";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { useRole } from "@/src/context/RoleContext";
import { withRole, getServerSidePropsWithRole } from "@/src/utils/withRole";
import PageLoader from "@/src/components/PageLoader";

type Props = {
  user: any;
  role: string;
};

const Admin = ({ user: _user, role }: Props) => {
  const router = useRouter();
  const pageTitle = "Admin Page";
  const { setRole } = useRole();

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  useEffect(() => {
    if (router.isReady) {
      router.push("/admin/monitoring");
    }
  }, [router.isReady, router]);

  return (
    <Layout title={pageTitle}>
      <PageLoader />
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withRole(Admin);
