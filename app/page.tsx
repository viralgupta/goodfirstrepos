"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AgeChart } from "@/components/charts/AgeChart";
import { OutcomeChart } from "@/components/charts/OutcomeChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { LimitedNotice } from "@/components/LimitedNotice";
import { Footnotes, Method } from "@/components/Method";
import { PrList } from "@/components/PrList";
import { RepoForm } from "@/components/RepoForm";
import { ScoreCard } from "@/components/ScoreCard";
import { Breakdown, KpiRow } from "@/components/Stats";
import { getServerToken, getToken, setStoredToken, subscribeToken } from "@/lib/tokenStore";
import type { Analysis, StreamEvent } from "@/lib/types";

const SOURCE_URL = "https://github.com/viralgupta/goodfirstrepos";

type Status = "idle" | "running" | "done" | "error";

interface Progress {
  message: string;
  fetched?: number;
  total?: number | null;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Analyzer />
    </Suspense>
  );
}

function Analyzer() {
  const initialRepo = useSearchParams().get("repo") ?? "";

  const token = useSyncExternalStore(subscribeToken, getToken, getServerToken);
  const [input, setInput] = useState(initialRepo);
  const [serverToken, setServerToken] = useState(false);
  const [deep, setDeep] = useState(false);
  // A ?repo= link starts mid-flight, so the first paint already shows progress
  // instead of flipping there in an effect.
  const [status, setStatus] = useState<Status>(initialRepo ? "running" : "idle");
  const [progress, setProgress] = useState<Progress | null>(
    initialRepo ? { message: "Reaching GitHub" } : null,
  );
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenPrompt, setTokenPrompt] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const landedOn = useRef<string | null>(null);

  /** Fetches and streams. Every state update happens after the first await. */
  const execute = useCallback(
    async (repo: string) => {
      const target = repo.trim();
      if (!target) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const slug = target.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/+$/, "");
      // Show the canonical owner/name rather than whatever URL was pasted in.
      setInput(slug);
      window.history.replaceState(null, "", `?repo=${encodeURIComponent(slug)}`);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo: target, token: getToken(), deep }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? `The request failed (${response.status}).`);
          setStatus("error");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let settled = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line) as StreamEvent;
            } catch {
              continue;
            }
            if (event.type === "progress") {
              setProgress({ message: event.message, fetched: event.fetched, total: event.total });
            } else if (event.type === "result") {
              setResult(event.data);
              setStatus("done");
              settled = true;
            } else if (event.type === "error") {
              setError(event.message);
              setStatus("error");
              settled = true;
            }
          }
        }

        if (!settled) {
          setError("GitHub closed the connection early. Try again, or turn off deep scan.");
          setStatus("error");
        }
      } catch (caught) {
        if ((caught as Error)?.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Something went wrong.");
        setStatus("error");
      }
    },
    [deep],
  );

  const run = useCallback(
    (repo: string) => {
      if (!repo.trim()) return;
      setStatus("running");
      setError(null);
      setProgress({ message: "Reaching GitHub" });
      void execute(repo);
    },
    [execute],
  );

  // Kick off an analysis for ?repo=… and ask whether the deployment carries its
  // own token. Both talk to the outside world rather than deriving state.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analyze", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { tokenConfigured?: boolean }) => setServerToken(Boolean(data.tokenConfigured)))
      .catch(() => undefined);
    // Starting the request is the effect; every state update inside execute()
    // happens in an async continuation, and "running" is already the initial
    // state for a ?repo= link, so nothing cascades on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialRepo) void execute(initialRepo);
    return () => controller.abort();
    // Mount only: later ?repo= changes come from us writing the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const slug = result?.repo.nameWithOwner;
    if (status === "done" && slug && landedOn.current !== slug) {
      landedOn.current = slug;
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status, result]);

  const running = status === "running";
  const showHero = !result && !running;

  const form = (compact: boolean) => (
    <RepoForm
      compact={compact}
      openPanelSignal={tokenPrompt}
      value={input}
      onValueChange={setInput}
      onSubmit={run}
      onCancel={() => {
        abortRef.current?.abort();
        setStatus(result ? "done" : "idle");
      }}
      running={running}
      token={token}
      onTokenChange={setStoredToken}
      serverToken={serverToken}
      deep={deep}
      onDeepChange={setDeep}
    />
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-clay text-[12px] font-bold text-white">
              g
            </span>
            <span className="font-display text-[17px] text-ink">goodfirstrepos</span>
          </Link>
          <span className="hidden text-[13px] text-ink-3 sm:inline">· is this repo worth contributing to?</span>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-[13px] text-ink-2 transition-colors hover:text-clay-ink"
          >
            Source
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        {showHero ? (
          <section className="py-14 sm:py-20">
            <p className="mb-4 text-center font-mono text-[12px] tracking-wide text-clay-ink uppercase">
              Pull request archaeology
            </p>
            <h1 className="mx-auto max-w-3xl text-center font-display text-[38px] leading-[1.06] text-ink sm:text-[58px]">
              Before you open that pull request
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-center text-[15px] leading-relaxed text-ink-2">
              Enthusiasm is cheap; a weekend is not. Paste a repository and see what actually happens to work from
              outside the core team — how much lands, how long it waits, and how much of the queue has quietly rotted.
            </p>
            <div className="mt-8">{form(false)}</div>

            <ul className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3">
              {[
                {
                  title: "Who actually merges",
                  body: "The share of merged pull requests written by people without commit rights — bots removed, maintainers' own early work counted on the inside.",
                },
                {
                  title: "How long you wait",
                  body: "Median time to a first human reply, counting the pull requests nobody has answered yet at their current age.",
                },
                {
                  title: "What rots",
                  body: "How much of the outside queue is past 30, 90 and 180 days, and whether it is draining faster than it fills.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <h2 className="text-[14px] font-semibold text-ink">{item.title}</h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="sticky top-[49px] z-20 -mx-5 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur-sm">
            {form(true)}
          </div>
        )}

        {running ? (
          <div className="fade card mt-6 flex items-center gap-4 px-5 py-4">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clay opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-clay" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">
                {progress?.message ?? "Working"}
                {progress?.fetched !== undefined ? (
                  <span className="tnum ml-2 font-normal text-ink-2">
                    {progress.fetched.toLocaleString()}
                    {progress.total ? ` / ${progress.total.toLocaleString()}` : ""}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-sunk">
                {progress?.total && progress.fetched !== undefined ? (
                  <div
                    className="h-full rounded-full bg-clay transition-[width] duration-300"
                    style={{ width: `${Math.min(100, (progress.fetched / Math.max(progress.total, 1)) * 100)}%` }}
                  />
                ) : (
                  <div className="shimmer h-full w-full" />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="fade mt-6 rounded-xl border border-[#f0cfcf] bg-[#fdf4f4] px-5 py-4">
            <p className="text-[13.5px] font-medium text-[#8d2020]">{error}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              Check the spelling, or add a personal access token if you are hitting GitHub&apos;s unauthenticated
              limit.
            </p>
          </div>
        ) : null}

        {result ? (
          <div
            ref={resultsRef}
            className={`mt-6 space-y-4 transition-opacity duration-200 ${running ? "opacity-45" : "rise opacity-100"}`}
          >
            {result.score.available ? (
              <ScoreCard analysis={result} />
            ) : (
              <LimitedNotice
                analysis={result}
                onAddToken={() => {
                  setTokenPrompt((n) => n + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
            <KpiRow analysis={result} />
            {result.score.available ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <OutcomeChart outcomes={result.outcomes} />
                <AgeChart buckets={result.ageBuckets} total={result.backlog.openOutside} />
              </div>
            ) : (
              <AgeChart buckets={result.ageBuckets} total={result.backlog.open} limited />
            )}
            {result.score.available ? <TrendChart trend={result.trend} /> : null}
            {result.score.available ? <Breakdown criteria={result.score.criteria} /> : null}
            <div className={`grid gap-4 ${result.score.available ? "lg:grid-cols-2" : ""}`}>
              <PrList
                title={
                  result.score.available ? "Longest-waiting outside pull requests" : "Longest-waiting pull requests"
                }
                subtitle="Still open, oldest first."
                items={result.oldestOpenOutside}
                mode="age"
                empty="No open pull requests from outside the core team."
              />
              {result.score.available ? (
                <PrList
                  title="Outside work that did land"
                  subtitle="Most recent merges from outside the core team."
                  items={result.recentOutsideMerges}
                  mode="merged"
                  empty="Nothing from outside the core team was merged in this sample."
                />
              ) : null}
            </div>
            <Footnotes analysis={result} />
            <Method />
          </div>
        ) : null}
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 text-[12.5px] text-ink-3">
          <p>
            Built on the public GitHub API. Nothing is stored — each analysis runs per request, and your token stays in
            your browser.
          </p>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto transition-colors hover:text-clay-ink"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
