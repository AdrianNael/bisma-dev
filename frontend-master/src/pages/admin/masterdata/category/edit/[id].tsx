import Layout from "@/src/components/Layout";
import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
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
  kategori: string;
  besaran_insentif: number;
  id_satuan: number;
  durasi_satuan: number;
};

const EditKategori = () => {
  const router = useRouter();
  const { id } = router.query;
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
  const [formData, setFormData] = useState<Form>({
    kategori: "",
    besaran_insentif: 0,
    id_satuan: 0,
    durasi_satuan: 0,
  });
  const [satuanList, setSatuanList] = useState<
    { id: number; satuan: string }[]
  >([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
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
      }
    };

    refreshToken();
  }, [APIEndpoint]);

  const axiosJWT = useMemo(() => {
    const instance = axios.create();

    instance.interceptors.request.use(
      async (config) => {
        if (token) {
          const currentDate = new Date();
          if (expire && expire * 1000 < currentDate.getTime()) {
            const response = await axios.get(`${APIEndpoint}/token`, {
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
  }, [token, expire, APIEndpoint]);

  // Fetch satuan list
  useEffect(() => {
    const fetchSatuan = async () => {
      try {
        const response = await axiosJWT.get(`${APIEndpoint}/api/incentiveUnit`);
        setSatuanList(response.data.data);
      } catch (error) {
        console.error("Error fetching satuan:", error);
      }
    };

    if (token) {
      fetchSatuan();
    }
  }, [token, axiosJWT, APIEndpoint]);

  // Fetch incentive data (includes category info)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosJWT.get(
          `${APIEndpoint}/api/incentive/${id}`,
        );
        const data = response.data.data;
        setCategoryId(data.id_kategori);
        setFormData({
          kategori: data.kategori,
          besaran_insentif: data.besaran_insentif,
          id_satuan: data.id_satuan,
          durasi_satuan: data.id_satuan === 2 ? 1 : data.durasi_satuan,
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Gagal mengambil data.");
      }
    };

    if (id && token) {
      fetchData();
    }
  }, [id, token, axiosJWT, APIEndpoint]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSatuanChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: Number(value),
    };

    // If satuan is "karya" (id=2), set durasi_satuan to 1
    if (Number(value) === 2) {
      newFormData.durasi_satuan = 1;
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Step 1: Update category name
      if (categoryId) {
        await axiosJWT.put(
          `${APIEndpoint}/api/internCategory/${categoryId}`,
          { kategori: formData.kategori },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
        );
      }

      // Step 2: Update incentive
      const response = await axiosJWT.put(
        `${APIEndpoint}/api/incentive/update/${id}`,
        {
          id_kategori: categoryId,
          id_satuan: Number(formData.id_satuan),
          besaran_insentif: Number(formData.besaran_insentif),
          durasi_satuan: Number(formData.durasi_satuan),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status === 200) {
        toast.success("Data berhasil diupdate!");
        router.push("/admin/masterdata/category");
      } else {
        toast.error(response.data.message || "Gagal mengupdate data.");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal mengupdate data.");
      console.error(error);
    }
  };

  return (
    <Layout title="Edit Kategori">
      <div className="bg-white drop-shadow-md rounded-lg w-full min-h p-4">
        <form onSubmit={handleSubmit} className="form-control flex gap-4">
          <div className="flex">
            <label className="flex items-center capitalize font-bold w-2/5">
              Nama Kegiatan:
            </label>
            <input
              className="input input-bordered w-3/5"
              type="text"
              placeholder="Nama Kegiatan"
              name="kategori"
              value={formData.kategori}
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex">
            <label className="flex items-center capitalize font-bold w-2/5">
              Insentif (Rp):
            </label>
            <input
              className="input input-bordered w-3/5"
              type="number"
              placeholder="Besaran Insentif"
              name="besaran_insentif"
              value={formData.besaran_insentif}
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex">
            <label className="flex items-center capitalize font-bold w-2/5">
              Satuan:
            </label>
            <select
              className="select select-bordered w-3/5"
              name="id_satuan"
              value={formData.id_satuan}
              onChange={handleSatuanChange}
              required
            >
              <option value="">Pilih Satuan</option>
              {satuanList.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.satuan}
                </option>
              ))}
            </select>
          </div>

          {formData.id_satuan !== 2 && formData.id_satuan !== 0 && (
            <div className="flex">
              <label className="flex items-center capitalize font-bold w-2/5">
                Durasi (Menit):
              </label>
              <input
                className="input input-bordered w-3/5"
                type="number"
                placeholder="Durasi dalam menit"
                name="durasi_satuan"
                value={formData.durasi_satuan}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="flex justify-end w-full gap-4">
            <Link
              href={"/admin/masterdata/category"}
              className="btn btn-warning"
            >
              Kembali
            </Link>
            <button type="submit" className="btn btn-primary w-1/6">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;

export default withPage(EditKategori);
