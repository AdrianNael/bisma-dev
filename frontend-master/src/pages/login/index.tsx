// pages/login.tsx
import React, { useState, useEffect as _useEffect } from "react";
import { useRouter } from "next/router";
import { FaUser, FaLock } from "react-icons/fa";
import axios from "axios";
import Head from "next/head";
import Image, { ImageLoaderProps } from "next/image";
import { useRole } from "@/src/context/RoleContext";

const LoginPage = () => {
  const endPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const pageTitle = "Login Page";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const {
    setId,
    setUsername: setContextUsername,
    setName,
    setRole,
  } = useRole();

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async () => {
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    try {
      const response = await axios.post(
        `${endPoint}/login`,
        { username, password },
        {
          withCredentials: true,
        },
      );

      const { token } = response.data.data;
      localStorage.setItem("token", token);

      // Decode token dan simpan ke RoleContext
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
      const role = payload.role;
      const userId = payload.sub || payload.id;
      const userName = payload.name || payload.username;

      // Simpan ke RoleContext (yang akan otomatis simpan ke localStorage)
      setRole(role);
      setId(userId);
      setName(userName);
      setContextUsername(username); // username dari form input

      if (role === "MANAGER") {
        router.push("/admin/monitoring");
      } else if (role === "DIRMAWA") {
        router.push("/admin/project");
      } else if (role === "MAHASISWA") {
        router.push("/mahasiswa/lowongan");
      } else if (role === "STAF") {
        router.push("/user/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Invalid username or password");
    }
  };

  const customLoader = ({ src, width, quality }: ImageLoaderProps): string => {
    return `${src}?w=${width}&q=${quality || 75}`;
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-800">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-center text-2xl font-bold mb-6">ADIMAS</h1>
          <div className="flex justify-center py-6 my-6">
            <Image
              src="/Logo-UniversitasPertamina.png"
              alt="Universitas Pertamina"
              width={200}
              height={250}
              loader={customLoader}
            />
          </div>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="username"
            >
              <div className="flex items-center">
                <FaUser className="mr-2" />
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={handleUsernameChange}
                />
              </div>
            </label>
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="password"
            >
              <div className="flex items-center">
                <FaLock className="mr-2" />
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={handlePasswordChange}
                />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-center">
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
              type="button"
              onClick={handleSubmit}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
