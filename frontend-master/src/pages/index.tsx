// src/pages/user/index.tsx
import Layout from "@/src/components/Layout";
import { GetServerSideProps } from "next";
import { withRole, getServerSidePropsWithRole } from "@/src/utils/withRole";

const HomePage = () => {
  const pageTitle = "BISMA";
  return (
    <Layout title={pageTitle}>
      <></>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withRole(HomePage);
