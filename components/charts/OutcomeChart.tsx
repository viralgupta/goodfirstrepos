"use client";

import { useRef, useState } from "react";
import { ChartFrame, Tip, type TipState } from "./Tip";
import type { Analysis } from "@/lib/types";

const SERIES = [
  { key: "merged", label: "Merged", color: "#eb6834" },
  { key: "closed", label: "Closed unmerged", color: "#2a78d6" },
  { key: "open", label: "Still open", color: "#1baf7a" },
] as const;

type Row = {
  name: string;
  note: string;
  values: { merged: number; closed: number; open: number };
};

export function OutcomeChart({ outcomes }: { outcomes: Analysis["outcomes"] }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const rows: Row[] = [
    {
      name: "Outside contributors",
      note: "people without commit rights",
      values: outcomes.outside,
    },
    {
      name: "Core team",
      note: "owners, members, collaborators",
      values: outcomes.inside,
    },
  ];

  return (
    <ChartFrame
      title="What happens to a pull request"
      subtitle="Every pull request in the sample, split by who wrote it."
      legend={SERIES.map((s) => ({ label: s.label, color: s.color }))}
      footer={
        <>
        {outcomes.authorsTried > 0 ? (
          <p className="mb-3 text-[13px] leading-relaxed text-ink">
            <span className="tnum font-medium">{outcomes.authorsLanded}</span> of{" "}
            <span className="tnum font-medium">{outcomes.authorsTried}</span> outside contributors got something
            merged.
            {outcomes.neverLandedClosed > 0 ? (
              <>
                {" "}
                <span className="tnum font-medium">{outcomes.neverLandedClosed}</span> of the{" "}
                <span className="tnum font-medium">{outcomes.outside.closed}</span> rejections went to people who have
                never landed anything here.
              </>
            ) : null}
          </p>
        ) : null}
        <table className="w-full text-left">
          <thead className="text-[11px] tracking-wide text-ink-3 uppercase">
            <tr>
              <th className="pb-1 font-medium">Author</th>
              {SERIES.map((s) => (
                <th key={s.key} className="pb-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
              <th className="pb-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((row) => {
              const total = row.values.merged + row.values.closed + row.values.open;
              return (
                <tr key={row.name} className="border-t border-line">
                  <td className="py-1.5 text-ink">{row.name}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 text-right text-ink-2">
                      {row.values[s.key].toLocaleString()}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-medium text-ink">{total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
      }
    >
      <div ref={hostRef} className="relative space-y-5" onMouseLeave={() => setTip(null)}>
        {rows.map((row) => {
          const total = row.values.merged + row.values.closed + row.values.open;
          return (
            <div key={row.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium text-ink">
                  {row.name} <span className="font-normal text-ink-3">· {row.note}</span>
                </p>
                <p className="tnum text-[13px] text-ink-2">{total.toLocaleString()} PRs</p>
              </div>
              <div className="flex h-11 w-full gap-[2px] overflow-hidden rounded-[6px] bg-sunk">
                {total === 0 ? (
                  <div className="flex w-full items-center justify-center text-[12px] text-ink-3">
                    nothing in the sample
                  </div>
                ) : (
                  SERIES.map((s) => {
                    const value = row.values[s.key];
                    if (value === 0) return null;
                    const share = value / total;
                    const label = `${Math.round(share * 100)}%`;
                    return (
                      <div
                        key={s.key}
                        tabIndex={0}
                        role="img"
                        aria-label={`${row.name}: ${value} ${s.label} (${label})`}
                        className="relative flex min-w-[3px] items-center justify-center rounded-[3px] transition-[filter] hover:brightness-95 focus:brightness-95"
                        style={{ background: s.color, flexGrow: value, flexBasis: 0 }}
                        onFocus={() => setTip(null)}
                        onMouseEnter={(event) => {
                          const host = hostRef.current;
                          if (!host) return;
                          const box = event.currentTarget.getBoundingClientRect();
                          const hostBox = host.getBoundingClientRect();
                          setTip({
                            x: ((box.left + box.width / 2 - hostBox.left) / hostBox.width) * 100,
                            y: ((box.top - hostBox.top) / hostBox.height) * 100,
                            title: row.name,
                            rows: [
                              {
                                label: s.label,
                                value: `${value.toLocaleString()} · ${label}`,
                                swatch: s.color,
                              },
                            ],
                          });
                        }}
                      >
                        {share > 0.11 ? (
                          <span className="tnum px-1 text-[12px] font-medium text-white">{label}</span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        <Tip tip={tip} />
      </div>
    </ChartFrame>
  );
}
