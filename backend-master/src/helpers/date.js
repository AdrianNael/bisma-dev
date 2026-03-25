export function getMonthKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  export function isWeekday(d) {
    const wd = d.getDay();
    return wd >= 1 && wd <= 5;
  }
  