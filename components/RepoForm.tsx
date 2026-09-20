"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLES = ["facebook/react", "anomalyco/opencode", "vercel/next.js", "home-assistant/core", "astral-sh/ruff"];

export function RepoForm({
  value,
  onValueChange,
  onSubmit,
  onCancel,
  running,
  token,
  onTokenChange,
  serverToken,
  deep,
  onDeepChange,
  compact,
  openPanelSignal = 0,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  running: boolean;
  token: string;
  onTokenChange: (token: string) => void;
  serverToken: boolean;
  deep: boolean;
  onDeepChange: (deep: boolean) => void;
  compact?: boolean;
  /** Bumped by a parent that wants the token panel opened. */
  openPanelSignal?: number;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftToken, setDraftToken] = useState(token);

  const togglePanel = () => {
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setDraftToken(token);
    setPanelOpen(true);
  };

  // Opened from elsewhere on the page (the partial-read prompt).
  const lastSignal = useRef(openPanelSignal);
  useEffect(() => {
    if (openPanelSignal !== lastSignal.current) {
      lastSignal.current = openPanelSignal;
      setDraftToken(token);
      setPanelOpen(true);
    }
  }, [openPanelSignal, token]);

  const hasToken = Boolean(token) || serverToken;

  return (
    <div className={compact ? "" : "mx-auto w-full max-w-2xl"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!running) onSubmit(value);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-mono text-[13px] text-ink-3 select-none"
            aria-hidden
          >
            github.com/
          </span>
          <input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="owner/repo"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="GitHub repository"
            className="h-12 w-full rounded-xl border border-line-2 bg-card pr-4 pl-[104px] font-mono text-[14px] text-ink shadow-[0_1px_2px_rgba(26,24,21,0.04)] transition-colors placeholder:text-ink-3/70 hover:border-clay-line focus:border-clay focus:outline-none"
          />
        </div>
        {running ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 shrink-0 rounded-xl border border-line-2 bg-card px-5 text-[14px] font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            className="h-12 shrink-0 rounded-xl bg-clay px-6 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(26,24,21,0.08)] transition-colors hover:bg-clay-deep active:bg-clay-ink"
          >
            Analyse
          </button>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!compact ? (
          <ul className="flex flex-wrap items-center gap-1.5">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(example);
                    onSubmit(example);
                  }}
                  disabled={running}
                  className="rounded-full border border-line bg-card px-2.5 py-1 font-mono text-[12px] text-ink-2 transition-colors hover:border-clay-line hover:bg-clay-wash hover:text-clay-ink disabled:opacity-50"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-2 select-none">
            <input
              type="checkbox"
              checked={deep}
              onChange={(event) => onDeepChange(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#d97757]"
            />
            Deep scan
          </label>
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={panelOpen}
            className="flex items-center gap-1.5 text-[12.5px] text-ink-2 transition-colors hover:text-clay-ink"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: hasToken ? "#0ca30c" : "#dcd4c7" }}
              aria-hidden
            />
            {token ? "Token saved" : serverToken ? "Server token" : "Add token"}
          </button>
        </div>
      </div>

      {panelOpen ? (
        <div className="fade card mt-3 p-4">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Without a token GitHub allows 60 requests an hour, which is enough for a small sample and no reply-time
            data. A read-only classic token (no scopes needed for public repos) raises that to 5,000 and unlocks the
            full read.{" "}
            <a
              href="https://github.com/settings/tokens/new?description=goodfirstrepos&scopes="
              target="_blank"
              rel="noreferrer noopener"
              className="text-clay-ink underline decoration-clay-line underline-offset-2 hover:decoration-clay"
            >
              Create one
            </a>
            . It is kept in this browser only and sent straight to GitHub on your behalf.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              placeholder="ghp_…"
              spellCheck={false}
              aria-label="GitHub personal access token"
              className="h-10 flex-1 rounded-lg border border-line-2 bg-card px-3 font-mono text-[13px] text-ink focus:border-clay focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onTokenChange(draftToken.trim());
                setPanelOpen(false);
              }}
              className="h-10 rounded-lg bg-clay px-4 text-[13px] font-medium text-white transition-colors hover:bg-clay-deep"
            >
              Save
            </button>
            {token ? (
              <button
                type="button"
                onClick={() => {
                  setDraftToken("");
                  onTokenChange("");
                }}
                className="h-10 rounded-lg border border-line-2 px-4 text-[13px] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
