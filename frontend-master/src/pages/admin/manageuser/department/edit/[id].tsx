import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { GetServerSideProps } from "next";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  exp: number;
}

type Form = {
  department: string;
};

const EditDepartment = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [formData, setFormData] = useState<Form>({
    department: "",
  });
  const router = useRouter();
  const { id } = router.query;

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refreshToken = useCallback(async () => {
    try {
      const response = await axios.get(`${APIEndpoint}/token`, {
        withCredentials: true,
      });
      setToken(response.data.data.token);
      const decoded: DecodedToken = jwtDecode(response.data.data.token);
      setExpire(decoded.exp);
    } catch (error: any) {
      console.error("Error refreshing token:", error);
      if (error.response) {
        router.push("/login");
      }
    }
  }, [APIEndpoint, router]);

  useEffect(() => {
    // refresh token on mount
    refreshToken();
  }, [refreshToken]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();

    instance.interceptors.request.use(
      async (config) => {
        const currentDate = new Date();
        if (expire && expire * 1000 < currentDate.getTime()) {
          const response = await axios.get(`${APIEndpoint}/token`, {
            withCredentials: true,
          });
          config.headers.Authorization = `Bearer ${response.data.data.token}`;
          setToken(response.data.data.token);
          const decoded: DecodedToken = jwtDecode(response.data.data.token);
          setExpire(decoded.exp);
        } else if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }, [token, expire, APIEndpoint]);

  const fetchDepartmentData = useCallback(async () => {
    if (!id) return;
    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/department/${id}`,
      );
      if (response.data.success) {
        setFormData(response.data.data);
      } else {
        toast.error("Failed to fetch department data");
      }
    } catch (error) {
      console.error("Error fetching department data:", error);
      toast.error("Failed to fetch department data");
    }
  }, [axiosJWT, APIEndpoint, id]);

  useEffect(() => {
    if (token && id) {
      fetchDepartmentData();
    }
  }, [token, id, fetchDepartmentData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosJWT.put(
        `${APIEndpoint}/api/department/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status === 200) {
        toast.success("Department updated successfully!");
        router.push("/admin/manageuser/department");
      } else {
        toast.error(response.data.message || "Failed to update department.");
      }
    } catch (error: any) {
      toast.error(JSON.parse(error.request.response).message);
      console.error(error.request.response);
    }
  };

  return (
    <Layout title="Edit Department">
      <div className="w-full min-h-[calc(100vh-2rem)] p-6">
        <h2 className="text-2xl font-bold mb-6">Edit Department</h2>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Nama Department</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-4">
            <Link
              href="/admin/manageuser/department"
              className="btn btn-warning"
            >
              Kembali
            </Link>
            <button type="submit" className="btn btn-primary">
              Update Department
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(EditDepartment);
