# StrikeX · Proof of Effort

**A CombatFit experience with an inspectable path from synthetic training events to a saved result, demo JAB and an optional Solana Devnet receipt.**

[Open the app](https://strikex-proof-of-effort.lemos10.chatgpt.site) · [Guided onboarding](https://strikex-proof-of-effort.lemos10.chatgpt.site/?guide=1) · [90-second walkthrough](docs/DEMO-WALKTHROUGH.md) · [Pitch EN / PT](docs/PITCH.md)

The interface and onboarding support **English and Portuguese**; switch language in the top bar. No wallet is required. Use a guest profile for the individual demo or sign in through Sites for account history and shared unit rehearsals.

## What you can evaluate

1. Run or fast-forward the accelerated 72-second, 12-round CombatFit replay.
2. Inspect the server-calculated result, persisted event payload and SHA-256 digest.
3. Replay the same accepted session: the server returns the saved record without adding JAB again.
4. Redeem a fictional benefit against the server's demo balance.
5. Request a Devnet Memo receipt and inspect the actual returned status.
6. Explore separate class planning, coach controls and account-linked unit rehearsals.

**The telemetry is synthetic. The points and benefits are fictional. A recorded digest does not prove that someone exercised.** The browser does not determine the credited score or balance. Public RPC/faucet failure does not invalidate the saved session. No successful live Devnet transaction is claimed by the development checks; see [Solana evidence and limitations](docs/SOLANA.md).

## Implemented versus proposed

| Implemented in this prototype | Proposed production capability |
|---|---|
| Synthetic inputs; server validation and illustrative scoring | Enrolled devices, authenticated telemetry, calibrated physical measurement |
| Durable per-account/guest history; atomic session credit and redemption rules | Operational rewards ledger, abuse controls and benefit fulfilment |
| SHA-256 session digest; optional Devnet Memo integration | Durable sponsorship and selected production settlement design |
| Account-linked units, role checks and shared rehearsal clocks | Authorized attendance closeout and evidence-linked participation |
| Independent capacity-constrained demo planner | Integration with the proprietary production Solver |

There is **no SPL JAB token, mainnet deployment, custom Solana program or physical antifraud claim**. Shared classes and private class reports do not credit JAB or submit chain transactions. The lab labels local rule checks separately from server replay checks.

## Architecture and review map

| Read | Purpose |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Current data paths, trust boundaries, authorization and target design |
| [Implementation](docs/IMPLEMENTATION.md) | Payloads, persistence, concurrency and stage details |
| [Public boundaries](docs/PUBLIC-BOUNDARIES.md) | What reviewers can inspect and what remains proprietary |
| [MVP roadmap](docs/ROADMAP.md) | Dependencies and measurable acceptance gates |
| [Onboarding](docs/onboarding.md) | Role-specific guide and visual acceptance |

Code starts in `app/page.tsx` and `components/strikex/`. Domain rules are in `lib/`; HTTP authorization and persistence are in `app/api/`; schema and migrations are in `db/` and `drizzle/`. `tests/` covers domain behavior, route handlers and SQLite invariants. The architecture map links each flow to its source.

## Run and verify

Use **Node 24**, pnpm and Python 3. The application runs React/Vinext on a Cloudflare Worker with a D1 database. This checkout retains its Sites build integration.

```sh
pnpm install
pnpm run check
pnpm run build
```

`check` runs TypeScript, the Node test suite and the Python SQLite invariant suites. A passing build or mocked RPC test is not a completed browser sign-in, physical sensor test or confirmed on-chain transaction. Follow the [walkthrough](docs/DEMO-WALKTHROUGH.md) for user acceptance and failure-state checks.

The managed deployment applies tracked D1 migrations and binds the database as `DB`. For an independent Cloudflare deployment, supply that binding and apply `drizzle/*.sql` before serving requests. The exported `.openai/hosting.json` omits the private hosting project ID; configure your own deployment before publishing.

Native ChatGPT sign-in is provided by Sites dispatch. Independent hosting must implement a trusted identity adapter before enabling account mode; **never trust identity headers supplied directly by a browser**. Receipt sponsorship uses an ephemeral server-only key funded by the public Devnet faucet, not production custody.

## Data ownership and limits

Account history follows the server-resolved Sites identity. Guests use a separate HttpOnly cookie; clearing it loses access to their history. Guest and account records do not merge automatically. Reset removes only the current scope's demo profile, sessions and redemptions; it preserves private class records, reports, units and memberships, and cannot erase a public chain record.

Each scope stores up to 30 individual demo sessions. Benefits can be redeemed once each. Test units have separate role and capacity limits documented in [Implementation](docs/IMPLEMENTATION.md). The prototype is not hardened against automated creation of many guest profiles.

## Provenance and ownership

The standalone demonstrator began on October 12, 2026 with AI coding assistance. The StrikeX business, hardware concept, brand and broader fitness product predate it. Existing proprietary Strike OS and sensor firmware are not represented as newly built hackathon code. Framework and UI scaffolding use pre-existing dependencies; the commit history records this implementation.

Copyright 2026 IRON GUARDIAN - LDA. Public availability of this demonstrator does not grant rights to StrikeX branding, proprietary hardware, firmware or production software. No additional open-source license is granted here.
