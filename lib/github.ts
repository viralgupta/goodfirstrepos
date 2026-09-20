import type { Association, PullRecord, RepoMeta, SampleInfo } from "./types";

const API = "https://api.github.com";
const GRAPHQL = "https://api.github.com/graphql";

const KNOWN_BOTS = new Set([
  "dependabot",
  "dependabot-preview",
  "renovate",
  "renovate-bot",
  "greenkeeper",
  "snyk-bot",
  "github-actions",
  "imgbot",
  "allcontributors",
  "mergify",
  "codecov",
  "sonarcloud",
  "restyled-io",
  "whitesource-bolt",
  "pyup-bot",
  "semantic-release-bot",
  "step-security-bot",
  "copilot-swe-agent",
  "devin-ai-integration",
  "cursoragent",
  "coderabbitai",
  "sweep-ai",
  "transifex-integration",
  "crowdin-bot",
  "weblate",
]);

export function isBotLogin(login: string | null | undefined, typename?: string): boolean {
  if (typename === "Bot") return true;
  if (!login) return false;
  const l = login.toLowerCase();
  return l.endsWith("[bot]") || l.endsWith("-bot") || KNOWN_BOTS.has(l.replace(/\[bot\]$/, ""));
}

export class GitHubError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Accepts a URL, `owner/repo`, an SSH remote, or anything close enough. */
export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const input = raw.trim();
  if (!input) return null;
  const cleaned = input
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  const valid = /^[A-Za-z0-9-_.]+$/;
  if (!valid.test(owner) || !valid.test(repo)) return null;
  return { owner, repo };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Auth failures, missing repos and rate limits will not fix themselves on retry.
      if (error instanceof GitHubError && error.code !== "upstream") throw error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastError;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "goodfirstrepos",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function handleRestFailure(res: Response, owner: string, repo: string): Promise<never> {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 404) {
    throw new GitHubError(
      `Can't find github.com/${owner}/${repo}. Check the spelling, or add a token if it is private.`,
      "not_found",
      404,
    );
  }
  if (res.status === 401) {
    throw new GitHubError("That GitHub token was rejected. Check that it has not expired.", "bad_token", 401);
  }
  if (res.status === 403 || res.status === 429) {
    if (remaining === "0") {
      throw new GitHubError(
        "GitHub's rate limit is spent. Add a personal access token to keep going: unauthenticated requests get only 60 per hour.",
        "rate_limited",
        429,
      );
    }
    throw new GitHubError(
      "GitHub refused the request (403). It may be a private repo, or a secondary rate limit.",
      "forbidden",
      403,
    );
  }
  throw new GitHubError(`GitHub returned ${res.status} for ${owner}/${repo}.`, "upstream", 502);
}

/* ------------------------------------------------------------------ *
 * GraphQL path: used whenever we have a token. One request per 100     *
 * pull requests, and it carries the comment and review data that REST  *
 * would charge a request each for.                                     *
 * ------------------------------------------------------------------ */

type GqlResponse<T> = { data?: T; errors?: { message: string; type?: string }[] };

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new GitHubError("That GitHub token was rejected. Check that it has not expired.", "bad_token", 401);
      }
      if (res.status === 403 || res.status === 429) {
        throw new GitHubError("GitHub rate-limited this token. Wait a minute and try again.", "rate_limited", 429);
      }
      throw new GitHubError(`GitHub GraphQL returned ${res.status}.`, "upstream", 502);
    }
    const json = (await res.json()) as GqlResponse<T>;
    if (json.errors?.length) {
      const first = json.errors[0];
      if (first.type === "NOT_FOUND") {
        throw new GitHubError(
          "Can't find that repository. Check the spelling, or use a token with access if it is private.",
          "not_found",
          404,
        );
      }
      if (first.type === "RATE_LIMITED") {
        throw new GitHubError("GitHub rate-limited this token. Wait a minute and try again.", "rate_limited", 429);
      }
      throw new GitHubError(first.message, "upstream", 502);
    }
    if (!json.data) throw new GitHubError("GitHub returned an empty response.", "upstream", 502);
    return json.data;
  });
}

const REPO_QUERY = `
query Repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    nameWithOwner
    description
    url
    homepageUrl
    stargazerCount
    forkCount
    isArchived
    isFork
    createdAt
    pushedAt
    hasDiscussionsEnabled
    owner { login avatarUrl }
    primaryLanguage { name }
    licenseInfo { spdxId }
    codeOfConduct { name }
    openPrs: pullRequests(states: OPEN) { totalCount }
    mergedPrs: pullRequests(states: MERGED) { totalCount }
    closedPrs: pullRequests(states: CLOSED) { totalCount }
    openIssues: issues(states: OPEN) { totalCount }
    goodFirst: issues(states: OPEN, labels: ["good first issue"]) { totalCount }
    goodFirstAlt: issues(states: OPEN, labels: ["good-first-issue"]) { totalCount }
    helpWanted: issues(states: OPEN, labels: ["help wanted"]) { totalCount }
    c1: object(expression: "HEAD:CONTRIBUTING.md") { __typename }
    c2: object(expression: "HEAD:.github/CONTRIBUTING.md") { __typename }
    c3: object(expression: "HEAD:docs/CONTRIBUTING.md") { __typename }
    c4: object(expression: "HEAD:CONTRIBUTING") { __typename }
    assignableUsers(first: 100) { nodes { login } }
  }
}`;

