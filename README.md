# goodfirstrepos

**Is this repo worth contributing to?** Paste a GitHub repository and find out what actually happens to pull requests from outside the core team — how many land, how long they wait, and how much of the queue has quietly rotted.

Enthusiasm is cheap; a weekend is not. This exists because "1,209 open PRs, 958 from outsiders, ~3% of merges from outside" is a thing you want to know *before* you spend three evenings on a patch.

## What it measures

| | |
|---|---|
| **Outsider share of merges** | Of everything merged, how much was written by people without commit rights |
| **Outsider acceptance rate** | Of outside pull requests that got a decision, how many were merged — next to the core team's own rate |
| **Time to first reply** | Median wait for the first human response, with unanswered pull requests counted at their current age |
| **Backlog rot** | How much of the open outside queue is past 30, 90 and 180 days |
| **Queue movement** | Outside merges in the last 90 days against the outside backlog |
| **Welcome mat** | Contributing guide, good first issues, recent activity |

Those six roll up into a score out of 100 and a letter grade. Anything that can't be measured for a given repo is dropped and the rest are rescaled, so the score never rests on a number that isn't there.

## How it decides who is "outside"

This is the part that is easy to get wrong. GitHub's `authorAssociation` reports `CONTRIBUTOR` for any maintainer whose organisation membership is private, which can inflate the outsider merge share by a factor of two or more.

So membership is established from three signals, unioned:

1. `authorAssociation` of `OWNER`, `MEMBER` or `COLLABORATOR`
2. everyone GitHub lists as assignable on the repository (write access)
3. everyone who has pressed the merge button, which nobody can do without write access

Membership is tracked per person, not per pull request, so a maintainer's early work counts as inside rather than flattering the outsider numbers. Bots (Dependabot, Renovate and friends) are stripped out entirely — a project that merges 400 dependency bumps a month is not thereby welcoming.

**Without a token none of those signals are available**, so the app does not guess. It shows the backlog facts it can stand behind and says what a token would add.

## Sampling

- **Open pull requests** are walked oldest-first, so the "older than 30/90 days" counts stay exact even on projects with thousands of them. Only the newest arrivals are ever estimated, and they are labelled when they are.
- **Resolved pull requests** are the most recently updated 400 (1,000 with deep scan).
- Everything runs per request. Nothing is stored, and no results are cached between visitors.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

A GitHub token is optional but strongly recommended: unauthenticated requests are capped at 60 an hour and carry none of the write-access signals above. Either paste one into the UI — it is kept in `localStorage` and sent straight to GitHub on your behalf — or set it server-side:

```bash
echo "GITHUB_TOKEN=ghp_yourtoken" > .env.local
```

A classic read-only token with **no scopes ticked** is enough for public repositories.

> Note: a server-side `GITHUB_TOKEN` is used for *every* visitor to that deployment. On a public deployment, leave it unset and let people bring their own.

## API

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"repo":"sst/opencode","deep":false}'
```

Responds with a stream of newline-delimited JSON: `{"type":"progress",…}` events while it reads, then one `{"type":"result","data":{…}}` or `{"type":"error",…}`.

## Built with

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · the GitHub GraphQL and REST APIs. No chart library — the visualisations are hand-rolled SVG on a palette validated for colour-vision deficiency separation and contrast.

## Licence

MIT
