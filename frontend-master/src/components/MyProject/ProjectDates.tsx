import React, { useEffect } from "react";

export type ProjectDates = {
  tanggal_mulai: string;
  tanggal_selesai: string;
  pendaftaran_mulai: string;
  pendaftaran_selesai: string;
};

function fmt(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parse(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export default function ProjectDates({
  value,
  onChange,
  className,
  required = true,
  strictPendaftaranBeforeMulai = true,
}: {
  value: ProjectDates;
  onChange: (patch: Partial<ProjectDates>) => void;
  className?: string;
  required?: boolean;
  strictPendaftaranBeforeMulai?: boolean;
}) {
  const mulai = parse(value.tanggal_mulai);
  const selesai = parse(value.tanggal_selesai);
  const daftarMulai = parse(value.pendaftaran_mulai);
  const daftarSelesai = parse(value.pendaftaran_selesai);

  const minSelesai = value.tanggal_mulai || undefined;
  const dayBeforeMulai = (() => {
    if (!mulai) return undefined;
    const d = new Date(mulai);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  })();

  const maxPendaftaran = strictPendaftaranBeforeMulai
    ? dayBeforeMulai
    : value.tanggal_mulai || undefined;

  useEffect(() => {
    if (mulai && selesai && selesai.getTime() < mulai.getTime()) {
      onChange({ tanggal_selesai: value.tanggal_mulai });
    }
    if (mulai && (daftarMulai || daftarSelesai)) {
      const maxStr = maxPendaftaran;
      if (maxStr) {
        const max = parse(maxStr)!;
        if (daftarMulai && daftarMulai.getTime() > max.getTime()) {
          onChange({ pendaftaran_mulai: maxStr });
        }
        if (daftarSelesai && daftarSelesai.getTime() > max.getTime()) {
          onChange({ pendaftaran_selesai: maxStr });
        }
      }
    }
    if (
      daftarMulai &&
      daftarSelesai &&
      daftarSelesai.getTime() < daftarMulai.getTime()
    ) {
      onChange({ pendaftaran_selesai: value.pendaftaran_mulai });
    }
    // include all derived values and callbacks that affect the effect
  }, [
    value.tanggal_mulai,
    value.pendaftaran_mulai,
    value.pendaftaran_selesai,
    strictPendaftaranBeforeMulai,
    onChange,
    // derived values are derived from the above, but include them for clarity
    mulai,
    selesai,
    daftarMulai,
    daftarSelesai,
    maxPendaftaran,
  ]);

  return (
    <div className={className ?? "space-y-4"}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex justify-between items-center">
          <label className="flex items-center capitalize font-bold w-2/5">
            Tanggal mulai:
          </label>
          <input
            name="tanggal_mulai"
            type="date"
            className="input input-bordered w-3/5"
            required={required}
            value={value.tanggal_mulai}
            onChange={(e) => onChange({ tanggal_mulai: e.target.value })}
          />
        </div>
        <div className="flex justify-between items-center">
          <label className="flex items-center capitalize font-bold w-2/5">
            Tanggal selesai:
          </label>
          <input
            name="tanggal_selesai"
            type="date"
            className="input input-bordered w-3/5"
            required={required}
            min={minSelesai}
            value={value.tanggal_selesai}
            onChange={(e) => onChange({ tanggal_selesai: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex justify-between items-center">
          <label className="flex items-center capitalize font-bold w-2/5">
            Pendaftaran mulai:
          </label>
          <input
            name="pendaftaran_mulai"
            type="date"
            className="input input-bordered w-3/5"
            required={required}
            max={maxPendaftaran}
            value={value.pendaftaran_mulai}
            onChange={(e) => onChange({ pendaftaran_mulai: e.target.value })}
          />
        </div>
        <div className="flex justify-between items-center">
          <label className="flex items-center capitalize font-bold w-2/5">
            Pendaftaran selesai:
          </label>
          <input
            name="pendaftaran_selesai"
            type="date"
            className="input input-bordered w-3/5"
            required={required}
            min={value.pendaftaran_mulai || undefined}
            max={maxPendaftaran}
            value={value.pendaftaran_selesai}
            onChange={(e) => onChange({ pendaftaran_selesai: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
