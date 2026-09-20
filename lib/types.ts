export type Association =
  | "OWNER"
  | "MEMBER"
  | "COLLABORATOR"
  | "CONTRIBUTOR"
  | "FIRST_TIME_CONTRIBUTOR"
  | "FIRST_TIMER"
  | "MANNEQUIN"
  | "NONE";

/** A pull request, normalised across the GraphQL and REST paths. */
export interface PullRecord {
  number: number;
  title: string;
  url: string;
  author: string | null;
  avatarUrl: string | null;
  isBot: boolean;
  association: Association;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  isDraft: boolean;
  /** Whoever pressed merge — by definition someone with write access. */
  mergedBy: string | null;
  /** First comment or review left by anyone other than the PR author. */
  firstResponseAt: string | null;
  additions: number | null;
  deletions: number | null;
}

export interface RepoMeta {
  owner: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  avatarUrl: string | null;
  stars: number;
  forks: number;
  isArchived: boolean;
  isFork: boolean;
  createdAt: string | null;
  pushedAt: string | null;
  language: string | null;
  license: string | null;
  openPrTotal: number | null;
  mergedPrTotal: number | null;
  closedPrTotal: number | null;
  openIssues: number | null;
  goodFirstIssues: number | null;
  helpWantedIssues: number | null;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasDiscussions: boolean;
}

export interface SampleInfo {
  mode: "graphql" | "rest";
  openFetched: number;
  openTotal: number | null;
  openTruncated: boolean;
  closedFetched: number;
  closedTotal: number | null;
  closedTruncated: boolean;
  botPullsExcluded: number;
  /** Oldest createdAt present in the closed sample — the window the merge stats cover. */
  closedWindowStart: string | null;
}

export interface Criterion {
  id: string;
  label: string;
  question: string;
  points: number;
  max: number;
  available: boolean;
  detail: string;
  hint: string;
}

export interface PullSummary {
  number: number;
  title: string;
  url: string;
  author: string | null;
  createdAt: string;
  mergedAt: string | null;
  ageDays: number;
  firstResponseHours: number | null;
  association: Association;
}

export interface Analysis {
  repo: RepoMeta;
  sample: SampleInfo;
  score: {
    /** False when we could not tell core team from outsider (no token). */
    available: boolean;
    total: number;
    grade: "A" | "B" | "C" | "D" | "F";
    headline: string;
    verdict: string;
    criteria: Criterion[];
  };
  backlog: {
    open: number;
    openOutside: number;
    openInside: number;
    openDraft: number;
    over30: number;
    over90: number;
    over180: number;
    medianOpenAgeDays: number | null;
    unanswered: number;
  };
  outcomes: {
    outside: { merged: number; closed: number; open: number; total: number };
    inside: { merged: number; closed: number; open: number; total: number };
    mergedTotal: number;
    mergedOutside: number;
    outsideShareOfMerges: number | null;
    outsideAcceptance: number | null;
    insideAcceptance: number | null;
    closedUnmergedTotal: number;
    /** Distinct outside authors who tried in this sample. */
    authorsTried: number;
    /** …and how many of them have ever had one merged here. */
    authorsLanded: number;
    /** Outside pull requests closed unmerged whose author never landed anything. */
    neverLandedClosed: number;
  };
  responsiveness: {
    medianFirstResponseHours: number | null;
    p90FirstResponseHours: number | null;
    medianMergeDays: number | null;
    neverAnsweredShare: number | null;
    sampleSize: number;
  };
  ageBuckets: { label: string; count: number; estimated: boolean }[];
  trend: { month: string; outsideMerged: number; insideMerged: number; outsideOpened: number }[];
  oldestOpenOutside: PullSummary[];
  recentOutsideMerges: PullSummary[];
  flags: string[];
  generatedAt: string;
}

export type StreamEvent =
  | { type: "progress"; stage: string; message: string; fetched?: number; total?: number | null }
  | { type: "result"; data: Analysis }
  | { type: "error"; message: string; code?: string };
