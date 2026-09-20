import { formatDays, formatHours, formatRelative } from "@/lib/format";
import type { PullSummary } from "@/lib/types";

function Row({ pr, right }: { pr: PullSummary; right: string }) {
  return (
    <li className="group border-t border-line first:border-t-0">
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-baseline gap-3 py-2.5 transition-colors hover:bg-clay-wash/60"
      >
        <span className="tnum shrink-0 font-mono text-[12px] text-ink-3">#{pr.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] text-ink group-hover:text-clay-ink">{pr.title}</span>
          <span className="block truncate text-[12px] text-ink-3">
            {pr.author ?? "unknown"}
            {pr.association === "FIRST_TIME_CONTRIBUTOR" || pr.association === "FIRST_TIMER"
              ? " · first-time contributor"
              : ""}
          </span>
        </span>
        <span className="tnum shrink-0 text-[12.5px] text-ink-2">{right}</span>
      </a>
    </li>
  );
}

export function PrList({
  title,
  subtitle,
  items,
  mode,
  empty,
}: {
  title: string;
  subtitle: string;
  items: PullSummary[];
  mode: "age" | "merged";
  empty: string;
}) {
  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <header className="mb-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>
      </header>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3">{empty}</p>
      ) : (
        <ul>
          {items.map((pr) => (
            <Row
              key={pr.number}
              pr={pr}
              right={
                mode === "age"
                  ? `open ${formatDays(pr.ageDays)}`
                  : `merged ${formatRelative(pr.mergedAt)}${
                      pr.firstResponseHours !== null ? ` · replied in ${formatHours(pr.firstResponseHours)}` : ""
                    }`
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
