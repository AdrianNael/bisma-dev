import Layout from "@/src/components/Layout";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { jwtDecode } from "jwt-decode";

type Quota = {
  month: string;
  used: number;
  remaining: number;
  limit: number;
  breakdown?: Record<string, number>; // { "YYYY-MM": jumlah_jam }
};

interface DecodedToken {
  exp: number;
}

const DetailStudent = () => {
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const { id } = router.query; // nim mahasiswa
  const [token, setToken] = useState<string | null>(null);
  const [expire, setExpire] = useState<number | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(false);

  const dt = new Date();
  const defaultMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${APIEndpoint}/token`, {
          withCredentials: true,
        });
        setToken(r.data?.data?.token);
        const decoded: DecodedToken = jwtDecode(r.data?.data?.token);
        setExpire(decoded.exp);
      } catch {
        router.push("/login");
      }
    })();
  }, [APIEndpoint, router]);

  const axiosJWT = useMemo(() => {
    const a = axios.create();
    a.interceptors.request.use(async (config) => {
      if (token) {
        const now = Date.now();
        if (expire && expire * 1000 < now) {
          const r = await axios.get(`${APIEndpoint}/token`, {
            withCredentials: true,
          });
          config.headers.Authorization = `Bearer ${r.data.data.token}`;
          setToken(r.data.data.token);
          const decoded: DecodedToken = jwtDecode(r.data.data.token);
          setExpire(decoded.exp);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
    return a;
  }, [token, expire, APIEndpoint]);

  useEffect(() => {
    if (!id || !token) return;
    setLoading(true);
    (async () => {
      try {
        const r = await axiosJWT.get(`${APIEndpoint}/api/mahasiswa/quota`, {
          params: { id, month: defaultMonth },
        });
        setQuota(r.data?.data || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, axiosJWT, APIEndpoint, defaultMonth]);

  return (
    <Layout title="Detail Student">
      <div className="container bg-white w-full min-h-screen drop-shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Kuota Jam Bulanan</h2>
        {loading ? (
          <div>Memuat...</div>
        ) : !quota ? (
          <div>Tidak ada data.</div>
        ) : (
          <>
            <div className="mb-4">
              <div>
                <b>Bulan:</b> {quota.month}
              </div>
              <div>
                <b>Terpakai:</b> {quota.used} jam
              </div>
              <div>
                <b>Sisa:</b> {quota.remaining} / {quota.limit} jam
              </div>
            </div>
            {quota.breakdown && (
              <>
                <h3 className="font-semibold mb-2">
                  Pembagian Rencana Lintas Bulan
                </h3>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Bulan</th>
                        <th>Alokasi Jam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(quota.breakdown).map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{Math.floor(Number(v) || 0)} jam</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default DetailStudent;
