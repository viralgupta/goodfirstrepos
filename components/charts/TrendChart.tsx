"use client";

import { useRef, useState } from "react";
import { ChartFrame, Tip, type TipState } from "./Tip";
import { formatMonth } from "@/lib/format";
import type { Analysis } from "@/lib/types";

const OUTSIDE = "#eb6834";
const CORE = "#2a78d6";

const W = 900;
const H = 260;
const PAD = { top: 24, right: 10, bottom: 40, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(value));
  const step = mag / 2;
  return Math.ceil(value / step) * step;
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

export function TrendChart({ trend }: { trend: Analysis["trend"] }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  if (trend.length < 2) return null;

  const max = niceMax(Math.max(1, ...trend.map((t) => t.outsideMerged + t.insideMerged)));
  const band = PLOT_W / trend.length;
  const barW = Math.min(34, band * 0.6);
  const ticks = [0, max / 2, max];
  const lastWithOutside = [...trend].reverse().find((t) => t.outsideMerged > 0);

  return (
    <ChartFrame
      title="Merges by month"
      subtitle="Who wrote the code that actually shipped, over the window this sample covers."
      legend={[
        { label: "Outside contributors", color: OUTSIDE },
        { label: "Core team", color: CORE },
      ]}
    >
      <div ref={hostRef} className="relative" onMouseLeave={() => setTip(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Merged pull requests by month: ${trend
            .map((t) => `${t.month}, ${t.outsideMerged} outside and ${t.insideMerged} core`)
            .join("; ")}`}
        >
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

          {trend.map((point, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const coreH = (point.insideMerged / max) * PLOT_H;
            const outsideH = (point.outsideMerged / max) * PLOT_H;
            const baseline = PAD.top + PLOT_H;
            const coreY = baseline - coreH;
            // 2px surface gap keeps the two fills apart without a border.
            const outsideY = coreY - outsideH - (coreH > 0 && outsideH > 0 ? 2 : 0);
            const total = point.outsideMerged + point.insideMerged;

            return (
              <g key={point.month}>
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${point.month}: ${point.outsideMerged} outside merges, ${point.insideMerged} core merges`}
                  onMouseEnter={() =>
                    setTip({
                      x: ((PAD.left + i * band + band / 2) / W) * 100,
                      y: ((Math.min(outsideY, coreY) - 6) / H) * 100,
                      title: point.month,
                      rows: [
                        { label: "Outside merged", value: point.outsideMerged.toLocaleString(), swatch: OUTSIDE },
                        { label: "Core merged", value: point.insideMerged.toLocaleString(), swatch: CORE },
                        { label: "Outside opened", value: point.outsideOpened.toLocaleString() },
                        {
                          label: "Outside share",
                          value: total ? `${Math.round((point.outsideMerged / total) * 100)}%` : "—",
                        },
                      ],
                    })
                  }
                />
                {point.insideMerged > 0 ? (
                  <path
                    d={
                      point.outsideMerged > 0
                        ? `M${x},${baseline} V${coreY} H${x + barW} V${baseline} Z`
                        : topRounded(x, coreY, barW, Math.max(coreH, 2), 4)
                    }
                    fill={CORE}
                    pointerEvents="none"
                  />
                ) : null}
                {point.outsideMerged > 0 ? (
                  <path
                    d={topRounded(x, outsideY, barW, Math.max(outsideH, 2), 4)}
                    fill={OUTSIDE}
                    pointerEvents="none"
                  />
                ) : null}
                <text
                  x={PAD.left + i * band + band / 2}
                  y={H - PAD.bottom + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#8c857a"
                  pointerEvents="none"
                >
                  {formatMonth(point.month)}
                </text>
                {lastWithOutside && point.month === lastWithOutside.month ? (
                  <text
                    x={x + barW / 2}
                    y={outsideY - 7}
                    textAnchor="middle"
                    className="tnum"
                    fontSize={12}
                    fontWeight={600}
                    fill={OUTSIDE}
                    pointerEvents="none"
                  >
                    {point.outsideMerged}
                  </text>
                ) : null}
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
