import Link from "next/link";
import { useState, useEffect, ChangeEvent } from "react";

const Recap = (_id_pengguna: any) => {
  const [_RekapSheet, _setRekapSheet] = useState("");
  const [_opsi, _setOpsi] = useState("");
  const [bulan, setBulan] = useState(0);
  const [Pdf, setPdf] = useState("");
  // const fetching = () => {
  //     fetch(`http://localhost:8000/api/generatePdfTimesheet?id_pengguna=${id_pengguna}&bulan=${bulan}&opsi=${opsi}`).then((data) => {
  //         return data.json();
  //     }).then((objectData) => {
  //         // console.log(objectData.data);
  //         setRekapSheet(objectData.data);
  //     })
  // }

  const handleChangeState = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    // console.log(e.target)
    const { name: _name, value } = e.target;
    //  console.log(name)
    // console.log(value)
    if (bulan === parseInt(value)) {
      return;
    }

    setBulan(parseInt(value));
  };

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_ENDPOINT}/api/generatePdfRecap?project=Asisten Praktikum Algoritma dan Struktur Data&bulan=8&opsi=lihat`,
    )
      .then((data) => {
        return data.text();
      })
      .then((objectData) => {
        // console.log(objectData);
        setPdf(objectData);
      });
  }, []);

  return (
    <div className="w-full">
      <div className="pl-40" id="periode-container">
        <label htmlFor="periode" className="font-bold mx-4">
          Periode
        </label>
        <select name="periode" value={bulan} onChange={handleChangeState}>
          <option value={1}>Januari</option>
          <option value={2}>Februari</option>
          <option value={3}>Maret</option>
          <option value={4}>April</option>
          <option value={5}>Mei</option>
          <option value={6}>Juni</option>
          <option value={7}>Juli</option>
          <option value={8}>Agustus</option>
          <option value={9}>September</option>
          <option value={10}>Oktober</option>
          <option value={11}>November</option>
          <option value={12}>Desember</option>
        </select>

        <div id="recap-pic-container" className="items-center mt-4 w-full ">
          <iframe
            className="mx-auto items-center"
            id="PdfTimesheet"
            src={Pdf}
          ></iframe>
        </div>
      </div>

      <div>
        <div className="w-full ml-80 justify-end items-end px-4 pl-20 pt-4">
          <button type="submit" className="w-1/3 btn bg-grey-900 mb-20">
            unduh
          </button>
          <div className="flex">
            <Link
              href={"/submitpayment/checkout2/[id]"}
              className="flex w-1/3 btn btn-primary"
            >
              <button type="submit" className="">
                SELANJUTNYA
              </button>
            </Link>
          </div>
        </div>
        <Link href={".."} className="flex w-1/3 btn mr-20 mb-10 btn-warning">
          Kembali
        </Link>
      </div>
    </div>
  );
};

export default Recap;
