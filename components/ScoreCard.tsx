"use client";

import { formatNumber, formatRelative } from "@/lib/format";
import type { Analysis } from "@/lib/types";

const GRADE = {
  A: { color: "#0ca30c", word: "Open door" },
  B: { color: "#0ca30c", word: "Worth your time" },
  C: { color: "#fab219", word: "Mixed signals" },
  D: { color: "#ec835a", word: "Steep climb" },
  F: { color: "#d03b3b", word: "Effectively closed" },
} as const;

function Ring({ value, color }: { value: number; color: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" aria-hidden>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#f1ece4" strokeWidth="9" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="66" textAnchor="middle" fontSize="35" fontWeight="600" fill="#1a1815">
        {Math.round(value)}
      </text>
      <text x="64" y="86" textAnchor="middle" fontSize="12" fill="#8c857a">
        out of 100
      </text>
    </svg>
  );
}

export function ScoreCard({ analysis }: { analysis: Analysis }) {
  const { repo, score, sample } = analysis;
  const grade = GRADE[score.grade];

  const chips: string[] = [];
  if (repo.language) chips.push(repo.language);
  if (repo.license) chips.push(repo.license);
  chips.push(`${formatNumber(repo.stars)} stars`);
  chips.push(`pushed ${formatRelative(repo.pushedAt)}`);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line bg-sunk/60 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {repo.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={repo.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-md border border-line"
            />
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
            {chips.map((chip) => (
              <li key={chip} className="before:mr-2 before:content-['·'] first:before:content-none">
                {chip}
              </li>
            ))}
          </ul>
        </div>
        {repo.description ? (
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">{repo.description}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:gap-8 sm:px-7">
        <div className="flex items-center gap-4">
          <Ring value={score.total} color={grade.color} />
          <div className="sm:hidden">
            <p className="font-display text-2xl">Grade {score.grade}</p>
            <p className="text-[13px] text-ink-2">{grade.word}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 hidden items-center gap-2.5 sm:flex">
            <span
              className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold text-white"
              style={{ background: grade.color === "#fab219" ? "#8a6100" : grade.color }}
            >
              Grade {score.grade}
            </span>
            <span className="text-[13px] font-medium text-ink-2">{grade.word}</span>
          </div>
          <p className="font-display text-[26px] leading-[1.22] text-ink sm:text-[30px]">{score.headline}</p>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">{score.verdict}</p>
          <p className="mt-3 text-[12px] text-ink-3">
            Based on {sample.openFetched.toLocaleString()} open and {sample.closedFetched.toLocaleString()} resolved
            pull requests
            {sample.mode === "rest" ? " (no token: limited sample)" : ""}.
          </p>
        </div>
      </div>
    </section>
  );
}
