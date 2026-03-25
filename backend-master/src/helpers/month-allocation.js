export const MONTHLY_CAP = 40;

export function monthKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function listMonthKeysBetween(start, end) {
  const s = new Date(start);
  s.setDate(1);
  const e = new Date(end);
  e.setDate(1);
  const keys = [];
  for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
    keys.push(monthKey(d));
  }
  return keys.length ? keys : [monthKey(start)];
}

export function splitEqually(total, parts) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const n = Math.max(1, Number(parts) || 1);
  const base = Math.floor(t / n);
  let rem = t % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function addToMap(map, key, val) {
  map[key] = (map[key] || 0) + (Number(val) || 0);
  return map;
}
