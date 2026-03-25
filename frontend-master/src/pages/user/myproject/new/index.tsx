import Layout from "@/src/components/Layout";
import { useRouter } from "next/router";
import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import axios, { AxiosError } from "axios";
import { jwtDecode } from "jwt-decode";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import { useRole } from "@/src/context/RoleContext";
import Link from "next/link";

type Form = {
  id: number;
  id_kategori: number | "";
  nama_magang: string;
  pic: string | null;
  tanggal_mulai: string; // kegiatan start (YYYY-MM-DD)
  tanggal_selesai: string; // kegiatan end
  kriteria: string;
  kuota: number | string;
  pendaftaran_mulai: string; // registration start
  pendaftaran_selesai: string; // registration end
  department_ids: number[];
  faculty_ids: number[];
  targetType: "prodi" | "fakultas";
  [key: string]:
    | string
    | number
    | number[]
    | null
    | undefined
    | "prodi"
    | "fakultas";
};

type Props = { id: any };
type Option = { value: number; label: string };
type Decoded = {
  sub?: string;
  id?: string;
  username?: string;
  email?: string;
  name?: string;
  nama?: string;
  [k: string]: any;
};

const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT || "";

// util tanggal
const pad2 = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day); // Use local timezone instead of UTC
  d.setDate(d.getDate() + days);
  return toIso(d);
};
const dayBefore = (iso?: string) => (iso ? addDays(iso, -1) : undefined);
const dayAfter = (iso?: string) => (iso ? addDays(iso, 1) : undefined);

function DatePickerField({
  name,
  value,
  onChange,
  min,
  max,
  disabled,
  title,
}: {
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <input
      name={name}
      type="date"
      className="input input-bordered w-full"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      disabled={disabled}
      title={title}
      onKeyDown={(e) => e.preventDefault()}
    />
  );
}

