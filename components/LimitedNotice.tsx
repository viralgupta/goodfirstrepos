import { formatDays, formatNumber, formatRelative } from "@/lib/format";
import type { Analysis } from "@/lib/types";

/**
 * Shown when we ran without a token. GitHub's unauthenticated API gives no way
 * to tell a maintainer from a stranger, so rather than print a confident wrong
 * number we show what the sample does support and say what a token would add.
 */
export function LimitedNotice({ analysis, onAddToken }: { analysis: Analysis; onAddToken: () => void }) {
  const { repo, backlog } = analysis;
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line bg-sunk/60 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {repo.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={repo.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-md border border-line" />
          ) : null}
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[15px] font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-clay"
          >
            {repo.nameWithOwner}
          </a>
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
            {[repo.language, `${formatNumber(repo.stars)} stars`, `pushed ${formatRelative(repo.pushedAt)}`]
              .filter(Boolean)
              .map((chip) => (
                <li key={chip as string} className="before:mr-2 before:content-['·'] first:before:content-none">
                  {chip}
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <p className="inline-flex items-center gap-2 rounded-full bg-clay-wash px-2.5 py-1 text-[12px] font-medium text-clay-ink">
          Partial read
        </p>
        <h2 className="mt-3 font-display text-[26px] leading-[1.2] text-ink sm:text-[30px]">
          {backlog.open.toLocaleString()} open pull requests, {backlog.over90.toLocaleString()} of them waiting more
          than 90 days.
        </h2>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          That is as far as an anonymous read goes. Scoring a project means separating the core team from everyone
          else, and GitHub only reveals who holds write access to a request that carries a token — without one, half a
          project&apos;s maintainers look like strangers and the merge rate comes out wildly wrong. A read-only token
          takes a minute and stays in your browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAddToken}
            className="h-10 rounded-lg bg-clay px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-clay-deep"
          >
            Add a token
          </button>
          <p className="text-[12.5px] text-ink-3">
            Median open age {backlog.medianOpenAgeDays === null ? "—" : formatDays(backlog.medianOpenAgeDays)} ·{" "}
            {backlog.over30.toLocaleString()} past 30 days
          </p>
        </div>
      </div>
    </section>
  );
}
