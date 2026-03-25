import Layout from "@/src/components/Layout";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import _jwt from "jsonwebtoken";
import { useRole } from "@/src/context/RoleContext";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import PageLoader from "@/src/components/PageLoader";

type Props = {
  username: any;
  role: string;
  id: string;
  name: string;
};

const Mahasiswa = ({
  username: _username,
  role,
  id: _id,
  name: _name,
}: Props) => {
  const router = useRouter();
  const pageTitle = "Admin Page";
  const { setRole } = useRole();

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  useEffect(() => {
    if (router.isReady) {
      router.push("/mahasiswa/timesheet");
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

export default withPage(Mahasiswa);
