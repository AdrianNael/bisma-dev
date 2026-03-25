import Layout from "@/src/components/Layout";
import { useRouter } from "next/router";
import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useRef,
  useMemo,
  useCallback,
} from "react";

import Select from "react-select";
import { toast } from "react-toastify";
import { GetServerSideProps } from "next";
import axios, { AxiosError } from "axios";
import { jwtDecode } from "jwt-decode";
import { withPage, getServerSidePropsWithRole } from "@/src/utils/withRole";
import Link from "next/link";
import { useRole } from "@/src/context/RoleContext";

interface DecodedToken {
  exp: number;
}

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

function DateInput({
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

type Form = {
  id: number;
  id_kategori: number | string;
  nama_magang: string;
  pic: { value: number | string; label: string } | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  kriteria: string;
  kuota: number | string;
  pendaftaran_mulai: string;
  pendaftaran_selesai: string;
  [key: string]: string | number | [] | Record<string, unknown> | null;
};

type Props = { projectId?: string };

const EditProject = ({ projectId: _projectId }: Props) => {
  const router = useRouter();
  const idProject = router.query.id as string;
  const APIEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT as string;

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
  }, [APIEndpoint]);

  const [formData, setFormData] = useState<Form>({
    id: 0,
    id_kategori: 0,
    nama_magang: "",
    pic: null,
    tanggal_mulai: "",
    tanggal_selesai: "",
    kriteria: "",
    kuota: "",
    pendaftaran_mulai: "",
    pendaftaran_selesai: "",
  });

  const [InputMahasiswa, SetInputMahasiswa] = useState<
    {
      id: number;
      mahasiswa:
        | { value: number | string; label: string; recap?: string }
        | string;
      durasi: number;
      insentif: number;
      trueID: number;
      estimasi: number;
      id_status: number | string;
      id_tran_project: number | null;
    }[]
  >([
    {
      id: 1,
      mahasiswa: { value: 0, label: "" },
      durasi: 0,
      insentif: 0,
      trueID: 0,
      estimasi: 0,
      id_status: 0,
      id_tran_project: null,
    },
  ]);
  const [jenisMagangOptions, setMagangOptions] = useState<
    {
      nama: string;
      id: number;
      kategori?: string;
      id_satuan: string;
      besaran_insentif: number;
      id_kategori?: number;
    }[]
  >([]);
  const [_PIC, setPIC] = useState<{ id: number | string; nama: string }[]>([]);
  const [_Upahnya, setUpah] = useState(0);
  const [_Mahasiswa, setMahasiswaOptions] = useState<
    { id: number | string; nama: string; sisa_sesi: number | string }[]
  >([]);
  const [_currentProject, setCurrentProject] = useState<
    Record<string, unknown>[]
  >([]);
  const [_totalInsentifFinal, retotal] = useState(0);
  const [existingDataCount, setExistingDataCount] = useState(0);
  const [_deletedIds, _setDeletedIds] = useState<(number | null)[]>([]);

  const [besaranInsentif, setBesaranInsentif] = useState<number>(0);
  const [satuanInsentif, setSatuanInsentif] = useState<string>("Menit");
  const [durasiSesiMenit, setDurasiSesiMenit] = useState<number>(50);

  const isKarya = useMemo(
    () => (satuanInsentif || "").toLowerCase().includes("karya"),
    [satuanInsentif],
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

  const myFormRef = useRef<HTMLFormElement>(null);

  const _ModalStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "100%",
      bottom: "auto",
      marginRight: "-70%",
      transform: "translate(-50%, -50%)",
    },
  };

  const [_expire, setExpire] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { setId, id } = useRole();

  // State untuk mengecek apakah project bisa diedit
  const [canEdit, setCanEdit] = useState(true);
  const [editBlockReason, setEditBlockReason] = useState("");

  // State untuk target Prodi/Fakultas
  type Option = { value: number; label: string };
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<Option[]>([]);
  const [targetType, setTargetType] = useState<"prodi" | "fakultas">("prodi");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>(
    [],
  );
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);

  useEffect(() => {
    setId(id);
  }, [id, setId]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await axios.get(`${APIEndpoint}/token`, {
          withCredentials: true,
        });
        setToken(response.data.data.token);
        const decoded: DecodedToken = jwtDecode(response.data.data.token);
        setExpire(decoded.exp);
      } catch (_err) {
        router.push("/login");
      }
    };
    refreshToken();
  }, [APIEndpoint, router]);

  // helper: tampilkan pesan backend (409) lalu balik ke list
  const notifyAndBack = useCallback(
    (message: string) => {
      toast.error(message);
      router.push("/user/myproject");
    },
    [router],
  );

  const getMessageFromError = (e: unknown): string | undefined => {
    if (!e) return undefined;
    if (typeof e === "string") return e;
    try {
      const ax = e as AxiosError<unknown>;
      const resp = ax.response as any;
      if (resp?.data?.message) return String(resp.data.message);
    } catch {}
    const obj = e as any;
    return obj?.message ?? undefined;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      if (router.isReady && token) {
        try {
          const response = await axiosJWT.get(
            `${APIEndpoint}/api/masterProject/${idProject}`,
          );
          if (response.status === 200) {
            const objectData = response.data;
            setCurrentProject(objectData.data);

            // Set durasi input dari durasi_default yang ada di database
            if (objectData.data.durasi_default) {
              setDurasiInput(String(objectData.data.durasi_default));
            }

            setFormData({
              id: objectData.data.id,
              id_kategori: objectData.data.kategoriId,
              nama_magang:
                objectData.data.nama?.lastIndexOf(" - ") > 0
                  ? objectData.data.nama.substring(
                      0,
                      objectData.data.nama.lastIndexOf(" - "),
                    )
                  : objectData.data.nama,
              pic: { value: objectData.data.picId, label: objectData.data.pic },
              tanggal_mulai: objectData.data.tanggal_mulai
                ? convertDateFormat(objectData.data.tanggal_mulai)
                : "",
              tanggal_selesai: objectData.data.tanggal_selesai
                ? convertDateFormat(objectData.data.tanggal_selesai)
                : "",
              kriteria: objectData.data.kriteria || "",
              kuota: objectData.data.kuota || "",
              pendaftaran_mulai: objectData.data.pendaftaran_mulai
                ? convertDateFormat(objectData.data.pendaftaran_mulai)
                : "",
              pendaftaran_selesai: objectData.data.pendaftaran_selesai
                ? convertDateFormat(objectData.data.pendaftaran_selesai)
                : "",
              created_by: id as string,
            });

            // Set target type and selected IDs from project data
            const projectDepts = objectData.data.project_departments || [];
            const projectFacs = objectData.data.project_faculties || [];

            if (projectFacs.length > 0) {
              setTargetType("fakultas");
              setSelectedFacultyIds(
                projectFacs.map((pf: { faculty_id: number }) => pf.faculty_id),
              );
              setSelectedDepartmentIds([]);
            } else if (projectDepts.length > 0) {
              setTargetType("prodi");
              setSelectedDepartmentIds(
                projectDepts.map(
                  (pd: { department_id: number }) => pd.department_id,
                ),
              );
              setSelectedFacultyIds([]);
            } else {
              setTargetType("prodi");
              setSelectedDepartmentIds([]);
              setSelectedFacultyIds([]);
            }

            // Use data from objectData (already contains student assignment data)
            if (Array.isArray(objectData.data.anggota)) {
              setExistingDataCount(objectData.data.anggota.length);

              // PERBAIKI: Hitung insentif dengan rumus yang benar saat load data
              const newInputMahasiswa = objectData.data.anggota.map(
                (mahasiswa: string, index: number) => {
                  const durasi = objectData.data.durasi[index] || 0;

                  // Ambil data kategori untuk menghitung estimasi yang benar
                  const kategoriData = jenisMagangOptions.find(
                    (o) => o.id === objectData.data.kategoriId,
                  );

                  let estimasiInsentif = objectData.data.estimasi[index] || 0;

                  // Jika ada data kategori, hitung ulang dengan rumus yang benar
                  if (kategoriData && durasi > 0) {
                    const { besaran_insentif, id_satuan } = kategoriData;

                    if (parseInt(id_satuan) === 1) {
                      // Satuan menit: gunakan rumus yang benar
                      const sesiMenit = 50;
                      const jumlahSesi = (durasi * 60) / Math.max(1, sesiMenit);
                      estimasiInsentif = Math.round(
                        jumlahSesi * besaran_insentif,
                      );
                    } else if (parseInt(id_satuan) === 2) {
                      // Satuan karya
                      estimasiInsentif = durasi * besaran_insentif;
                    }
                  }

                  return {
                    id: index + 1,
                    mahasiswa: {
                      value: `${objectData.data.id_anggota[index]}`,
                      label: `${mahasiswa}`,
                      recap: `[${index + 1}] ${mahasiswa}`,
                    },
                    durasi: durasi,
                    estimasi: estimasiInsentif,
                    id_tran_project:
                      objectData.data.id_tran_project[index] || null,
                    id_status: objectData.data.status || "Unknown",
                    trueID: index + 1,
                  };
                },
              );
              SetInputMahasiswa(newInputMahasiswa);
            } else {
              console.error(
                "Expected an array but received:",
                objectData.data.anggota,
              );
            }

            // CEK APAKAH PROJECT BISA DIEDIT
            try {
              const applicationsResponse = await axiosJWT.get(
                `${APIEndpoint}/api/masterProject/${idProject}/applicants`,
              );

              if (
                applicationsResponse.data?.data &&
                Array.isArray(applicationsResponse.data.data)
              ) {
                const applications = applicationsResponse.data.data;
                const hasActiveApplications = applications.some(
                  (app: { status?: string }) =>
                    app.status === "Pending" || app.status === "Accepted",
                );

                if (hasActiveApplications) {
                  setCanEdit(false);
                  setEditBlockReason(
                    "Project tidak dapat diedit karena masih ada lamaran dengan status 'Pending' atau 'Accepted'. Tolak semua lamaran terlebih dahulu.",
                  );
                }
              }
            } catch (_err) {
              // Gagal mengecek, tetap izinkan edit
            }
          }
        } catch (err) {
          // Kalau backend sudah memblokir di sini (jarang), tampilkan pesan dan mundur
          const ax = err as AxiosError<unknown>;
          if ((ax as any).response?.status === 409) {
            notifyAndBack(
              getMessageFromError(ax) || "Tidak bisa mengedit project ini.",
            );
          } else {
            console.error("Error fetching data:", err);
          }
        }
      }
    };
    fetchInitialData();
  }, [
    router.isReady,
    axiosJWT,
    idProject,
    id,
    token,
    jenisMagangOptions,
    APIEndpoint,
    notifyAndBack,
  ]);

  useEffect(() => {
    if (token) {
      const fetchData = async () => {
        try {
          const incentiveResponse = await axiosJWT.get(
            `${APIEndpoint}/api/incentive`,
          );
          setMagangOptions(incentiveResponse.data.data);

          const picResponse = await axiosJWT.get(
            `${APIEndpoint}/api/masterUser/showPic`,
          );
          setPIC(picResponse.data.data);

          const mahasiswaResponse = await axiosJWT.get(
            `${APIEndpoint}/api/availableStudent`,
          );
          setMahasiswaOptions(mahasiswaResponse.data.data);
        } catch (error) {
          console.error(error);
        }
      };
      fetchData();
    }
  }, [axiosJWT, APIEndpoint, token]);

  // Fetch department options
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axiosJWT.get(`${APIEndpoint}/api/department`);
        const list = res?.data?.data || [];
        setDepartmentOptions(
          list.map((d: { id: number; department: string }) => ({
            value: d.id,
            label: d.department,
          })),
        );
      } catch {
        setDepartmentOptions([]);
      }
    })();
  }, [axiosJWT, APIEndpoint, token]);

  // Fetch faculty options
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axiosJWT.get(`${APIEndpoint}/api/faculty`);
        const list = res?.data?.data || [];
        setFacultyOptions(
          list.map((f: { id: number; faculty: string }) => ({
            value: f.id,
            label: f.faculty,
          })),
        );
      } catch {
        setFacultyOptions([]);
      }
    })();
  }, [axiosJWT, APIEndpoint, token]);

  // Handlers for department/faculty select
  const handleDepartmentChange = (selected: readonly Option[]) => {
    setSelectedDepartmentIds(selected.map((opt) => opt.value));
  };

  const handleFacultyChange = (selected: readonly Option[]) => {
    setSelectedFacultyIds(selected.map((opt) => opt.value));
  };

  const convertDateFormat = (inputDate: any) => {
    if (!inputDate) return "";
    const [day, month, year] = inputDate.split("/");
    return `${year}-${month}-${day}`;
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === "date" && value.split("-")[0].length > 4) {
      const month = value.split("-").length > 1 ? value.split("-")[1] : "";
      const day = value.split("-").length > 2 ? value.split("-")[2] : "";
      setFormData((prev) => ({
        ...prev,
        [name]: `${new Date().getFullYear()}-${month}-${day}`,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  useEffect(() => {
    if (!formData.id_kategori) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axiosJWT.get(
          `${APIEndpoint}/api/incentive/project/${formData.id_kategori}`,
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
  }, [formData.id_kategori, axiosJWT, APIEndpoint]);

  // Validasi tanggal pendaftaran
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
  }, [formData.pendaftaran_mulai, formData.pendaftaran_selesai, formData]);

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
    formData,
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
  }, [formData.pendaftaran_selesai, formData.tanggal_mulai, formData]);

  const handleChangeForJenis = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    aturUpah(parseInt(String(value)));
    setFormData((prev) => ({ ...prev, [name]: value }));

    // PERBAIKI: gunakan AlterFormsData untuk setiap mahasiswa
    const updated = InputMahasiswa.map((f, _index) => {
      const selectedCategory = jenisMagangOptions.find(
        (o) => o.id === parseInt(String(value)),
      );

      let estimasiInsentif = 0;
      if (selectedCategory) {
        const { besaran_insentif, id_satuan } = selectedCategory;

        if (parseInt(id_satuan) === 1) {
          // Satuan menit: mengikuti rumus myproject/view/[id].tsx
          const sesiMenit = 50;
          const jumlahSesi = (f.durasi * 60) / Math.max(1, sesiMenit);
          estimasiInsentif = Math.round(jumlahSesi * besaran_insentif);
        } else if (parseInt(id_satuan) === 2) {
          // Satuan karya
          estimasiInsentif = f.durasi * besaran_insentif;
        }
      }

      return { ...f, estimasi: estimasiInsentif };
    });
    SetInputMahasiswa(updated);
  };

  const aturUpah = (id: any) => {
    const selected = jenisMagangOptions.find(
      (o) => o.id === parseInt(String(id)),
    );
    if (selected) {
      setSatuanInsentif(selected.id_satuan);
      setUpah(selected.besaran_insentif);
      setBesaranInsentif(Number(selected.besaran_insentif || 0));
      // Set satuan insentif text untuk display
      if (parseInt(selected.id_satuan) === 1) {
        setSatuanInsentif("Menit");
      } else {
        setSatuanInsentif("Karya");
      }
    }
  };

  const AlterFormsData = (formId: number, value: number) => {
    const selectedCategory = jenisMagangOptions.find(
      (o) => o.id === parseInt(String(formData.id_kategori)),
    );

    let estimasiInsentif = 0;
    if (selectedCategory) {
      const { besaran_insentif, id_satuan } = selectedCategory;

      if (parseInt(id_satuan) === 1) {
        const sesiMenit = 50;
        const jumlahSesi = (value * 60) / Math.max(1, sesiMenit);
        estimasiInsentif = Math.round(jumlahSesi * besaran_insentif);
      } else if (parseInt(id_satuan) === 2) {
        estimasiInsentif = value * besaran_insentif;
      }
    }

    const updated = InputMahasiswa.map((form, idx) =>
      idx === formId
        ? { ...form, durasi: value, estimasi: estimasiInsentif }
        : form,
    );
    return updated;
  };

  useEffect(() => {
    const totaling = () => {
      const total = InputMahasiswa.reduce(
        (acc, curr) => acc + curr.estimasi,
        0,
      );
      retotal(total);
    };
    totaling();
  }, [InputMahasiswa, formData.id_kategori]);

  const _handleInputMahasiswaDurasi = (formId: number, value: any) => {
    const v = Math.max(0, parseInt(String(value) || "0"));
    const updated = AlterFormsData(formId, v);
    SetInputMahasiswa(updated);
  };

  // const _namaPICOptions = PIC.map((p) => ({ value: p.id, label: p.nama }));

  const _namaMahasiswaOptions = _Mahasiswa
    .filter(
      (m: { id: number | string; nama: string; sisa_sesi: number | string }) =>
        !InputMahasiswa.some((f) => {
          const ma = f.mahasiswa;
          return typeof ma === "object"
            ? ma.value === m.id
            : String(ma) === String(m.id);
        }),
    )
    .map(
      (m: {
        id: number | string;
        nama: string;
        sisa_sesi: number | string;
      }) => ({
        value: m.id,
        label: `${m.id}  ${m.nama} (${m.sisa_sesi} Jam)`,
        recap: `[${m.id}] ${m.nama}`,
      }),
    );

  // const _tambahMahasiswa = () => {
  //   const newForm = {
  //     id: InputMahasiswa.length + 1,
  //     mahasiswa: "",
  //     durasi: 0,
  //     insentif: 0,
  //     trueID: 0,
  //     estimasi: 0,
  //     id_status: 2,
  //     id_tran_project: null,
  //   };
  //   SetInputMahasiswa([...InputMahasiswa, newForm]);
  // };

  // const deleteMahasiswa = async (Removal: number) => {
  //   const deletedData = InputMahasiswa.filter((_, idx) => idx === Removal);
  //   const idTranProject = deletedData[0].id_tran_project;
  //   setDeletedIds((prev) => [...prev, idTranProject]);

  //   if (idTranProject) {
  //     try {
  //       await axiosJWT.delete(`${APIEndpoint}/api/project/${idTranProject}`);
  //     } catch (err) {
  //       const ax = err as AxiosError<any>;
  //       if (ax.response?.status === 409) {
  //         notifyAndBack(
  //           ax.response.data?.message ||
  //           "Tidak bisa menghapus mahasiswa pada project ini.",
  //         );
  //         return;
  //       } else {
  //         toast.error(
  //           ax.response?.data?.message || "Gagal menghapus data mahasiswa.",
  //         );
  //         return;
  //       }
  //     }
  //   }

  //   const updated = InputMahasiswa.filter((_, idx) => idx !== Removal);
  //   SetInputMahasiswa(updated);
  // };

  const _handleOptionChange = (index: number, selectedOption: any) => {
    const updateMahasiswa = [...InputMahasiswa];
    updateMahasiswa[index] = {
      ...InputMahasiswa[index],
      mahasiswa: selectedOption,
    };
    SetInputMahasiswa(updateMahasiswa);
  };

  // const _handleOptionChangePIC = (selectedOption: any) => {
  //   setFormData((prev) => ({ ...prev, pic: selectedOption }));
  // };

  const minTanggalSelesai = formData.tanggal_mulai || undefined;
  const minKegiatanMulaiDariReg = formData.pendaftaran_selesai
    ? dayAfter(formData.pendaftaran_selesai)
    : undefined;
  const maxPendaftaranDariKeg = dayBefore(formData.tanggal_mulai);

  // Allow crossing year: do not artificially cap tanggal_selesai to the start-year end.
  // Keep undefined so the user can pick any future date (still validated on submit).
  const maxTanggalSelesai = undefined;

  const handleSubmit = async (e: FormEvent, idStatus: number) => {
    e.preventDefault();

    if (
      !formData.id_kategori ||
      !formData.nama_magang ||
      !formData.pic ||
      !formData.tanggal_mulai ||
      !formData.tanggal_selesai
    ) {
      toast.error("Semua kolom harus diisi!");
      return;
    }

    if (!formData.pendaftaran_mulai || !formData.pendaftaran_selesai) {
      toast.error("Waktu pendaftaran wajib lengkap.");
      return;
    }

    if (!(formData.pendaftaran_selesai < formData.tanggal_mulai)) {
      toast.error("Pendaftaran harus ditutup sebelum proyek dimulai.");
      return;
    }

    if (new Date(formData.tanggal_mulai) > new Date(formData.tanggal_selesai)) {
      toast.error(
        "Tanggal mulai dan tanggal selesai yang ditambahkan tidak valid!",
      );
      return;
    }

    if (!durasiValid || durasiValid <= 0) {
      toast.error(
        isKarya
          ? "Jumlah karya wajib diisi"
          : "Durasi (jam) per mahasiswa wajib diisi",
      );
      return;
    }

    if (!id) {
      toast.error("User ID tidak ditemukan!");
      return;
    }

    try {
      const response1 = await axiosJWT.put(
        `${APIEndpoint}/api/masterProject/${idProject}`,
        {
          id_kategori: formData.id_kategori,
          nama: formData.nama_magang,
          pic:
            typeof formData.pic === "object"
              ? formData.pic.value
              : formData.pic,
          tanggal_mulai: formData.tanggal_mulai,
          tanggal_selesai: formData.tanggal_selesai,
          kriteria: formData.kriteria,
          kuota: formData.kuota,
          pendaftaran_mulai: formData.pendaftaran_mulai,
          pendaftaran_selesai: formData.pendaftaran_selesai,
          created_by: id as string,
          id_status: idStatus,
          durasi_per_mahasiswa: durasiValid,
          // Send based on targetType - always send the array so backend clears the other type
          department_ids: targetType === "prodi" ? selectedDepartmentIds : [],
          faculty_ids: targetType === "fakultas" ? selectedFacultyIds : [],
        },
      );

      if (response1.status !== 200) {
        toast.error(
          response1.data?.message || "Gagal menyimpan master project",
        );
        return;
      }

      // create yang baru
      const mahasiswaDataToCreate = InputMahasiswa.slice(existingDataCount).map(
        (form) => ({
          id_project: idProject,
          id_peserta:
            typeof form.mahasiswa === "object"
              ? form.mahasiswa.value
              : form.mahasiswa,
          estimasi: form.estimasi,
          durasi: form.durasi,
          id_status: idStatus,
        }),
      );

      // create baru + history
      if (mahasiswaDataToCreate.length > 0) {
        const response3 = await axiosJWT.post(
          `${APIEndpoint}/api/project`,
          mahasiswaDataToCreate,
        );
        if (response3.status !== 200) {
          toast.error(
            response3.data?.message || "Gagal menambahkan anggota baru",
          );
          return;
        }
        for (const data of response3.data.data) {
          await axiosJWT.post(`${APIEndpoint}/api/projectHistory`, {
            id_project: Number(data),
            id_status: Number(idStatus),
            changed_at: new Date().toISOString(),
          });
        }
      }

      toast.success("Data berhasil disimpan.");
      router.push("/user/myproject");
    } catch (err) {
      const ax = err as AxiosError<unknown>;
      // TANGKAP BLOKIR dari backend
      if (ax.response?.status === 409) {
        notifyAndBack(
          getMessageFromError(ax) ||
            "Aksi diblokir. Tolak semua lamaran & kosongkan anggota terlebih dahulu.",
        );
        return;
      }
      toast.error(
        getMessageFromError(ax) || "Terjadi kesalahan saat menyimpan.",
      );
      console.error("Error submitting data:", err);
    }
  };

  if (!router.isReady) return <div>Loading...</div>;

  // Build breadcrumb labels - map ID to project name
  const breadcrumbLabels: Record<string, string> = {};
  if (idProject && formData.nama_magang) {
    breadcrumbLabels[idProject] = formData.nama_magang;
  }

  return (
    <Layout title="Edit Project" breadcrumbLabels={breadcrumbLabels}>
      <div className="mx-auto max-w-3xl p-4">
        {/* PERINGATAN JIKA TIDAK BISA EDIT */}
        {!canEdit && (
          <div className="alert alert-warning mb-4">
            <div className="flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="w-6 h-6 mx-2 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                ></path>
              </svg>
              <label>{editBlockReason}</label>
            </div>
          </div>
        )}

        <form ref={myFormRef} className="space-y-5">
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Jenis Magang:</label>
            <select
              className="select select-bordered w-3/5 rounded-lg h-12"
              name="id_kategori"
              value={formData.id_kategori}
              onChange={handleChangeForJenis}
              disabled={!canEdit}
            >
              <option value="">Select Jenis Magang</option>
              {jenisMagangOptions.map((jenisMagang) => (
                <option key={jenisMagang.id} value={jenisMagang.id}>
                  {jenisMagang.kategori}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Nama Magang:</label>
            <input
              className="input input-bordered w-3/5"
              type="text"
              placeholder="Nama Magang"
              name="nama_magang"
              value={formData.nama_magang}
              onChange={handleChange}
              disabled={!canEdit}
            />
          </div>

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Nama Penanggung Jawab:</label>
            <input
              className="input input-bordered w-3/5"
              value={
                formData.pic && typeof formData.pic === "object"
                  ? formData.pic.label
                  : String(formData.pic || "")
              }
              disabled
              placeholder="PIC tidak dapat diubah"
            />
          </div>

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Deskripsi:</label>
            <textarea
              className="textarea textarea-bordered w-3/5"
              name="kriteria"
              placeholder="Rincian lowongan"
              value={formData.kriteria}
              onChange={handleChange}
              disabled={!canEdit}
            />
          </div>

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Kuota:</label>
            <input
              className="input input-bordered w-3/5"
              type="number"
              name="kuota"
              min={1}
              placeholder="Jumlah kuota"
              value={formData.kuota}
              onChange={handleChange}
              disabled={!canEdit}
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
                  checked={targetType === "prodi"}
                  onChange={() => {
                    setTargetType("prodi");
                    setSelectedFacultyIds([]);
                  }}
                  className="radio radio-primary"
                  disabled={!canEdit}
                />
                <span>Prodi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value="fakultas"
                  checked={targetType === "fakultas"}
                  onChange={() => {
                    setTargetType("fakultas");
                    setSelectedDepartmentIds([]);
                  }}
                  className="radio radio-primary"
                  disabled={!canEdit}
                />
                <span>Fakultas</span>
              </label>
            </div>
          </div>

          {/* Target Prodi */}
          {targetType === "prodi" && (
            <div className="flex justify-between items-start">
              <label className="font-bold w-2/5 pt-3">Target Prodi:</label>
              <div className="w-3/5">
                <Select
                  isMulti
                  options={departmentOptions}
                  value={departmentOptions.filter((opt) =>
                    selectedDepartmentIds.includes(opt.value),
                  )}
                  onChange={handleDepartmentChange}
                  placeholder=""
                  isClearable
                  isSearchable
                  isDisabled={!canEdit}
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
          {targetType === "fakultas" && (
            <div className="flex justify-between items-start">
              <label className="font-bold w-2/5 pt-3">Target Fakultas:</label>
              <div className="w-3/5">
                <Select
                  isMulti
                  options={facultyOptions}
                  value={facultyOptions.filter((opt) =>
                    selectedFacultyIds.includes(opt.value),
                  )}
                  onChange={handleFacultyChange}
                  placeholder=""
                  isClearable
                  isSearchable
                  isDisabled={!canEdit}
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

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Waktu Pendaftaran:</label>
            <div className="w-3/5 flex items-center gap-2">
              <DateInput
                name="pendaftaran_mulai"
                value={formData.pendaftaran_mulai}
                onChange={handleChange}
                max={maxPendaftaranDariKeg}
                disabled={!canEdit}
              />
              <span className="opacity-70">s.d.</span>
              <DateInput
                name="pendaftaran_selesai"
                value={formData.pendaftaran_selesai}
                onChange={handleChange}
                min={formData.pendaftaran_mulai || undefined}
                max={maxPendaftaranDariKeg}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">Waktu Kegiatan:</label>
            <div className="w-3/5 flex items-center gap-2">
              <DateInput
                name="tanggal_mulai"
                value={formData.tanggal_mulai}
                onChange={handleChange}
                min={minKegiatanMulaiDariReg}
                title={
                  minKegiatanMulaiDariReg
                    ? `≥ ${minKegiatanMulaiDariReg}`
                    : undefined
                }
                disabled={!canEdit}
              />
              <span className="opacity-70">s.d.</span>
              <DateInput
                name="tanggal_selesai"
                value={formData.tanggal_selesai}
                onChange={handleChange}
                min={minTanggalSelesai}
                max={maxTanggalSelesai}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Durasi atau Karya */}
          <div className="flex justify-between items-center">
            <label className="font-bold w-2/5">
              {isKarya ? "Karya:" : "Durasi:"}
            </label>
            <div className="w-3/5 flex items-center gap-2">
              <input
                className="input input-bordered flex-1"
                type="number"
                min={1}
                placeholder={isKarya ? "Jumlah karya" : "Jam"}
                value={durasiInput}
                onChange={(e) => setDurasiInput(e.target.value)}
                disabled={!canEdit}
              />
              <span className="text-sm opacity-70">
                {isKarya ? "karya" : "Jam"}
              </span>
            </div>
          </div>

          {/* Info sesi */}
          {!isKarya && (
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

          <hr className="w-full h-px my-10 bg-gray-200 border-0 dark:bg-gray-700" />

          <div className="flex justify-between pt-4">
            <Link
              href="/user/myproject"
              className="btn bg-primary flex items-center justify-center"
            >
              Kembali
            </Link>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-ghost border"
                onClick={(e) => handleSubmit(e, 1)}
                disabled={!canEdit}
              >
                Simpan Draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => handleSubmit(e, 2)}
                disabled={!canEdit}
              >
                Buka Lowongan
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps =
  getServerSidePropsWithRole;
export default withPage(EditProject);
