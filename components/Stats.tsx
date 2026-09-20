import { formatDays, formatHours, formatPercent } from "@/lib/format";
import type { Analysis } from "@/lib/types";

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card min-w-0 px-4 py-4">
      <p className="text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="mt-1.5 text-[28px] leading-none font-semibold text-ink">{value}</p>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{sub}</p>
    </div>
  );
}

export function KpiRow({ analysis }: { analysis: Analysis }) {
  const { backlog, outcomes, responsiveness } = analysis;
  const limited = !analysis.score.available;

  const tiles = [
    {
      label: limited ? "Open pull requests" : "Open from outside",
      value: limited ? backlog.open.toLocaleString() : backlog.openOutside.toLocaleString(),
      sub: limited ? "in the queue right now" : `of ${backlog.open.toLocaleString()} open pull requests`,
    },
    {
      label: "Outsider merge share",
      value: formatPercent(outcomes.outsideShareOfMerges),
      sub:
        outcomes.outsideShareOfMerges === null
          ? "no merges in the sample"
          : `${outcomes.mergedOutside} of ${outcomes.mergedTotal} merges`,
    },
    {
      label: "Outsider acceptance",
      value: formatPercent(outcomes.outsideAcceptance),
      sub:
        outcomes.insideAcceptance === null
          ? "of resolved outside pull requests"
          : `core team lands ${formatPercent(outcomes.insideAcceptance)}`,
    },
    {
      label: "First reply",
      value:
        responsiveness.medianFirstResponseHours === null
          ? "—"
          : formatHours(responsiveness.medianFirstResponseHours),
      sub:
        responsiveness.medianFirstResponseHours === null
          ? "needs a token to measure"
          : responsiveness.neverAnsweredShare
            ? `median · ${formatPercent(responsiveness.neverAnsweredShare)} never answered`
            : "median wait for a human",
    },
    {
      label: "Waiting over 90 days",
      value: backlog.over90.toLocaleString(),
      sub:
        backlog.medianOpenAgeDays === null
          ? "no open outside pull requests"
          : `median open age ${formatDays(backlog.medianOpenAgeDays)}`,
    },
    {
      label: "Time to merge",
      value: responsiveness.medianMergeDays === null ? "—" : formatDays(responsiveness.medianMergeDays),
      sub: "median, outside pull requests that landed",
    },
  ];

  const shown = limited
    ? tiles.filter((t) => ["Open pull requests", "Waiting over 90 days"].includes(t.label))
    : tiles;

  return (
    <div className={`grid gap-3 ${limited ? "sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"}`}>
      {shown.map((tile) => (
        <Tile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

export function Breakdown({ criteria }: { criteria: Analysis["score"]["criteria"] }) {
  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <header className="mb-5">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">How the score is built</h3>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Six questions, weighted by how much each one costs a contributor. Anything that can&apos;t be measured is
          dropped and the rest are rescaled.
        </p>
      </header>

      <ul className="space-y-5">
        {criteria.map((c) => {
          const ratio = c.available && c.max > 0 ? c.points / c.max : 0;
          return (
            <li key={c.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[13.5px] font-medium text-ink">{c.label}</p>
                <p className="tnum text-[12.5px] text-ink-3">
                  {c.available ? (
                    <>
                      <span className="font-medium text-ink-2">{c.points}</span> / {c.max}
                    </>
                  ) : (
                    "not measured"
                  )}
                </p>
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{c.question}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunk">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%`,
                    background: c.available ? "var(--color-clay)" : "var(--color-line-2)",
                  }}
                />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                {c.detail} <span className="text-ink-3">{c.available ? c.hint : ""}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
