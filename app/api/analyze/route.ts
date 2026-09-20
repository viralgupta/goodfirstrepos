import { analyse } from "@/lib/analyze";
import { collectRepoData, GitHubError, parseRepoInput } from "@/lib/github";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Crude per-IP throttle so a public deployment is not a free GitHub proxy. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 25;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const TOKEN_SHAPE = /^[A-Za-z0-9_.-]{20,255}$/;

export async function POST(request: Request) {
  let body: { repo?: string; token?: string; deep?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const target = parseRepoInput(body.repo ?? "");
  if (!target) {
    return Response.json(
      { error: "That doesn't look like a GitHub repository. Try a URL or owner/name." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  if (throttled(ip)) {
    return Response.json({ error: "Slow down a moment — too many analyses from this address." }, { status: 429 });
  }

  const userToken = typeof body.token === "string" ? body.token.trim() : "";
  if (userToken && !TOKEN_SHAPE.test(userToken)) {
    return Response.json({ error: "That token doesn't look like a GitHub token." }, { status: 400 });
  }
  const token = userToken || process.env.GITHUB_TOKEN || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client hung up mid-stream; nothing to do.
        }
      };
      try {
        const { meta, pulls, sample, writeAccess } = await collectRepoData({
          owner: target.owner,
          repo: target.repo,
          token,
          deep: Boolean(body.deep),
          signal: request.signal,
          onProgress: (stage, message, fetched, total) => send({ type: "progress", stage, message, fetched, total }),
        });
        send({ type: "progress", stage: "scoring", message: "Scoring the project" });
        send({ type: "result", data: analyse(meta, pulls, sample, writeAccess) });
      } catch (error) {
        if (error instanceof GitHubError) {
          send({ type: "error", message: error.message, code: error.code });
        } else {
          send({
            type: "error",
            message: error instanceof Error ? error.message : "Something went wrong talking to GitHub.",
            code: "unknown",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    usage: "POST { repo: 'owner/name', token?: string, deep?: boolean } and read the NDJSON stream.",
    tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
  });
}