function NewMyProjectPage(_props: Props) {
  const router = useRouter();
  const { role } = useRole();

  const axiosJWT = useMemo(() => {
    const instance = axios.create({
      baseURL: APIEndpoint || undefined,
      withCredentials: true,
    });
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token)
        instance.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    return instance;
  }, []);

  const [formData, setFormData] = useState<Form>({
    id: 0,
    id_kategori: "",
    nama_magang: "",
    pic: null,
    tanggal_mulai: "",
    tanggal_selesai: "",
    kriteria: "",
    kuota: "",
    pendaftaran_mulai: "",
    pendaftaran_selesai: "",
    department_ids: [],
    faculty_ids: [],
    targetType: "prodi",
  });

  const [kategoriOptions, setKategoriOptions] = useState<Option[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<Option[]>([]);
  const [picDisplayName, setPicDisplayName] = useState<string>("");

  const [besaranInsentif, setBesaranInsentif] = useState<number>(0);
  const [satuanInsentif, setSatuanInsentif] = useState<string>("Menit");
  const [durasiSesiMenit, setDurasiSesiMenit] = useState<number>(50);

  const isKarya = useMemo(
    () => (satuanInsentif || "").toLowerCase().includes("karya"),
    [satuanInsentif],
  );

  // Treat kategori id 7 and 8 as 'karya' (no kegiatan time required)
  const isKaryaCategory = useMemo(() => {
    const id = Number(formData.id_kategori || 0);
    return id === 7 || id === 8;
  }, [formData.id_kategori]);

  const isKaryaFinal = useMemo(
    () => isKarya || isKaryaCategory,
    [isKarya, isKaryaCategory],
  );

  const [durasiInput, setDurasiInput] = useState<string>("");

  const durasiValid = useMemo(() => {
    const d = Number(durasiInput);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [durasiInput]);

  const totalInsentif = useMemo(() => {
    if (!formData.kuota || !durasiValid || besaranInsentif === 0) return 0;

    const kuota = Number(formData.kuota || 0);

    if (isKarya) {
      return Math.round(durasiValid * besaranInsentif * kuota);
    }

    const sesi = (durasiValid * 60) / Math.max(1, durasiSesiMenit);
    return Math.round(sesi * besaranInsentif * kuota);
  }, [durasiValid, durasiSesiMenit, besaranInsentif, formData.kuota, isKarya]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target as HTMLInputElement;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumber = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  };

  const handleKategoriChange = (opt: Option | null) => {
    setFormData((prev) => ({ ...prev, id_kategori: opt ? opt.value : "" }));
    setDurasiInput("");
  };

  const handleDepartmentChange = (selected: readonly Option[]) => {
    const ids = selected.map((opt) => opt.value);
    setFormData((prev) => ({ ...prev, department_ids: ids }));
  };

  const handleFacultyChange = (selected: readonly Option[]) => {
    const ids = selected.map((opt) => opt.value);
    setFormData((prev) => ({ ...prev, faculty_ids: ids }));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosJWT.get(`/api/internCategory`);
        const raw = res?.data;
        const list = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.result)
              ? raw.result
              : [];
        if (!mounted) return;
        const options = list
          .map(
            (r: any): Option => ({
              value: Number(r.id ?? r.id_kategori ?? r.category_id),
              label: String(
                r.kategori ??
                  r.nama ??
                  r.category_name ??
                  r.name ??
                  "Tanpa Nama",
              ),
            }),
          )
          .filter((o: Option) => Number.isFinite(o.value));
        setKategoriOptions(options);
      } catch {
        setKategoriOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [axiosJWT]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosJWT.get(`/api/department`);
        const raw = res?.data;
        const list = Array.isArray(raw?.data) ? raw.data : [];
        if (!mounted) return;
        const options = list
          .map(
            (dept: any): Option => ({
              value: Number(dept.id),
              label: String(dept.department || ""),
            }),
          )
          .filter((o: Option) => Number.isFinite(o.value) && o.label);
        setDepartmentOptions(options);
      } catch {
        setDepartmentOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [axiosJWT]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosJWT.get(`/api/faculty`);
        const raw = res?.data;
        const list = Array.isArray(raw?.data) ? raw.data : [];
        if (!mounted) return;
        const options = list
          .map(
            (fac: { id: number; faculty: string }): Option => ({
              value: Number(fac.id),
              label: String(fac.faculty || ""),
            }),
          )
          .filter((o: Option) => Number.isFinite(o.value) && o.label);
        setFacultyOptions(options);
      } catch {
        setFacultyOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [axiosJWT]);

  useEffect(() => {
    if (!formData.id_kategori) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axiosJWT.get(
          `/api/incentive/project/${formData.id_kategori}`,
        );
        const data = res?.data?.data || {};
        if (!mounted) return;

        setBesaranInsentif(Number(data?.besaran_insentif) || 0);
        setSatuanInsentif(
          String(
            data?.satuan_insentif ??
              data?.tmst_satuan_insentif?.satuan ??
              "Menit",
          ),
        );
        setDurasiSesiMenit(Number(data?.durasi_satuan) || 50);
      } catch {
        setBesaranInsentif(0);
        setSatuanInsentif("Menit");
        setDurasiSesiMenit(50);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [formData.id_kategori, axiosJWT]);

  useEffect(() => {
    const nameFromRole =
      (role as any)?.profile?.nama ||
      (role as any)?.profile?.name ||
      (role as any)?.user?.nama ||
      (role as any)?.user?.name ||
      "";
    let idFromToken = "";
    let nameFromToken = "";
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("token");
      if (t) {
        try {
          const d = jwtDecode(t) as Decoded;
          idFromToken = (d.sub || d.id || "") as string;
          nameFromToken = (d.nama ||
            d.name ||
            d.username ||
            d.email ||
            "") as string;
        } catch {}
      }
    }
    setPicDisplayName(nameFromRole || nameFromToken || "");
    setFormData((prev) => ({ ...prev, pic: idFromToken || null }));
  }, [role]);

  useEffect(() => {
    const { pendaftaran_mulai, pendaftaran_selesai } = formData;
    if (pendaftaran_mulai) {
      if (!pendaftaran_selesai || pendaftaran_selesai < pendaftaran_mulai) {
        setFormData((prev) => ({
          ...prev,
          pendaftaran_selesai: pendaftaran_mulai,
        }));
      }
    }
  }, [formData, formData.pendaftaran_mulai]);

  useEffect(() => {
    const tm = formData.tanggal_mulai;
    if (!tm) return;
    const maxPend = dayBefore(tm)!;
    if (
      formData.pendaftaran_selesai &&
      formData.pendaftaran_selesai > maxPend
    ) {
      setFormData((prev) => ({ ...prev, pendaftaran_selesai: maxPend }));
    }
    if (formData.pendaftaran_mulai && formData.pendaftaran_mulai > maxPend) {
      setFormData((prev) => ({ ...prev, pendaftaran_mulai: maxPend }));
    }
  }, [
    formData.tanggal_mulai,
    formData.pendaftaran_selesai,
    formData.pendaftaran_mulai,
  ]);

  useEffect(() => {
    const ps = formData.pendaftaran_selesai;
    if (!ps) return;
    const minStart = dayAfter(ps)!;
    if (formData.tanggal_mulai && formData.tanggal_mulai < minStart) {
      setFormData((prev) => ({
        ...prev,
        tanggal_mulai: minStart,
        tanggal_selesai: "",
      }));
    }
  }, [formData.pendaftaran_selesai, formData.tanggal_mulai]);

  const minTanggalSelesai = formData.tanggal_mulai || undefined;
  const minKegiatanMulaiDariReg = formData.pendaftaran_selesai
    ? dayAfter(formData.pendaftaran_selesai)
    : undefined;
  const maxPendaftaranDariKeg = dayBefore(formData.tanggal_mulai);

  // Allow crossing year: do not artificially cap tanggal_selesai to the start-year end.
  // Keep undefined so the user can pick any future date (still validated on submit).
  const maxTanggalSelesai = undefined;

  const submitWithStatus = async (e: FormEvent, status: "Draft" | "Open") => {
    e.preventDefault();
    try {
      if (!formData.id_kategori)
        return toast.error("Jenis Magang wajib dipilih");
      if (!formData.nama_magang)
        return toast.error("Nama Kegiatan wajib diisi");
      if (!formData.kuota) return toast.error("Kuota Mahasiswa wajib diisi");
      if (!formData.pic)
        return toast.error("User tidak terdeteksi, silakan login ulang.");

      if (!formData.pendaftaran_mulai || !formData.pendaftaran_selesai)
        return toast.error("Waktu pendaftaran wajib lengkap.");
      // For karya category (id 7 & 8) we skip requiring kegiatan time
      if (!isKaryaCategory) {
        if (!formData.tanggal_mulai || !formData.tanggal_selesai)
          return toast.error("Waktu kegiatan wajib lengkap.");
        if (!(formData.pendaftaran_selesai < formData.tanggal_mulai))
          return toast.error(
            "Pendaftaran harus ditutup sebelum proyek dimulai.",
          );
      }

      if (!durasiValid || durasiValid <= 0) {
        return toast.error(
          isKarya
            ? "Jumlah karya wajib diisi"
            : "Durasi (jam) per mahasiswa wajib diisi",
        );
      }

      const payload = {
        id_kategori: formData.id_kategori,
        nama: formData.nama_magang,
        kriteria: formData.kriteria,
        kuota:
          typeof formData.kuota === "string"
            ? Number(formData.kuota)
            : formData.kuota,
        tanggal_mulai: formData.tanggal_mulai || null,
        tanggal_selesai: formData.tanggal_selesai || null,
        pendaftaran_mulai: formData.pendaftaran_mulai || null,
        pendaftaran_selesai: formData.pendaftaran_selesai || null,
        pic: formData.pic,
        created_by: formData.pic,
        id_status: status === "Draft" ? 1 : 2,
        durasi_per_mahasiswa: durasiValid,
        // Send based on targetType
        department_ids:
          formData.targetType === "prodi" && formData.department_ids.length > 0
            ? formData.department_ids
            : undefined,
        faculty_ids:
          formData.targetType === "fakultas" && formData.faculty_ids.length > 0
            ? formData.faculty_ids
            : undefined,
      };

      const res = await axiosJWT.post(`/api/masterProject`, payload);
      if (res?.data?.success) {
        toast.success(
          status === "Draft" ? "Disimpan sebagai draft" : "Lowongan dibuka",
        );
        router.push("/user/myproject");
      } else {
        toast.error(res?.data?.message || "Gagal menyimpan");
      }
    } catch (err) {
      const e2 = err as AxiosError<any>;
      const msg = e2.response?.data?.message || e2.message || "Gagal menyimpan";
      toast.error(msg);
    }
  };

  return (
    <Layout title="Buat Project">
      <div className="mx-auto max-w-3xl p-4">
        <form className="space-y-5">
          {/* Kategori */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Jenis Magang:</label>
            <div className="w-3/5">
              <Select
                options={kategoriOptions}
                value={
                  kategoriOptions.find(
                    (o) => o.value === formData.id_kategori,
                  ) || null
                }
                onChange={handleKategoriChange}
                placeholder={kategoriOptions.length ? "" : ""}
                isClearable
                isSearchable={false}
                closeMenuOnScroll={false}
                menuPortalTarget={
                  typeof window !== "undefined" ? document.body : undefined
                }
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: "48px",
                    borderRadius: "0.5rem",
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                classNamePrefix="select"
              />
            </div>
          </div>

          {/* Nama */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Nama Kegiatan:</label>
            <input
              name="nama_magang"
              className="input input-bordered w-3/5"
              placeholder=""
              value={formData.nama_magang}
              onChange={handleChange}
            />
          </div>

          {/* PIC */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Penanggung Jawab:</label>
            <input
              className="input input-bordered w-3/5"
              value={picDisplayName}
              disabled
            />
          </div>

          {/* Deskripsi */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Deskripsi:</label>
            <textarea
              name="kriteria"
              className="textarea textarea-bordered w-3/5"
              placeholder=""
              value={formData.kriteria}
              onChange={handleChange}
            />
          </div>

          {/* Kuota */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Kuota:</label>
            <input
              name="kuota"
              type="number"
              min={1}
              className="input input-bordered w-3/5"
              placeholder=""
              value={formData.kuota}
              onChange={handleNumber}
            />
          </div>

          {/* Target Type Radio Buttons */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Target:</label>
            <div className="w-3/5 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value="prodi"
                  checked={
                    formData.targetType === "prodi" || !formData.targetType
                  }
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      targetType: "prodi",
                      faculty_ids: [],
                    }))
                  }
                  className="radio radio-primary"
                />
                <span>Prodi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value="fakultas"
                  checked={formData.targetType === "fakultas"}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      targetType: "fakultas",
                      department_ids: [],
                    }))
                  }
                  className="radio radio-primary"
                />
                <span>Fakultas</span>
              </label>
            </div>
          </div>

          {/* Target Departemen (Prodi) */}
          {(formData.targetType === "prodi" || !formData.targetType) && (
            <div className="flex justify-between items-start">
              <label className="font-bold w-2/5 pt-3">Target Prodi:</label>
              <div className="w-3/5">
                <Select
                  isMulti
                  options={departmentOptions}
                  value={departmentOptions.filter((opt) =>
                    (formData.department_ids || []).includes(opt.value),
                  )}
                  onChange={handleDepartmentChange}
                  placeholder=""
                  isClearable
                  isSearchable
                  closeMenuOnScroll={false}
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : undefined
                  }
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "48px",
                      borderRadius: "0.5rem",
                    }),
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                  classNamePrefix="select"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kosongkan jika terbuka untuk semua prodi
                </p>
              </div>
            </div>
          )}

          {/* Target Fakultas */}
          {formData.targetType === "fakultas" && (
            <div className="flex justify-between items-start">
              <label className="font-bold w-2/5 pt-3">Target Fakultas:</label>
              <div className="w-3/5">
                <Select
                  isMulti
                  options={facultyOptions}
                  value={facultyOptions.filter((opt) =>
                    (formData.faculty_ids || []).includes(opt.value),
                  )}
                  onChange={handleFacultyChange}
                  placeholder=""
                  isClearable
                  isSearchable
                  closeMenuOnScroll={false}
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : undefined
                  }
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "48px",
                      borderRadius: "0.5rem",
                    }),
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                  classNamePrefix="select"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kosongkan jika terbuka untuk semua fakultas
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="font-bold w-2/5">Waktu Pendaftaran:</label>
            <div className="w-3/5 flex items-center gap-2">
              <DatePickerField
                name="pendaftaran_mulai"
                value={formData.pendaftaran_mulai}
                onChange={handleChange}
                max={maxPendaftaranDariKeg}
              />
              <span className="opacity-70">s.d.</span>
              <DatePickerField
                name="pendaftaran_selesai"
                value={formData.pendaftaran_selesai}
                onChange={handleChange}
                min={formData.pendaftaran_mulai || undefined}
                max={maxPendaftaranDariKeg}
              />
            </div>
          </div>

          {!isKaryaCategory && (
            <div className="flex items-center justify-between">
              <label className="font-bold w-2/5">Waktu Kegiatan:</label>
              <div className="w-3/5 flex items-center gap-2">
                <DatePickerField
                  name="tanggal_mulai"
                  value={formData.tanggal_mulai}
                  onChange={handleChange}
                  min={minKegiatanMulaiDariReg}
                  title={
                    minKegiatanMulaiDariReg
                      ? `≥ ${minKegiatanMulaiDariReg}`
                      : undefined
                  }
                />
                <span className="opacity-70">s.d.</span>
                <DatePickerField
                  name="tanggal_selesai"
                  value={formData.tanggal_selesai}
                  onChange={handleChange}
                  min={minTanggalSelesai}
                  max={maxTanggalSelesai}
                />
              </div>
            </div>
          )}

          {/* Durasi atau Karya */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">
              {isKaryaFinal ? "Karya:" : "Durasi:"}
            </label>
            <div className="w-3/5 flex items-center gap-2">
              <input
                className="input input-bordered flex-1"
                type="number"
                min={1}
                placeholder={isKaryaFinal ? "Jumlah karya" : "Jam"}
                value={durasiInput}
                onChange={(e) => setDurasiInput(e.target.value)}
              />
              <span className="text-sm opacity-70">
                {isKaryaFinal ? "karya" : "Jam"}
              </span>
            </div>
          </div>

          {/* Info sesi */}
          {!isKaryaFinal && (
            <div className="flex justify-end">
              <p className="text-xs text-gray-500">
                1 sesi = {durasiSesiMenit} menit • Estimasi sesi:{" "}
                {durasiValid
                  ? ((durasiValid * 60) / Math.max(1, durasiSesiMenit)).toFixed(
                      2,
                    )
                  : "0.00"}
              </p>
            </div>
          )}

          {/* Total Insentif */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Total Insentif (Rp):</label>
            <input
              className="input input-bordered w-3/5"
              type="text"
              value={new Intl.NumberFormat("id-ID").format(totalInsentif)}
              readOnly
            />
          </div>

          <div className="flex justify-between pt-4">
            <Link
              href="/user/myproject"
              className="btn bg-primary flex items-center justify-center"
            >
              Kembali
            </Link>
            <div className="flex gap-3">
              <button
                className="btn btn-ghost border"
                onClick={(e) => submitWithStatus(e, "Draft")}
              >
                Simpan Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={(e) => submitWithStatus(e, "Open")}
              >
                Buka Lowongan
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;
export default withPage(NewMyProjectPage);
