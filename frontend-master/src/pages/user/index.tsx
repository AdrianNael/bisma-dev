import Layout from "@/src/components/Layout";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useRole } from "@/src/context/RoleContext";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import PageLoader from "@/src/components/PageLoader";

type Props = {
  user: any;
  role: string;
};

const User = ({ user: _user, role }: Props) => {
  const router = useRouter();
  const pageTitle = "User Page";
  const { setRole } = useRole();

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  useEffect(() => {
    if (router.isReady) {
      router.push("/user/dashboard");
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

export default withPage(User);
