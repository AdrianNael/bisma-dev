import _Timesheet from "@/src/pages/mahasiswa/timesheet";
import { createGlobalState } from "react-hooks-global-state";

interface TimesheetProps {
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  deskripsi: string;
  total_sesi: number;
}

const initialState: {
  timesheets: TimesheetProps[];
} = {
  timesheets: [],
};
const { useGlobalState } = createGlobalState(initialState);

export default function useTimesheet() {
  const [timesheets, setTimesheets] = useGlobalState("timesheets");
  const [_componentInstances, _setComponentInstances] =
    useGlobalState("timesheets");

  const handleChange = (detail: TimesheetProps) => {
    const items = [...timesheets];

    const existingItem = items.find((item) => item.tanggal === detail.tanggal);
    if (existingItem) {
      existingItem.jam_mulai = detail.jam_mulai;
      existingItem.jam_selesai = detail.jam_selesai;
      existingItem.deskripsi = detail.deskripsi;
      existingItem.total_sesi = detail.total_sesi;
      setTimesheets(items);
    }
  };

  const _handleAddData = (detail: TimesheetProps) => {
    const items = [...timesheets];
    const existingItem = items.find((item) => item.tanggal === detail.tanggal);
    if (existingItem) {
      setTimesheets(items);
    }
  };

  return {
    setTimesheets,
    handleChange,
    timesheets: timesheets || [],
  };
}