const PULLS_QUERY = `
query Pulls($owner: String!, $name: String!, $cursor: String, $states: [PullRequestState!]!, $order: IssueOrder!) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $cursor, states: $states, orderBy: $order) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        createdAt
        updatedAt
        closedAt
        mergedAt
        isDraft
        authorAssociation
        additions
        deletions
        author { login __typename avatarUrl }
        mergedBy { login }
        comments(first: 5) { nodes { createdAt author { login __typename } } }
        reviews(first: 3) { nodes { createdAt author { login __typename } } }
      }
    }
  }
}`;

interface GqlPullNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  isDraft: boolean;
  authorAssociation: Association;
  additions: number;
  deletions: number;
  author: { login: string; __typename: string; avatarUrl: string } | null;
  mergedBy: { login: string } | null;
  comments: { nodes: { createdAt: string; author: GqlActor | null }[] };
  reviews: { nodes: { createdAt: string; author: GqlActor | null }[] };
}

interface GqlActor {
  login: string;
  __typename: string;
}

interface GqlCount {
  totalCount: number;
}

interface GqlRepoNode {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  isArchived: boolean;
  isFork: boolean;
  createdAt: string;
  pushedAt: string | null;
  hasDiscussionsEnabled: boolean;
  owner: { login: string; avatarUrl: string } | null;
  primaryLanguage: { name: string } | null;
  licenseInfo: { spdxId: string | null } | null;
  codeOfConduct: { name: string } | null;
  openPrs: GqlCount;
  mergedPrs: GqlCount;
  closedPrs: GqlCount;
  openIssues: GqlCount;
  goodFirst: GqlCount | null;
  goodFirstAlt: GqlCount | null;
  helpWanted: GqlCount | null;
  c1: { __typename: string } | null;
  c2: { __typename: string } | null;
  c3: { __typename: string } | null;
  c4: { __typename: string } | null;
  assignableUsers: { nodes: ({ login: string } | null)[] };
}

interface GqlPullsResponse {
  repository: { pullRequests: GqlPullConnection };
}

interface GqlPullConnection {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: GqlPullNode[];
}

/**
 * The first reply from an actual person. Greeting bots and CLA checks comment
 * within seconds of every pull request, and counting those would report a
 * median response time of zero for a project nobody is reading.
 */
function firstResponse(node: GqlPullNode): string | null {
  const author = node.author?.login;
  const times = [...node.comments.nodes, ...node.reviews.nodes]
    .filter((n) => n.author?.login && n.author.login !== author)
    .filter((n) => !isBotLogin(n.author!.login, n.author!.__typename))
    .map((n) => n.createdAt)
    .sort();
  return times[0] ?? null;
}

function normaliseGql(node: GqlPullNode): PullRecord {
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    author: node.author?.login ?? null,
    avatarUrl: node.author?.avatarUrl ?? null,
    isBot: isBotLogin(node.author?.login, node.author?.__typename),
    association: node.authorAssociation,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    mergedAt: node.mergedAt,
    isDraft: node.isDraft,
    mergedBy: node.mergedBy?.login ?? null,
    firstResponseAt: firstResponse(node),
    additions: node.additions,
    deletions: node.deletions,
  };
}

/* ------------------------------------------------------------------ *
 * REST path: the no-token fallback. 60 requests an hour per IP, so we  *
 * take a deliberately small sample and label it as one.                *
 * ------------------------------------------------------------------ */

interface RestRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  fork: boolean;
  created_at: string;
  pushed_at: string | null;
  language: string | null;
  license: { spdx_id: string | null } | null;
  open_issues_count: number;
  has_discussions?: boolean;
  owner: { login: string; avatar_url: string } | null;
}

interface RestPull {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  draft: boolean;
  author_association: Association;
  user: { login: string; type: string; avatar_url: string } | null;
}

function normaliseRest(pr: RestPull): PullRecord {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? null,
    avatarUrl: pr.user?.avatar_url ?? null,
    isBot: isBotLogin(pr.user?.login, pr.user?.type === "Bot" ? "Bot" : undefined),
    association: pr.author_association,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    isDraft: Boolean(pr.draft),
    mergedBy: null,
    firstResponseAt: null,
    additions: null,
    deletions: null,
  };
}

