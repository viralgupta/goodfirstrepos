const round1 = (n: number) => Math.round(n * 10) / 10;

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h)} h`;
  const days = h / 24;
  if (days < 60) return `${Math.round(days)} days`;
  return `${round1(days / 30.44)} months`;
}

export function formatDays(d: number): string {
  if (d < 1) return "same day";
  if (d < 45) return `${Math.round(d)} days`;
  if (d < 365) return `${round1(d / 30.44)} months`;
  return `${round1(d / 365.25)} years`;
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${round1(n / 1_000_000)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${round1(n / 1000)}k`;
  return n.toLocaleString("en-US");
}

export function formatPercent(v: number | null, digits = 0): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const diff = Date.now() - Date.parse(iso);
  const days = diff / 86_400_000;
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 45) return `${Math.round(days)} days ago`;
  if (days < 365) return `${Math.round(days / 30.44)} months ago`;
  return `${round1(days / 365.25)} years ago`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}
