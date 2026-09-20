"use client";

export interface TipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; swatch?: string }[];
}

/** Shared hover card. Positioned against the chart's own relative container. */
export function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-card px-3 py-2 shadow-[0_8px_24px_-12px_rgba(26,24,21,0.35)]"
      style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
      role="status"
    >
      <p className="mb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{tip.title}</p>
      <dl className="space-y-0.5">
        {tip.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">
            {row.swatch ? (
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: row.swatch }} aria-hidden />
            ) : (
              <span className="h-2 w-2 shrink-0" aria-hidden />
            )}
            <dt className="text-ink-2">{row.label}</dt>
            <dd className="ml-auto tnum font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{subtitle}</p> : null}
        </div>
        {legend ? <Legend items={legend} /> : null}
      </header>
      <div className="relative">{children}</div>
      {footer ? <div className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-2">{footer}</div> : null}
    </section>
  );
}
