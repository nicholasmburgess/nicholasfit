export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "";
  const min = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function formatKg(n: number): string {
  return `${Math.round(n).toLocaleString("en-AU")} kg`;
}

/** Monday 00:00 of the current week, local time. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
