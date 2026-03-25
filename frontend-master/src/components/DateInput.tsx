import React, { useState, useEffect, useRef, ChangeEvent } from "react";

/**
 * DateInput – custom date field that always displays dd/mm/yyyy.
 *
 * - `value` and `min`/`max` are ISO strings (YYYY-MM-DD) or empty string.
 * - `onChange` receives a synthetic event whose target has the same
 *   shape as a native <input type="date"> element (name + ISO value).
 */
interface DateInputProps {
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const DateInput: React.FC<DateInputProps> = ({
  name,
  value,
  onChange,
  min,
  max,
  disabled = false,
  title,
  className = "input input-bordered w-full",
}) => {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Sync internal state when the ISO value prop changes.
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      setYear(y);
      setMonth(m);
      setDay(d);
    } else if (!value) {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [value]);

  /** Fire synthetic onChange with an ISO value when all three parts are valid. */
  const fireChange = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const dt = new Date(iso);
      // Check the date is real (e.g. not Feb 31)
      if (
        isNaN(dt.getTime()) ||
        dt.getFullYear() !== Number(y) ||
        dt.getMonth() + 1 !== Number(m) ||
        dt.getDate() !== Number(d)
      ) {
        return; // invalid date, don't fire
      }
      const syntheticEvent = {
        target: { name, value: iso } as HTMLInputElement,
        currentTarget: { name, value: iso } as HTMLInputElement,
        nativeEvent: new Event("change"),
        bubbles: true,
        cancelable: false,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: false,
        preventDefault: () => {},
        isDefaultPrevented: () => false,
        stopPropagation: () => {},
        isPropagationStopped: () => false,
        persist: () => {},
        timeStamp: Date.now(),
        type: "change",
      } as unknown as ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  /** Clear form value when one segment becomes empty. */
  const fireClear = () => {
    const syntheticEvent = {
      target: { name, value: "" } as HTMLInputElement,
      currentTarget: { name, value: "" } as HTMLInputElement,
      nativeEvent: new Event("change"),
      bubbles: true,
      cancelable: false,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      preventDefault: () => {},
      isDefaultPrevented: () => false,
      stopPropagation: () => {},
      isPropagationStopped: () => false,
      persist: () => {},
      timeStamp: Date.now(),
      type: "change",
    } as unknown as ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  const handleDayChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setDay(raw);
    if (raw === "") {
      fireClear();
      return;
    }
    if (raw.length === 2) {
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    fireChange(raw, month, year);
  };

  const handleMonthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMonth(raw);
    if (raw === "") {
      fireClear();
      return;
    }
    if (raw.length === 2) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
    fireChange(day, raw, year);
  };

  const handleYearChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYear(raw);
    if (raw === "") {
      fireClear();
      return;
    }
    fireChange(day, month, raw);
  };

  // Clamp display to 2-digit day/month entry; validate min/max for visual feedback
  const outOfRange = (() => {
    if (!value) return false;
    if (min && value < min) return true;
    if (max && value > max) return true;
    return false;
  })();

  const inputBase =
    "bg-transparent outline-none text-center tabular-nums leading-none";

  return (
    <div
      className={`${className} flex items-center px-2 gap-0.5 ${outOfRange ? "border-red-400 focus-within:border-red-500" : "focus-within:border-primary"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      title={title}
    >
      {/* Day */}
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd"
        value={day}
        onChange={handleDayChange}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        maxLength={2}
        className={`${inputBase} w-6`}
        aria-label="Hari"
      />
      <span className="opacity-50 select-none">/</span>
      {/* Month */}
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="mm"
        value={month}
        onChange={handleMonthChange}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        maxLength={2}
        className={`${inputBase} w-6`}
        aria-label="Bulan"
      />
      <span className="opacity-50 select-none">/</span>
      {/* Year */}
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="yyyy"
        value={year}
        onChange={handleYearChange}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        maxLength={4}
        className={`${inputBase} w-10`}
        aria-label="Tahun"
      />
    </div>
  );
};

export default DateInput;
