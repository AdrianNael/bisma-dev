import React, { ChangeEvent, FormEvent } from "react";
import { FaSearch } from "react-icons/fa";

type FormData = {
  keyword: string;
  periode: string;
  prodi: string;
};

type Props = {
  formData: FormData;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent) => void;
};

const Search = ({ formData, handleChange, handleSubmit }: Props) => {
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6 mt-4 w-full"
    >
      <div className="flex flex-col md:flex-row justify-center items-center gap-4 -mb-4 w-full md:w-auto">
        <div className="form-control w-full md:w-64">
          <input
            type="month"
            name="periode"
            id="periode"
            className="input input-bordered w-full text-center rounded-lg shadow-md"
            value={formData.periode}
            onChange={handleChange}
          />
        </div>

        <div className="form-control w-full md:w-64">
          <select
            name="prodi"
            id="prodi"
            className="select select-bordered text-center pl-0 pr-0 rounded-lg shadow-md w-full"
            value={formData.prodi}
            onChange={handleChange}
          >
            <option value="">-- Pilih Program Studi --</option>
            <option value="Teknik Perminyakan">Teknik Perminyakan</option>
            <option value="Teknik Geofisika">Teknik Geofisika</option>
            <option value="Teknik Geologi">Teknik Geologi</option>
            <option value="Teknik Mesin">Teknik Mesin</option>
            <option value="Teknik Elektro">Teknik Elektro</option>
            <option value="Teknik Kimia">Teknik Kimia</option>
            <option value="Teknik Logistik">Teknik Logistik</option>
            <option value="Teknik Sipil">Teknik Sipil</option>
            <option value="Teknik Lingkungan">Teknik Lingkungan</option>
            <option value="Ilmu Komputer">Ilmu Komputer</option>
            <option value="Manajemen">Manajemen</option>
            <option value="Ekonomi">Ekonomi</option>
            <option value="Komunikasi">Komunikasi</option>
            <option value="Hubungan Internasional">
              Hubungan Internasional
            </option>
            <option value="Kimia">Kimia</option>
          </select>
        </div>

        <div className="form-control w-full md:w-64">
          <input
            type="text"
            name="keyword"
            id="keyword"
            placeholder="Cari Nama / Nomor Induk..."
            className="input input-bordered w-full text-center rounded-lg shadow-md"
            value={formData.keyword}
            onChange={handleChange}
          />
        </div>

        <button
          type="submit"
          className="btn btn-ghost bg-white shadow-md border rounded-xl min-w-[3rem]"
        >
          <FaSearch className="text-xl" />
        </button>
      </div>
    </form>
  );
};

export default Search;
