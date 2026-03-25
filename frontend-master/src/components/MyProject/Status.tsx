import React from "react";

type Props = {};

const status = [
  { id: 1, name: "Submit Project", value: 100, tanggal: "13 September 2023" },
  { id: 2, name: "Project Approve", value: 100, tanggal: "13 September 2023" },
  { id: 3, name: "Submit Payment", value: 100, tanggal: "13 September 2023" },
  { id: 4, name: "Process Payment", value: 30, tanggal: "13 September 2023" },
  { id: 5, name: "Paid", value: 0, tanggal: "-" },
];

const Status = (_props: Props) => {
  return (
    <div className="flex flex-col bg-white rounded-xl p-2 mt-4 drop-shadow-xl">
      <h1 className="text-xl font-semibold text-center">Status</h1>
      <hr />
      <div className="flex w-full items-center justify-center gap-2 h-32">
        {status.map((v, i) => {
          const name = v.name.replace(/\s/g, "");
          return (
            <div key={i} className="flex flex-col gap-2 m-2 text-center">
              <label
                className="text-xs normal-case font-light flex flex-col items-center justify-center gap-1"
                htmlFor={name}
              >
                <span className="text-sm font-normal">{v.name}</span>
                {/* <div className="border-green-400 border-4 rounded-full w-10 h-10 flex justify-center items-center">
                  {i + 1}
                </div> */}
              </label>
              <progress
                id={name}
                className="progress progress-success w-36"
                value={v.value}
                max="100"
              ></progress>
              <span className="text-xs text-gray-400">{v.tanggal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Status;
