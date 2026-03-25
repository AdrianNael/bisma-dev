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

interface Department {
  id: number;
  department: string;
}

type Form = {
  nim: string;
  username: string;
  no_rekening: string;
  nama: string;
  password: string;
  no_telp: string;
  departemen: string;
};

const EditStudentUser = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [formData, setFormData] = useState<Form>({
    nim: "",
    username: "",
    no_rekening: "",
    nama: "",
    password: "",
    no_telp: "",
    departemen: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const router = useRouter();
  const { username } = router.query;

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

  useEffect(() => {
    if (token && username) {
      fetchDepartments();
      fetchStudentData();
    }
  }, [token, username]);

  const fetchDepartments = async () => {
    try {
      const response = await axiosJWT.get(`${APIEndpoint}/api/department`);
      if (response.status === 200 && Array.isArray(response.data.data)) {
        setDepartments(response.data.data);
      } else {
        console.error("Unexpected API response structure:", response.data);
        toast.error("Failed to fetch departments: Unexpected data structure");
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to fetch departments");
    }
  };

  const fetchStudentData = async () => {
    try {
      const response = await axiosJWT.get(
        `${APIEndpoint}/api/mahasiswa/${username}`,
      );
      if (response.data.success) {
        setFormData(response.data.data);
      } else {
        toast.error("Failed to fetch student data");
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
      toast.error("Failed to fetch student data");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosJWT.patch(
        `${APIEndpoint}/api/mahasiswa/update/${username}`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status === 200) {
        toast.success("Student user updated successfully!");
        router.push("/admin/manageuser/student");
      } else {
        toast.error(response.data.message || "Failed to update student user.");
      }
    } catch (error: any) {
      toast.error(JSON.parse(error.request.response).message);
      console.error(error.request.response);
    }
  };

  return (
    <Layout title="Edit User - Student">
      <div className="w-full min-h-[calc(100vh-2rem)] p-6">
        <h2 className="text-2xl font-bold mb-6">Edit User - Student</h2>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">NIM</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="nim"
                value={formData.nim}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Username</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">No Rekening</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="no_rekening"
                value={formData.no_rekening}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">Nama</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">No Telepon</label>
              <input
                className="input input-bordered w-full"
                type="text"
                name="no_telp"
                value={formData.no_telp}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 font-semibold">
                Department (Program Studi)
              </label>
              <select
                className="select select-bordered w-full"
                name="departemen"
                value={formData.departemen}
                onChange={handleChange}
                required
              >
                <option value="">Select a department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.department}>
                    {department.department}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-4">
            <Link href="/admin/manageuser/student" className="btn btn-warning">
              Kembali
            </Link>
            <button type="submit" className="btn btn-primary">
              Update Student
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(EditStudentUser);
