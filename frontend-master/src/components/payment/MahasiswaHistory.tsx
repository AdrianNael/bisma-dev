import React, {
  useState,
  useEffect as _useEffect,
  ChangeEvent,
  FormEvent,
} from "react";
import { format as _format } from "date-fns";

// import DatePicker from 'react-datepicker';

const MahasiswaHistory = () => {
  type Form = {
    id: number;
    id_kategori: number;
    nama_magang: string;
    pic: number;
    tanggal: string;
    [key: string]: string | number | [];
  };

  const [formData, setFormData] = useState<Form>({
    id: 2,
    id_kategori: 0,
    nama_magang: "",
    pic: 0,
    tanggal: "",
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    if (formData[name] === value) {
      return;
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleTambahTanggal = async (e: FormEvent) => {
    e.preventDefault();
  };

  // const [selectingDate, newSelectingDate] = useState(new Date());
  const [_selectingDate, _newSelectingDate] = useState("");

  return (
    <div className="flex-col ml-40">
      <div className="mb-5">
        <button
          onClick={handleTambahTanggal}
          className=" rounded-lg p-4 bg-[#252B42] text-white"
        >
          tambah tanggal
        </button>
      </div>

      <div>
        {/* <DatePicker selected={selectingDate} dateFormat="dd/MM/yyyy" onChange={(date: any) => newSelectingDate(date)} className="appearance-none text-gray-darker" /> */}
        <input
          type="date"
          name="tanggal"
          value={formData.tanggal}
          onChange={handleChange}
          className="appearance-none text-gray-darker"
        />
      </div>
      <div>
        <button
          onClick={handleTambahTanggal}
          className="rounded-lg bg-[#252B42] text-white"
        >
          Simpan
        </button>
      </div>
    </div>
  );
};
export default MahasiswaHistory;
