/* eslint-disable react-hooks/exhaustive-deps */

import Layout from "@/src/components/Layout";
import React, { useState, useEffect, useMemo } from "react";
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

interface Faculty {
  id: number;
  faculty: string;
}

type Form = {
  department: string;
  faculty_id: number | "";
};

const AddDepartment = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [formData, setFormData] = useState<Form>({
    department: "",
    faculty_id: "",
  });
  const [facultyOptions, setFacultyOptions] = useState<Faculty[]>([]);
  const router = useRouter();

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    refreshToken();
  }, []);

  const refreshToken = async () => {
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
  };

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

  // Fetch faculty options
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const response = await axiosJWT.get(`${APIEndpoint}/api/faculty`);
        setFacultyOptions(response.data.data || []);
      } catch (error) {
        console.error("Error fetching faculty data:", error);
      }
    })();
  }, [token, axiosJWT, APIEndpoint]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]:
        name === "faculty_id" ? (value === "" ? "" : Number(value)) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        department: formData.department,
        faculty_id: formData.faculty_id || null,
      };

      const response = await axiosJWT.post(
        `${APIEndpoint}/api/department`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status === 201) {
        toast.success("Program Studi berhasil ditambahkan!");
        router.push("/admin/masterdata/department");
      } else {
        toast.error(
          response.data.message || "Gagal menambahkan program studi.",
        );
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
    <Layout title="Tambah Program Studi">
      <div className="w-full min-h-[calc(100vh-2rem)] p-6">
        <h2 className="text-2xl font-bold mb-6">Tambah Program Studi</h2>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Nama Program Studi</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Fakultas</label>
              <select
                className="select select-bordered w-full"
                name="faculty_id"
                value={formData.faculty_id}
                onChange={handleChange}
              >
                <option value="">-- Pilih Fakultas --</option>
                {facultyOptions.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.faculty}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-4">
            <Link
              href="/admin/masterdata/department"
              className="btn btn-warning"
            >
              Kembali
            </Link>
            <button type="submit" className="btn btn-primary">
              Tambah Program Studi
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(AddDepartment);
