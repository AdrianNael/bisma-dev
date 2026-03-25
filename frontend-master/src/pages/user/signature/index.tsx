import Layout from "@/src/components/Layout";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { useRole } from "@/src/context/RoleContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import dynamic from "next/dynamic";

const SignaturePad = dynamic(() => import("@/src/components/SignaturePad"), {
  ssr: false,
});

interface DecodedToken {
  exp: number;
}

type Props = {
  name: string;
  role: string;
  id: string;
};

const Signature = ({ name: _name, role: _role, id }: Props) => {
  const ApiEndPoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const router = useRouter();
  const { setId } = useRole();
  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [jabatan, setJabatan] = useState<string>("");
  const [jabatanLoading, setJabatanLoading] = useState(false);
  const pageTitle = "Signature";

  // For lecturer signatures, use userId as the key
  const signatureKey = `user_${id}`;

  useEffect(() => {
    setId(id);
  }, [id, setId]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${ApiEndPoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (error: any) {
        router.push("/login");
      }
    };
    refreshToken();
  }, [ApiEndPoint, router]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${ApiEndPoint}/token`, {
              withCredentials: true,
            });
            config.headers.Authorization = `Bearer ${response.data.data.token}`;
            setToken(response.data.data.token);
            const decoded: DecodedToken = jwtDecode(response.data.data.token);
            setExpire(decoded.exp);
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        toast.error(error.response?.data?.message || "Request error");
        return Promise.reject(error);
      },
    );
    return instance;
  }, [token, expire, ApiEndPoint]);

  // Load existing signature
  useEffect(() => {
    const loadSignature = async () => {
      if (!token) return;
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/lecturer/${signatureKey}`,
        );
        if (res.data?.url) {
          setSignature(res.data.url);
        }
      } catch (e) {
        // Signature not found, that's okay
      }
    };
    loadSignature();
  }, [token, axiosJWT, ApiEndPoint, signatureKey]);

  // Load existing jabatan
  useEffect(() => {
    const loadJabatan = async () => {
      if (!token) return;
      try {
        const res = await axiosJWT.get(
          `${ApiEndPoint}/api/signature/jabatan/${signatureKey}`,
        );
        if (res.data?.jabatan) {
          setJabatan(res.data.jabatan);
        }
      } catch (e) {
        // Jabatan not found, that's okay
      }
    };
    loadJabatan();
  }, [token, axiosJWT, ApiEndPoint, signatureKey]);

  const handleSaveSignature = async (dataUrl: string) => {
    setLoading(true);
    try {
      await axiosJWT.post(`${ApiEndPoint}/api/signature/lecturer`, {
        key: signatureKey,
        dataUrl,
      });
      setSignature(dataUrl);
      toast.success("Tanda tangan berhasil disimpan");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal menyimpan tanda tangan",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    setSignature(null);
  };

  const handleSaveJabatan = async () => {
    if (!jabatan.trim()) {
      toast.warning("Jabatan tidak boleh kosong");
      return;
    }
    setJabatanLoading(true);
    try {
      await axiosJWT.post(`${ApiEndPoint}/api/signature/jabatan`, {
        key: signatureKey,
        jabatan: jabatan.trim(),
      });
      toast.success("Jabatan berhasil disimpan");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan jabatan");
    } finally {
      setJabatanLoading(false);
    }
  };

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full max-w-2xl">
          {/* User Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Informasi User</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  User ID / NIP
                </label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{id}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nama
                </label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {_name || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {_role}
                </div>
              </div>
            </div>
          </div>

          {/* Jabatan Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Jabatan</h2>
            <p className="text-sm text-gray-600 mb-4">
              Jabatan akan ditampilkan di timesheet dan rekapitulasi
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="example: Dosen Pembimbing"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={jabatanLoading}
              />
              <button
                onClick={handleSaveJabatan}
                disabled={jabatanLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {jabatanLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Signature Pad */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Tanda Tangan</h2>
            <div className="flex justify-center">
              <SignaturePad
                value={signature || undefined}
                onSave={handleSaveSignature}
                onClear={handleClearSignature}
                readOnly={loading}
                showSave={true}
                showClear={true}
                width={500}
                height={200}
              />
            </div>
            {loading && (
              <div className="text-center mt-4">
                <span className="text-blue-600">Saving...</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Petunjuk:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • Gambar tanda tangan menggunakan mouse atau sentuhan pada area
                di atas
              </li>
              <li>
                • Atau klik &quot;Upload&quot; untuk mengunggah gambar tanda
                tangan
              </li>
              <li>
                • Atau seret dan letakkan file gambar langsung ke area tanda
                tangan
              </li>
              <li>• Gambar akan dikompresi dan dipusatkan secara otomatis</li>
              <li>• Klik &quot;Simpan&quot; untuk menyimpan tanda tangan</li>
              <li>
                • Klik &quot;Hapus&quot; untuk menghapus dan menggambar ulang
              </li>
              <li>
                • Tanda tangan dan jabatan ini akan digunakan secara otomatis
                pada dokumen rekapitulasi dan timesheet
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;
export default withPage(Signature);
