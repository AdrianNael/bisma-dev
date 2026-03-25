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
  faculty: string;
};

const EditFaculty = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [formData, setFormData] = useState<Form>({
    faculty: "",
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

  const fetchFacultyData = useCallback(async () => {
    if (!id) return;
    try {
      const response = await axiosJWT.get(`${APIEndpoint}/api/faculty/${id}`);
      if (response.data.success) {
        setFormData({ faculty: response.data.data.faculty });
      } else {
        toast.error("Gagal mengambil data fakultas");
      }
    } catch (error) {
      console.error("Error fetching faculty data:", error);
      toast.error("Gagal mengambil data fakultas");
    }
  }, [axiosJWT, APIEndpoint, id]);

  useEffect(() => {
    if (token && id) {
      fetchFacultyData();
    }
  }, [token, id, fetchFacultyData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosJWT.put(
        `${APIEndpoint}/api/faculty/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status === 200) {
        toast.success("Fakultas berhasil diupdate!");
        router.push("/admin/masterdata/faculty");
      } else {
        toast.error(response.data.message || "Gagal mengupdate fakultas.");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          JSON.parse(error.request.response).message,
      );
      console.error(error.request.response);
    }
  };

  return (
    <Layout title="Edit Fakultas">
      <div className="w-full min-h-[calc(100vh-2rem)] p-6">
        <h2 className="text-2xl font-bold mb-6">Edit Fakultas</h2>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Nama Fakultas</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="faculty"
                value={formData.faculty}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-4">
            <Link href="/admin/masterdata/faculty" className="btn btn-warning">
              Kembali
            </Link>
            <button type="submit" className="btn btn-primary">
              Update Fakultas
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(EditFaculty);
