// src/utils/withRole.tsx
import { GetServerSideProps, GetServerSidePropsContext } from "next";
import { useEffect } from "react";
import { useRouter } from "next/router";
import jwt, { JwtPayload } from "jsonwebtoken";
import { useRole } from "@/src/context/RoleContext";

type RoleProps = {
  role: string | null;
  id: string | null;
  name: string | null;
  username: string | null;
};

const withRole = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
) => {
  const ComponentWithRole = (props: RoleProps & P) => {
    const { role, setRole } = useRole();
    const router = useRouter();

    useEffect(() => {
      if (props.role && role !== props.role) {
        setRole(props.role);
      }
    }, [props.role, role, setRole]);

    useEffect(() => {
      if (router.isReady && role) {
        if (role === "STAF") {
          router.push("/user/dashboard");
        } else if (role === "MAHASISWA") {
          router.push("/mahasiswa/timesheet");
        } else if (role === "MANAGER") {
          router.push("/admin/monitoring");
        } else if (role === "DIRMAWA") {
          router.push("/admin/project");
        }
      }
    }, [role, router.isReady, router]);

    return <WrappedComponent {...props} />;
  };

  return ComponentWithRole;
};

const withPage = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
) => {
  const ComponentWithRole = (props: RoleProps & P) => {
    const { id, username, name, role, setId, setUsername, setName, setRole } =
      useRole();

    useEffect(() => {
      if (props.role && role !== props.role) {
        setRole(props.role);
      } else if (props.id && id !== props.id) {
        setId(props.id);
      } else if (props.username && username !== props.username) {
        setUsername(props.username);
      } else if (props.name && name !== props.name) {
        setName(props.name);
      }
    }, [
      props.role,
      props.id,
      props.username,
      props.name,
      id,
      username,
      name,
      role,
      setId,
      setUsername,
      setName,
      setRole,
    ]);

    return <WrappedComponent {...props} />;
  };

  return ComponentWithRole;
};

const getServerSidePropsWithRole: GetServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const token = context.req.cookies["refreshToken"];
  let role = null;
  let id = null;
  let name = null;
  let username = null;

  if (token) {
    try {
      const payload = jwt.decode(token) as JwtPayload | null;
      if (payload && typeof payload !== "string") {
        role = payload.role;
        id = payload.id;
        name = payload.name;
        username = payload.username;
      }
    } catch (error) {
      console.error("Invalid token");
    }
  }

  return {
    props: {
      role,
      id,
      name,
      username,
    },
  };
};

export { getServerSidePropsWithRole, withPage, withRole };
