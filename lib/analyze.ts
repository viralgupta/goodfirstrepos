import { formatHours } from "./format";
import type { Analysis, Criterion, PullRecord, PullSummary, RepoMeta, SampleInfo } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const INSIDER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = clamp(p, 0, 1) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Who counts as inside the tent. Author association alone is not enough: a
 * maintainer whose org membership is private shows up as CONTRIBUTOR. So we
 * also take everyone GitHub says is assignable (write access) and everyone who
 * has pressed the merge button, which nobody can do without it. Membership is
 * per person, not per pull request, so a maintainer's early work counts as
 * inside too rather than flattering the outsider numbers.
 */
function insiderLogins(pulls: PullRecord[], writeAccess: string[]): Set<string> {
  const logins = new Set<string>(writeAccess);
  for (const p of pulls) {
    if (p.author && INSIDER_ASSOCIATIONS.has(p.association)) logins.add(p.author);
    if (p.mergedBy) logins.add(p.mergedBy);
  }
  return logins;
}

function summarise(p: PullRecord, now: number): PullSummary {
  const created = Date.parse(p.createdAt);
  const end = p.closedAt ? Date.parse(p.closedAt) : now;
  return {
    number: p.number,
    title: p.title,
    url: p.url,
    author: p.author,
    createdAt: p.createdAt,
    mergedAt: p.mergedAt,
    ageDays: Math.floor((end - created) / DAY),
    firstResponseHours: p.firstResponseAt ? round1((Date.parse(p.firstResponseAt) - created) / HOUR) : null,
    association: p.association,
  };
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function analyse(
  meta: RepoMeta,
  pulls: PullRecord[],
  sample: SampleInfo,
  writeAccess: string[] = [],
): Analysis {
  const now = Date.now();
  const flags: string[] = [];

  const insiders = insiderLogins(pulls, writeAccess);
  const human = pulls.filter((p) => !p.isBot && p.author);
  const isOutside = (p: PullRecord) =>
    !INSIDER_ASSOCIATIONS.has(p.association) && !(p.author && insiders.has(p.author));

  // Telling core team from outsider needs the write-access signals that only the
  // GraphQL path carries. Author association alone misses every maintainer whose
  // org membership is private, which inflates the outsider share to nonsense. So
  // without a token we do not guess: "outside" becomes the whole human queue and
  // every attribution-dependent number is withheld rather than quietly wrong.
  const attribution = sample.mode === "graphql";
  const outside = attribution ? human.filter(isOutside) : human;
  const inside = attribution ? human.filter((p) => !isOutside(p)) : [];

  /* ---------------- open backlog ---------------- */

  const openAll = human.filter((p) => !p.closedAt);
  const openOutside = outside.filter((p) => !p.closedAt);
  const ageDays = (p: PullRecord) => (now - Date.parse(p.createdAt)) / DAY;

  const over30 = openOutside.filter((p) => ageDays(p) > 30).length;
  const over90 = openOutside.filter((p) => ageDays(p) > 90).length;
  const over180 = openOutside.filter((p) => ageDays(p) > 180).length;
  const unanswered = openOutside.filter((p) => sample.mode === "graphql" && !p.firstResponseAt).length;

  // With the open list walked oldest-first, anything we skipped is newer than
  // everything we have, so only the youngest bucket can be short. Top it back up.
  const missingYoung =
    sample.openTruncated && sample.openTotal ? Math.max(0, sample.openTotal - sample.openFetched) : 0;
  const outsideShareOfOpen = openAll.length ? openOutside.length / openAll.length : 1;
  const estimatedYoungOutside = Math.round(missingYoung * outsideShareOfOpen);
  // Everything the page says about the open queue counts the estimated tail, so
  // the rot share cannot disagree with the tile above it.
  const openOutsideTotal = openOutside.length + estimatedYoungOutside;

  const buckets = [
    { label: "Under 7 days", test: (d: number) => d <= 7 },
    { label: "7 to 30 days", test: (d: number) => d > 7 && d <= 30 },
    { label: "30 to 90 days", test: (d: number) => d > 30 && d <= 90 },
    { label: "Over 90 days", test: (d: number) => d > 90 },
  ];
  const ageBuckets = buckets.map((b, i) => ({
    label: b.label,
    count: openOutside.filter((p) => b.test(ageDays(p))).length + (i === 0 ? estimatedYoungOutside : 0),
    estimated: i === 0 && estimatedYoungOutside > 0,
  }));

  /* ---------------- outcomes in the resolved sample ---------------- */

  const resolved = (list: PullRecord[]) => list.filter((p) => p.closedAt);
  const outsideResolved = resolved(outside);
  const insideResolved = resolved(inside);
  const outsideMerged = outsideResolved.filter((p) => p.mergedAt);
  const insideMerged = insideResolved.filter((p) => p.mergedAt);
  const outsideClosedUnmerged = outsideResolved.filter((p) => !p.mergedAt);

  const mergedTotal = outsideMerged.length + insideMerged.length;
  const outsideShareOfMerges = mergedTotal ? outsideMerged.length / mergedTotal : null;
  const outsideAcceptance = outsideResolved.length ? outsideMerged.length / outsideResolved.length : null;
  const insideAcceptance = insideResolved.length ? insideMerged.length / insideResolved.length : null;

  // GitHub's FIRST_TIME_CONTRIBUTOR flag flips the moment someone's work lands,
  // so it cannot answer "how do newcomers fare". Work it out from the sample
  // instead: who tried, and who ever got anything in.
  const outsideAuthors = new Set(outside.map((p) => p.author!).filter(Boolean));
  const landedAuthors = new Set(outsideMerged.map((p) => p.author!).filter(Boolean));
  const neverLandedClosed = outsideClosedUnmerged.filter((p) => p.author && !landedAuthors.has(p.author)).length;

  /* ---------------- responsiveness ---------------- */

  // Outside PRs from the last six months. A PR nobody has answered yet counts
  // at its current age, so silence cannot quietly drop out of the median.
  const recentOutside = outside.filter((p) => now - Date.parse(p.createdAt) < 180 * DAY);
  const waits: number[] = [];
  if (sample.mode === "graphql") {
    for (const p of recentOutside) {
      const created = Date.parse(p.createdAt);
      if (p.firstResponseAt) {
        waits.push((Date.parse(p.firstResponseAt) - created) / HOUR);
      } else {
        const until = p.closedAt ? Date.parse(p.closedAt) : now;
        waits.push((until - created) / HOUR);
      }
    }
  }
  const medianFirstResponseHours = waits.length >= 5 ? round1(median(waits)!) : null;
  const p90FirstResponseHours = waits.length >= 5 ? round1(percentile(waits, 0.9)!) : null;
  const neverAnsweredShare = recentOutside.length && sample.mode === "graphql"
    ? recentOutside.filter((p) => !p.firstResponseAt).length / recentOutside.length
    : null;

  const mergeDays = outsideMerged.map((p) => (Date.parse(p.mergedAt!) - Date.parse(p.createdAt)) / DAY);
  const medianMergeDays = mergeDays.length >= 3 ? round1(median(mergeDays)!) : null;

  /* ---------------- 12 month trend ---------------- */

  const trendMonths: string[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  for (let i = 0; i < 12; i++) {
    trendMonths.unshift(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  // Only months the resolved sample actually covers, or the line lies about a drop-off.
  const windowStart = sample.closedWindowStart ? monthKey(sample.closedWindowStart) : null;
  const coveredMonths = windowStart ? trendMonths.filter((m) => m > windowStart) : trendMonths;
  const trend = coveredMonths.map((month) => ({
    month,
    outsideMerged: outsideMerged.filter((p) => monthKey(p.mergedAt!) === month).length,
    insideMerged: insideMerged.filter((p) => monthKey(p.mergedAt!) === month).length,
    outsideOpened: outside.filter((p) => monthKey(p.createdAt) === month).length,
  }));

  const merged90 = outsideMerged.filter((p) => now - Date.parse(p.mergedAt!) < 90 * DAY).length;

  /* ---------------- score ---------------- */

  const criteria: Criterion[] = [];
  const thinSample = outsideResolved.length < 5;

  criteria.push({
    id: "share",
    label: "Outsider share of merges",
    question: "When something gets merged, is it ever from outside the core team?",
    max: 25,
    available: attribution && mergedTotal >= 5,
    points: outsideShareOfMerges === null ? 0 : clamp(outsideShareOfMerges / 0.4) * 25,
    detail:
      outsideShareOfMerges === null
        ? "No merged pull requests in the sample."
        : `${outsideMerged.length} of ${mergedTotal} merged pull requests (${pct(outsideShareOfMerges)}) came from outside the core team.`,
    hint:
      outsideShareOfMerges !== null && outsideShareOfMerges < 0.1
        ? "Merges here are overwhelmingly internal work."
        : "Outside code is a normal part of what ships.",
  });

  criteria.push({
    id: "acceptance",
    label: "Outsider acceptance rate",
    question: "Of outside pull requests that got a decision, how many were merged?",
    max: 25,
    available: attribution && outsideResolved.length >= 5,
    points: outsideAcceptance === null ? 0 : clamp(outsideAcceptance / 0.6) * 25,
    detail:
      outsideAcceptance === null
        ? "Not enough resolved outside pull requests to judge."
        : `${outsideMerged.length} merged, ${outsideClosedUnmerged.length} closed unmerged (${pct(outsideAcceptance)} accepted)` +
          (insideAcceptance !== null ? `, against ${pct(insideAcceptance)} for the core team.` : "."),
    hint:
      outsideAcceptance !== null && insideAcceptance !== null && insideAcceptance - outsideAcceptance > 0.3
        ? "Outside pull requests are held to a visibly different bar."
        : "Outside and inside pull requests fare similarly.",
  });

  criteria.push({
    id: "response",
    label: "Time to first reply",
    question: "How long does an outside pull request sit before a human answers?",
    max: 20,
    available: medianFirstResponseHours !== null,
    points:
      medianFirstResponseHours === null
        ? 0
        : medianFirstResponseHours <= 24
          ? 20
          : 20 * clamp(1 - Math.log(medianFirstResponseHours / 24) / Math.log(336 / 24)),
    detail:
      medianFirstResponseHours === null
        ? sample.mode === "rest"
          ? "Needs a GitHub token to measure."
          : "Too few recent outside pull requests to measure."
        : `Median ${formatHours(medianFirstResponseHours)} to the first reply` +
          (p90FirstResponseHours !== null ? `, and ${formatHours(p90FirstResponseHours)} for the slowest tenth.` : ".") +
          (neverAnsweredShare !== null && neverAnsweredShare > 0
            ? ` ${pct(neverAnsweredShare)} have had no reply at all.`
            : ""),
    hint:
      medianFirstResponseHours !== null && medianFirstResponseHours > 168
        ? "Expect to wait weeks before anyone looks."
        : "Someone usually shows up reasonably fast.",
  });

  const staleShare = openOutsideTotal ? over90 / openOutsideTotal : 0;
  criteria.push({
    id: "backlog",
    label: "Backlog rot",
    question: "How much of the open outside queue has been abandoned in place?",
    max: 15,
    available: attribution && openOutsideTotal >= 5,
    points: 15 * clamp(1 - (staleShare - 0.05) / 0.45),
    detail: openOutsideTotal
      ? `${over90} of ${openOutsideTotal.toLocaleString()} open outside pull requests (${pct(staleShare)}) are older than 90 days; ${over30} are past 30 days.`
      : "No open outside pull requests.",
    hint:
      staleShare > 0.3
        ? "A large share of the queue is effectively abandoned rather than closed."
        : "The queue is kept reasonably current.",
  });

  const throughput = openOutsideTotal ? merged90 / openOutsideTotal : merged90 > 0 ? 1 : 0;
  criteria.push({
    id: "throughput",
    label: "Queue movement",
    question: "Is the outside queue draining faster than it fills?",
    max: 10,
    available: sample.mode === "graphql",
    points: 10 * clamp(throughput / 0.5),
    detail: `${merged90} outside pull requests merged in the last 90 days against ${openOutsideTotal.toLocaleString()} still open.`,
    hint:
      throughput < 0.1
        ? "New outside pull requests join the queue far faster than they leave it."
        : "The queue moves.",
  });

  const welcomeBits: string[] = [];
  let welcome = 0;
  if (meta.hasContributing) {
    welcome += 2;
    welcomeBits.push("CONTRIBUTING guide");
  }
  if ((meta.goodFirstIssues ?? 0) > 0) {
    welcome += 1.5;
    welcomeBits.push(`${meta.goodFirstIssues} good first issues`);
  }
  const daysSincePush = meta.pushedAt ? (now - Date.parse(meta.pushedAt)) / DAY : null;
  if (daysSincePush !== null && daysSincePush < 30) {
    welcome += 1.5;
    welcomeBits.push("active in the last 30 days");
  }
  criteria.push({
    id: "welcome",
    label: "Welcome mat",
    question: "Has the project done the basics to invite contributions?",
    max: 5,
    available: sample.mode === "graphql",
    points: welcome,
    detail: welcomeBits.length ? welcomeBits.join(", ") + "." : "No contributing guide, no good first issues.",
    hint: welcome >= 3.5 ? "The signposting is there." : "Little signposting for a newcomer.",
  });

  const availableCriteria = criteria.filter((c) => c.available);
  const maxAvailable = availableCriteria.reduce((sum, c) => sum + c.max, 0);
  const earned = availableCriteria.reduce((sum, c) => sum + c.points, 0);
  const total = maxAvailable > 0 ? Math.round((earned / maxAvailable) * 100) : 0;

  criteria.forEach((c) => {
    c.points = round1(c.points);
  });

  const grade: Analysis["score"]["grade"] =
    total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : total >= 35 ? "D" : "F";

  if (meta.isArchived) flags.push("This repository is archived. It accepts nothing.");
  if (sample.openTruncated) {
    flags.push(
      `Open pull requests were read oldest-first up to ${sample.openFetched.toLocaleString()} of ${(sample.openTotal ?? 0).toLocaleString()}, so the staleness counts are exact and only the newest arrivals are estimated.`,
    );
  }
  if (sample.closedTruncated && attribution) {
    flags.push(
      `Merge statistics cover the ${sample.closedFetched.toLocaleString()} most recently updated resolved pull requests, not the project's whole history.`,
    );
  }
  if (!attribution) {
    flags.push(
      "No token, so GitHub would not say who holds write access here. Merge rates, reply times and the score are withheld rather than guessed at.",
    );
  }
  if (thinSample && attribution) flags.push("Very few resolved outside pull requests, so treat this score as a weak signal.");
  if (trend.length < 2 && attribution && sample.closedTruncated) {
    flags.push(
      "This project resolves pull requests faster than the sample reaches back, so there is no honest month-by-month chart to draw. Deep scan reads further.",
    );
  }
  if (sample.botPullsExcluded > 0) {
    flags.push(`${sample.botPullsExcluded.toLocaleString()} bot pull requests were excluded from every figure.`);
  }

  return {
    repo: meta,
    sample,
    score: {
      available: attribution,
      total,
      grade,
      headline: headlineFor(outsideShareOfMerges, outsideMerged.length, mergedTotal, meta),
      verdict: verdictFor(grade, {
        outsideShareOfMerges,
        outsideAcceptance,
        medianFirstResponseHours,
        staleShare,
        openOutside: openOutsideTotal,
      }),
      criteria,
    },
    backlog: {
      open: openAll.length + missingYoung,
      openOutside: openOutsideTotal,
      openInside: openAll.length - openOutside.length,
      openDraft: openOutside.filter((p) => p.isDraft).length,
      over30,
      over90,
      over180,
      medianOpenAgeDays: openOutside.length ? round1(median(openOutside.map(ageDays))!) : null,
      unanswered,
    },
    outcomes: {
      outside: {
        merged: outsideMerged.length,
        closed: outsideClosedUnmerged.length,
        open: openOutsideTotal,
        total: outsideMerged.length + outsideClosedUnmerged.length + openOutsideTotal,
      },
      inside: {
        merged: insideMerged.length,
        closed: insideResolved.length - insideMerged.length,
        open: inside.filter((p) => !p.closedAt).length,
        total: insideResolved.length + inside.filter((p) => !p.closedAt).length,
      },
      mergedTotal,
      mergedOutside: outsideMerged.length,
      outsideShareOfMerges,
      outsideAcceptance,
      insideAcceptance,
      closedUnmergedTotal: outsideClosedUnmerged.length + (insideResolved.length - insideMerged.length),
      authorsTried: outsideAuthors.size,
      authorsLanded: landedAuthors.size,
      neverLandedClosed,
    },
    responsiveness: {
      medianFirstResponseHours,
      p90FirstResponseHours,
      medianMergeDays,
      neverAnsweredShare,
      sampleSize: waits.length,
    },
    ageBuckets,
    trend,
    oldestOpenOutside: [...openOutside]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(0, 8)
      .map((p) => summarise(p, now)),
    recentOutsideMerges: [...outsideMerged]
      .sort((a, b) => Date.parse(b.mergedAt!) - Date.parse(a.mergedAt!))
      .slice(0, 6)
      .map((p) => summarise(p, now)),
    flags,
    generatedAt: new Date().toISOString(),
  };
}

function headlineFor(
  share: number | null,
  outsideMerged: number,
  mergedTotal: number,
  meta: RepoMeta,
): string {
  if (meta.isArchived) return "Archived. Nothing is going to be merged here.";
  if (share === null || mergedTotal < 5) return "Too few merges to read the room.";
  if (share <= 0.001) return "Nothing in the recent sample was merged from outside the core team.";
  if (share >= 0.45) {
    return `${Math.round(share * 100)}% of merged pull requests come from outside the core team (${outsideMerged} of ${mergedTotal}).`;
  }
  const oneIn = Math.round(1 / share);
  return `About 1 in ${oneIn} merged pull requests comes from outside the core team (${outsideMerged} of ${mergedTotal}).`;
}

function verdictFor(
  grade: string,
  d: {
    outsideShareOfMerges: number | null;
    outsideAcceptance: number | null;
    medianFirstResponseHours: number | null;
    staleShare: number;
    openOutside: number;
  },
): string {
  const gripes: string[] = [];
  if (d.outsideShareOfMerges !== null && d.outsideShareOfMerges < 0.1) {
    gripes.push("outside code rarely lands");
  }
  if (d.outsideAcceptance !== null && d.outsideAcceptance < 0.35) gripes.push("most outside attempts are closed unmerged");
  if (d.medianFirstResponseHours !== null && d.medianFirstResponseHours > 168) gripes.push("replies take weeks");
  if (d.staleShare > 0.3) gripes.push("a third of the queue has rotted past 90 days");

  const tail = gripes.length ? ` The drag: ${gripes.join(", ")}.` : "";

  switch (grade) {
    case "A":
      return `An open door. Outside pull requests get read, answered and merged at a healthy rate.${tail}`;
    case "B":
      return `Worth your time. The project does merge outside work, with the usual friction.${tail}`;
    case "C":
      return `Mixed signals. Some outside work lands, but the odds are not in your favour.${tail}`;
    case "D":
      return `Steep climb. Contributing here is mostly a donation of your time.${tail}`;
    default:
      return `Effectively closed to outsiders. Open an issue first and get a maintainer to ask for the patch before you write it.${tail}`;
  }
}
