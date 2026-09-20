"use client";

import { useRef, useState } from "react";
import { ChartFrame, Tip, type TipState } from "./Tip";
import type { Analysis } from "@/lib/types";

// Ordered age bands get the ordinal ramp, not four unrelated hues.
const RAMP = ["#e79a7e", "#dd7a50", "#c55628", "#96401e"];

const W = 560;
const H = 250;
const PAD = { top: 26, right: 8, bottom: 42, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / mag) * mag;
}

function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, h, w / 2);
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

export function AgeChart({
  buckets,
  total,
  limited,
}: {
  buckets: Analysis["ageBuckets"];
  total: number;
  limited?: boolean;
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const max = niceMax(Math.max(1, ...buckets.map((b) => b.count)));
  const band = PLOT_W / buckets.length;
  const barW = Math.min(64, band * 0.52);
  const ticks = [0, max / 2, max];

  return (
    <ChartFrame
      title="How long the open ones have been waiting"
      subtitle={limited ? "Every open pull request, by age." : "Open pull requests from outside contributors, by age."}
      footer={
        <p>
          {buckets[3].count > 0
            ? `${buckets[3].count.toLocaleString()} of ${total.toLocaleString()} have been open more than 90 days.`
            : "Nothing has been left open past 90 days."}
          {buckets.some((b) => b.estimated) ? " The youngest band is estimated from the unread tail." : ""}
        </p>
      }
    >
      <div ref={hostRef} className="relative" onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} role="img"
          aria-label={`Open pull requests by age: ${buckets.map((b) => `${b.label}, ${b.count}`).join("; ")}`}>
          {ticks.map((t) => {
            const y = PAD.top + PLOT_H - (t / max) * PLOT_H;
            return (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#ece7de" strokeWidth={1} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="tnum" fontSize={11} fill="#8c857a">
                  {Math.round(t)}
                </text>
              </g>
            );
          })}

          {buckets.map((bucket, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = (bucket.count / max) * PLOT_H;
            const y = PAD.top + PLOT_H - h;
            return (
              <g key={bucket.label}>
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${bucket.label}: ${bucket.count} pull requests`}
                  onMouseEnter={() => {
                    setTip({
                      x: ((PAD.left + i * band + band / 2) / W) * 100,
                      y: ((y - 6) / H) * 100,
                      title: bucket.label,
                      rows: [
                        {
                          label: bucket.estimated ? "Open (estimated)" : "Open",
                          value: bucket.count.toLocaleString(),
                          swatch: RAMP[i],
                        },
                        { label: "Share", value: total ? `${Math.round((bucket.count / total) * 100)}%` : "—" },
                      ],
                    });
                  }}
                />
                {bucket.count > 0 ? (
                  <path d={topRounded(x, y, barW, Math.max(h, 2), 4)} fill={RAMP[i]} pointerEvents="none" />
                ) : null}
                <text
                  x={x + barW / 2}
                  y={y - 8}
                  textAnchor="middle"
                  className="tnum"
                  fontSize={12.5}
                  fontWeight={600}
                  fill="#1a1815"
                  pointerEvents="none"
                >
                  {bucket.count.toLocaleString()}
                  {bucket.estimated ? "*" : ""}
                </text>
                <text
                  x={PAD.left + i * band + band / 2}
                  y={H - PAD.bottom + 20}
                  textAnchor="middle"
                  fontSize={11.5}
                  fill="#57514a"
                  pointerEvents="none"
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke="#dcd4c7"
            strokeWidth={1}
          />
        </svg>
        <Tip tip={tip} />
      </div>
    </ChartFrame>
  );
}
