import { AiOutlineClose } from "react-icons/ai";
import { useState, useEffect } from "react";
import { jam } from "@/src/components/Timesheet/Jam";
import _useTimesheet from "@/src/hooks/useTimesheet";

type Props = {
  durasi: number;
  besarInsentif: number;
  tanggal: string;
  handleDeleteComponent: (index: number) => void;
  index: number;
  Kategori: any;
};

function AddComponent({
  durasi,
  besarInsentif: _besarInsentif,
  tanggal,
  handleDeleteComponent,
  index,
  Kategori: _Kategori,
}: Props) {
  const [idKategori, setIdKategori] = useState<number>(0);
  const [deskripsi, setDeskripsi] = useState("");
  const [jamAwal, setJamAwal] = useState("");
  const [jamAkhir, setJamAkhir] = useState("");
  const [sesi, setSesi] = useState(0);

  useEffect(() => {
    let sesi;
    if (jamAwal === "-1" || jamAkhir === "-1") {
      sesi = 0;
    } else if (jamAwal && jamAkhir) {
      if (jamAwal === jamAkhir) {
        sesi = 24;
      } else {
        sesi = (parseFloat(jamAkhir) - parseFloat(jamAwal)) % 24;
        if (sesi < 0) sesi = sesi + 24;
      }
    }
    if (sesi) {
      sesi = (sesi * 60) / durasi;
      setSesi(sesi);
    }
  }, [jamAwal, jamAkhir, durasi]);

  function formatDate(dateString: string): string {
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    return new Date(dateString).toLocaleDateString("id-ID", options);
  }
  // handleChange is unused here; remove destructuring to avoid unused variable

  useEffect(() => {
    // handleChange()
  }, [idKategori, deskripsi, sesi]);
  return (
    <tr>
      <td>
        <div className="mb-4 flex">
          <div className="w-56 flex">
            <label className="font-semibold mr-2">{formatDate(tanggal)}</label>
            <a
              onClick={() => handleDeleteComponent(index)}
              className="btn btn-ghost btn-xs"
            >
              <div
                className="tooltip tooltip-top text-xs normal-case"
                data-tip="Delete"
              >
                <AiOutlineClose className="text-2xl text-red-600" />
              </div>
            </a>{" "}
          </div>
          <select
            name="kategori"
            id="kategori"
            value={idKategori}
            onChange={(e) => setIdKategori(Number(e.target.value))}
            className="select select-bordered w-full max-w-xs py-1"
          >
            <option disabled value="NULL">
              -- Kategori Kegiatan --
            </option>
            <option value="Pelaksanaan">Pelaksanaan</option>
            <option value="Evaluasi">Evaluasi</option>
          </select>
        </div>
        <div>
          <textarea
            required
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            className="form-textarea rounded ml-56 w-96"
          ></textarea>
        </div>
        <div className="flex-1 ml-56 min-h-full align-middle">
          <select
            name="waktuMulai"
            id="waktuMulai"
            required
            className="select select-bordered py-1"
            value={jamAwal}
            onChange={(e) => setJamAwal(e.target.value)}
          >
            <option value="-1">-- Jam --</option>
            {jam.map((value: any) => {
              return (
                <option key={value.id} value={value.id}>
                  {value.label}
                </option>
              );
            })}
          </select>
          <span className="m-5 text-gray-500">s.d</span>
          <select
            name="waktuAkhir"
            id="waktuAkhir"
            required
            className="select select-bordered py-1"
            value={jamAkhir}
            onChange={(e) => {
              setJamAkhir(e.target.value);
            }}
          >
            <option value="-1">-- Jam --</option>
            {jam.map((value: any) => {
              return (
                <option key={value.id} value={value.id}>
                  {value.label}
                </option>
              );
            })}
          </select>
          <span className="m-5">=</span>
          <span className="text-3xl font-semibold">{sesi} sesi</span>
        </div>
      </td>
    </tr>
  );
}

export default AddComponent;