async function rest<T>(path: string, owner: string, repo: string, token?: string): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${API}${path}`, { headers: headers(token) });
    if (!res.ok) await handleRestFailure(res, owner, repo);
    return (await res.json()) as T;
  });
}

/* ------------------------------------------------------------------ */

export interface CollectOptions {
  owner: string;
  repo: string;
  token?: string;
  deep?: boolean;
  onProgress?: Note;
  signal?: AbortSignal;
}

export interface CollectResult {
  meta: RepoMeta;
  pulls: PullRecord[];
  sample: SampleInfo;
  /** Logins GitHub says can be assigned work here, i.e. hold write access. */
  writeAccess: string[];
}

type Note = (stage: string, message: string, fetched?: number, total?: number | null) => void;

const CAPS = {
  shallow: { open: 700, closed: 400 },
  deep: { open: 2000, closed: 900 },
  rest: { open: 300, closed: 200 },
};

export async function collectRepoData(opts: CollectOptions): Promise<CollectResult> {
  const { owner, repo, token, deep, onProgress } = opts;
  const note: Note = (stage, message, fetched, total) => onProgress?.(stage, message, fetched, total);
  if (token) return collectViaGraphQL(owner, repo, token, Boolean(deep), note, opts.signal);
  return collectViaRest(owner, repo, note);
}

async function collectViaGraphQL(
  owner: string,
  repo: string,
  token: string,
  deep: boolean,
  note: Note,
  signal?: AbortSignal,
): Promise<CollectResult> {
  note("repo", `Looking up ${owner}/${repo}`);
  const repoData = await graphql<{ repository: GqlRepoNode }>(token, REPO_QUERY, { owner, name: repo });
  const r = repoData.repository;

  const meta: RepoMeta = {
    owner,
    name: r.name,
    nameWithOwner: r.nameWithOwner,
    description: r.description,
    url: r.url,
    homepageUrl: r.homepageUrl,
    avatarUrl: r.owner?.avatarUrl ?? null,
    stars: r.stargazerCount,
    forks: r.forkCount,
    isArchived: r.isArchived,
    isFork: r.isFork,
    createdAt: r.createdAt,
    pushedAt: r.pushedAt,
    language: r.primaryLanguage?.name ?? null,
    license: r.licenseInfo?.spdxId ?? null,
    openPrTotal: r.openPrs.totalCount,
    mergedPrTotal: r.mergedPrs.totalCount,
    closedPrTotal: r.closedPrs.totalCount,
    openIssues: r.openIssues.totalCount,
    goodFirstIssues: (r.goodFirst?.totalCount ?? 0) + (r.goodFirstAlt?.totalCount ?? 0),
    helpWantedIssues: r.helpWanted?.totalCount ?? 0,
    hasContributing: Boolean(r.c1 || r.c2 || r.c3 || r.c4),
    hasCodeOfConduct: Boolean(r.codeOfConduct),
    hasDiscussions: Boolean(r.hasDiscussionsEnabled),
  };

  const caps = deep ? CAPS.deep : CAPS.shallow;

  let openFetched = 0;
  let closedFetched = 0;
  let openTotal: number | null = null;
  let closedTotal: number | null = null;

  // One progress line for both walks, so a reader sees a bar that only ever
  // moves forwards rather than two chains talking over each other.
  const report = () => {
    const target =
      openTotal !== null && closedTotal !== null
        ? Math.min(openTotal, caps.open) + Math.min(closedTotal, caps.closed)
        : null;
    note("pulls", "Reading pull requests", openFetched + closedFetched, target);
  };

  async function walk(
    states: string[],
    order: { field: string; direction: string },
    cap: number,
    onPage: (count: number, total: number) => void,
  ): Promise<{ pulls: PullRecord[]; truncated: boolean }> {
    const collected: PullRecord[] = [];
    let cursor: string | null = null;
    let truncated = false;
    for (;;) {
      if (signal?.aborted) throw new GitHubError("Cancelled.", "aborted", 499);
      const page: GqlPullsResponse = await graphql<GqlPullsResponse>(token, PULLS_QUERY, {
        owner,
        name: repo,
        cursor,
        states,
        order,
      });
      const conn: GqlPullConnection = page.repository.pullRequests;
      for (const node of conn.nodes) collected.push(normaliseGql(node));
      onPage(collected.length, conn.totalCount);
      report();
      if (!conn.pageInfo.hasNextPage) break;
      if (collected.length >= cap) {
        truncated = true;
        break;
      }
      cursor = conn.pageInfo.endCursor;
    }
    return { pulls: collected, truncated };
  }

  // The two walks are independent, so run them at once: on a big project this
  // is the difference between finishing inside a serverless timeout and not.
  const [openWalk, closedWalk] = await Promise.all([
    // Oldest-first: if we hit the cap, the pull requests we skip are the newest,
    // which keeps every "older than 30/90 days" count exact.
    walk(["OPEN"], { field: "CREATED_AT", direction: "ASC" }, caps.open, (count, total) => {
      openFetched = count;
      openTotal = total;
    }),
    walk(["CLOSED", "MERGED"], { field: "UPDATED_AT", direction: "DESC" }, caps.closed, (count, total) => {
      closedFetched = count;
      closedTotal = total;
    }),
  ]);

  const pulls = [...openWalk.pulls, ...closedWalk.pulls];

  return {
    meta,
    pulls,
    writeAccess: (r.assignableUsers?.nodes ?? []).flatMap((n) => (n?.login ? [n.login] : [])),
    sample: buildSample("graphql", pulls, {
      openFetched,
      openTotal,
      openTruncated: openWalk.truncated,
      closedFetched,
      closedTotal,
      closedTruncated: closedWalk.truncated,
    }),
  };
}

async function collectViaRest(owner: string, repo: string, note: Note): Promise<CollectResult> {
  note("repo", `Looking up ${owner}/${repo}`);
  const r = await rest<RestRepo>(`/repos/${owner}/${repo}`, owner, repo);

  let openPrTotal: number | null = null;
  try {
    const search = await rest<{ total_count: number }>(
      `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} is:pr is:open`)}&per_page=1`,
      owner,
      repo,
    );
    openPrTotal = search.total_count;
  } catch {
    openPrTotal = null; // Search is rate-limited hardest; the sample still works without it.
  }

  const meta: RepoMeta = {
    owner,
    name: r.name,
    nameWithOwner: r.full_name,
    description: r.description,
    url: r.html_url,
    homepageUrl: r.homepage,
    avatarUrl: r.owner?.avatar_url ?? null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    isArchived: r.archived,
    isFork: r.fork,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    language: r.language,
    license: r.license?.spdx_id ?? null,
    openPrTotal,
    mergedPrTotal: null,
    closedPrTotal: null,
    openIssues: typeof r.open_issues_count === "number" ? r.open_issues_count : null,
    goodFirstIssues: null,
    helpWantedIssues: null,
    hasContributing: false,
    hasCodeOfConduct: false,
    hasDiscussions: Boolean(r.has_discussions),
  };

  const pulls: PullRecord[] = [];
  const openPages = CAPS.rest.open / 100;
  let openFetched = 0;
  let openTruncated = false;
  for (let page = 1; page <= openPages; page++) {
    const batch = await rest<RestPull[]>(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=100&sort=created&direction=asc&page=${page}`,
      owner,
      repo,
    );
    batch.forEach((pr) => pulls.push(normaliseRest(pr)));
    openFetched += batch.length;
    note("open", "Reading open pull requests", openFetched, openPrTotal);
    if (batch.length < 100) break;
    if (page === openPages) openTruncated = true;
  }

  const closedPages = CAPS.rest.closed / 100;
  let closedFetched = 0;
  let closedTruncated = false;
  for (let page = 1; page <= closedPages; page++) {
    const batch = await rest<RestPull[]>(
      `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc&page=${page}`,
      owner,
      repo,
    );
    batch.forEach((pr) => pulls.push(normaliseRest(pr)));
    closedFetched += batch.length;
    note("closed", "Reading resolved pull requests", closedFetched, CAPS.rest.closed);
    if (batch.length < 100) break;
    if (page === closedPages) closedTruncated = true;
  }

  return {
    meta,
    pulls,
    writeAccess: [],
    sample: buildSample("rest", pulls, {
      openFetched,
      openTotal: openPrTotal,
      openTruncated,
      closedFetched,
      closedTotal: null,
      closedTruncated,
    }),
  };
}

function buildSample(
  mode: "graphql" | "rest",
  pulls: PullRecord[],
  counts: Omit<SampleInfo, "mode" | "botPullsExcluded" | "closedWindowStart">,
): SampleInfo {
  // How far back the resolved sample actually reaches. The walk takes the most
  // recently *updated* resolved pull requests, so everything touched since the
  // oldest updatedAt in hand is present — and a merge touches its pull request.
  // Neither createdAt nor closedAt works here: one ancient pull request closed
  // or relabelled yesterday would claim a year of coverage we do not have.
  const closed = pulls.filter((p) => p.closedAt);
  const oldest = closed.reduce<string | null>(
    (acc, p) => (acc === null || p.updatedAt < acc ? p.updatedAt : acc),
    null,
  );
  return {
    mode,
    ...counts,
    botPullsExcluded: pulls.filter((p) => p.isBot).length,
    closedWindowStart: oldest,
  };
}
