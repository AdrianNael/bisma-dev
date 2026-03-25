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
  const pageTitle = "Signature";

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
          `${ApiEndPoint}/api/signature/student/${id}`,
        );
        if (res.data?.url) {
          setSignature(res.data.url);
        }
      } catch (e) {
        // Signature not found, that's okay
      }
    };
    loadSignature();
  }, [token, axiosJWT, ApiEndPoint, id]);

  const handleSaveSignature = async (dataUrl: string) => {
    setLoading(true);
    try {
      await axiosJWT.post(`${ApiEndPoint}/api/signature/student`, {
        userId: id,
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

  const handleClearSignature = async () => {
    try {
      await axiosJWT.delete(`${ApiEndPoint}/api/signature/student/${id}`);
      setSignature(null);
      toast.success("Tanda tangan berhasil dihapus");
    } catch (error: any) {
      // If it was already not found, that's fine
      if (error.response?.status === 404) {
        setSignature(null);
      } else {
        toast.error(
          error.response?.data?.message || "Gagal menghapus tanda tangan",
        );
      }
    }
  };

  return (
    <Layout title={pageTitle}>
      <div className="flex justify-center m-4 mt-6">
        <div className="flex flex-col gap-6 w-full max-w-2xl">
          {/* User Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">User Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  User ID
                </label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{id}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {_name || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Signature Pad */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Signature</h2>
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
            <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • Draw your signature using mouse or touch in the area above
              </li>
              <li>
                • Or click &quot;Upload&quot; to upload an image of your
                signature
              </li>
              <li>
                • Or drag and drop an image file directly onto the signature
                area
              </li>
              <li>• Images will be automatically compressed and centered</li>
              <li>
                • Small images will be enlarged with padding for better
                visibility
              </li>
              <li>• Click &quot;Save&quot; to save the signature</li>
              <li>• Click &quot;Clear&quot; to erase and redraw</li>
              <li>
                • This signature will be used automatically in timesheet
                submissions and reports
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
