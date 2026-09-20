import type { Analysis } from "@/lib/types";

export function Footnotes({ analysis }: { analysis: Analysis }) {
  const { sample, flags } = analysis;
  return (
    <section className="rounded-xl border border-line bg-sunk/50 p-5 sm:p-6">
      <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">Read this before quoting it</h3>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
        {flags.map((flag) => (
          <li key={flag} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
            {flag}
          </li>
        ))}
        {analysis.score.available ? (
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
            Merge statistics cover pull requests created since{" "}
            {sample.closedWindowStart ? sample.closedWindowStart.slice(0, 10) : "the start of the sample"}.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function Method() {
  const items = [
    {
      term: "Outside contributor",
      def: "Anyone whose pull requests never carry an OWNER, MEMBER or COLLABORATOR association. A maintainer's early pull requests count as inside, so the outsider numbers are not flattered by people who later joined the team.",
    },
    {
      term: "Bots",
      def: "Dependabot, Renovate and friends are stripped out entirely. A repo that merges 400 dependency bumps a month is not thereby welcoming.",
    },
    {
      term: "First reply",
      def: "The first comment or review from anyone other than the author. Pull requests nobody has answered yet count at their current age, so silence cannot quietly drop out of the median.",
    },
    {
      term: "The open queue",
      def: "Read oldest-first, so the 30 and 90 day counts are exact even on projects with thousands of open pull requests. Only the newest arrivals are ever estimated.",
    },
    {
      term: "The resolved sample",
      def: "The most recently updated closed and merged pull requests, capped for speed. Deep scan raises the cap.",
    },
    {
      term: "The score",
      def: "Six weighted questions: outsider share of merges (25), outsider acceptance rate (25), time to first reply (20), backlog rot (15), queue movement (10), welcome mat (5). Anything unmeasurable is dropped and the rest rescaled.",
    },
  ];

  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold tracking-tight text-ink">What the numbers mean</h3>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.term}>
            <dt className="text-[13px] font-medium text-ink">{item.term}</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{item.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
