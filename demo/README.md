# StrikeX · Proof of Effort Demo

A working, deliberately bounded web prototype for the Colosseum 2026 submission.

**Live demo:** https://strikex-proof-of-effort.lemos10.chatgpt.site

## Try the loop

1. Choose English or Portuguese. Open **My account** and sign in with ChatGPT, or continue with a separate guest profile.
2. Start the accelerated 72-second CombatFit replay: six station types and 12 rounds without consecutive station repetition. The example journey is illustrative; no universal coverage is required. You may skip the animation.
3. The server validates synthetic events, calculates an illustrative score and credits demo JAB once per session.
4. Inspect the session digest and request an optional Solana Devnet receipt.
5. Redeem a fictional guest pass for 10 demo JAB or gear credit for 25. Nothing is purchased or booked.
6. Open the technical lab to test valid, inconsistent and replayed sessions.
7. In Class, save a class plan, open Coach panel and prepare a timed demo. Start, pause, reload and resume the server-backed 12-round clock.
8. After a class ends, review each athlete as complete, partial or absent. Confirm the demo closeout, inspect the immutable receipt, verify its checksum and export JSON.
9. Open **Unit & Team**, sign in, create a test unit and generate a single-use coach or athlete invitation. Accept it with another account to inspect role-specific access.
10. Open **Unit classes**, select active athlete members and prepare a shared rehearsal. Managers and coaches control the server clock; each athlete sees only their own sequence.

## Actual scope

| Implemented | Simulated / not implemented |
|---|---|
| Responsive React interface; English/Portuguese | SINAPSE sensor events, effort, accuracy and intensity |
| Server-side schema, sequence and round validation | Calibrated physical effort measurement or physical antifraud |
| Native Sites account sign-in, editable profile, per-account D1 history; separate guest mode; test-unit manager/coach/athlete membership and shared rehearsals | Verified attendance, account-linked closeout and production participation |
| Atomic session-credit deduplication and benefit redemption | SPL JAB token, transferable balance or real benefit fulfilment |
| SHA-256 digest of canonical session data and result | Production STRIKE score (this demo has an explicit illustrative formula) |
| Real Memo transaction construction, signing, submission and verification code for Solana Devnet | Mainnet deployment, custom Solana program, hardware attestation |

A blockchain receipt records a statement about **synthetic** telemetry. It does not prove a person exercised. Solana confirmation is only displayed after RPC retrieval verifies a successful transaction containing the exact expected memo. A faucet or RPC failure leaves the app usable and displays pending/unavailable instead of fabricated confirmation. Devnet history can reset.

## Development history

This standalone demonstrator was built on October 12, 2026 with AI coding assistance. The StrikeX business, hardware concept, brand and broader fitness product predate this prototype. No pre-existing proprietary Strike OS or sensor firmware is represented as newly built hackathon code. Framework and UI scaffolding use pre-existing dependencies. This repository's commit history records this implementation; the team must describe its contributions accurately in the competition submission.

## Code map

- `app/page.tsx`, `app/globals.css`: athlete experience and technical lab.
- `components/strikex/`: account page, arena art, shared types, stations and EN/PT copy.
- `lib/identity.ts`, `app/chatgpt-auth.ts`: server identity and isolated demo scopes.
- `lib/units.ts`, `app/api/units/route.ts`, `components/strikex/units-page.tsx`: account-linked test units, team access and single-use invitations.
- `lib/class-planner.ts`, `app/api/classes/route.ts`: bounded class allocation and scope-owned saved plans.
- `lib/class-run.ts`, `app/api/class-runs/route.ts`, `components/strikex/coach-page.tsx`: server-authoritative class timing and owner-scoped demo controls.
- `lib/class-report.ts`, `app/api/class-reports/route.ts`, `components/strikex/class-reports-panel.tsx`: manual demo closeout, canonical checksums and immutable receipts.
- `lib/unit-classes.ts`, `app/api/unit-classes/route.ts`, `components/strikex/unit-classes-page.tsx`: shared unit rehearsals with member-linked rosters and role-filtered responses.
- `lib/effort.ts`: deterministic generator and untrusted-input validation.
- `app/api/demo/route.ts`: account/guest API, digest generation, atomic writes and receipt lifecycle.
- `lib/solana.ts`: zero-dependency Ed25519 signing, legacy Memo serialization and RPC verification.
- `db/schema.ts`, `drizzle/`: durable demo profile, session and redemption schema.
- `tests/`: engine, chain-verification and SQLite invariant tests.
- `docs/`: architecture and receipt limitations.

## Run the source

Requires Node 22.13+ (Node 24 recommended), pnpm and Python 3 for SQLite tests. The app uses React/Vinext on a Cloudflare Worker and D1. This checkout retains its Sites build integration.

```sh
pnpm install
pnpm exec tsc --noEmit --incremental false
node --test tests/*.test.ts
python3 tests/db_invariants.py
python3 tests/classes_db_invariants.py
python3 tests/class_runs_db_invariants.py
python3 tests/class_reports_db_invariants.py
python3 tests/units_db_invariants.py
pnpm run build
```

The managed deployment applies tracked D1 migrations and binds the database as `DB`. For an independent Cloudflare deployment, provide a D1 database binding and apply `drizzle/*.sql` before serving requests. The exported `.openai/hosting.json` omits the private hosting project ID; configure your own deployment before publishing.

Native ChatGPT sign-in is provided by Sites dispatch; independent hosting must supply a trusted identity adapter and must not trust client-supplied identity headers. No real wallet, payment credentials or separate email service are needed. Receipt sponsorship uses an ephemeral server-only key funded only by the public Devnet faucet. This is a demo convenience, not production custody or a guaranteed available sponsorship service.

## Data and limits

Signed-in records are scoped to the stable Sites user identity and can be recovered by signing into the same account on another device. Guest records remain scoped to a random HttpOnly cookie; clearing it loses guest access. Guest and account histories are separate and never merged automatically. **Reset demo** deletes only the current scope’s demonstration profile, sessions and points; account sign-in stays active. Display names never enter the on-chain memo. Each profile is limited to 30 stored sessions; benefits are redeemable once each. There is no value associated with balances. This public prototype is not hardened against automated creation of many guest profiles.

## Ownership

Copyright 2026 IRON GUARDIAN - LDA. Public availability of this demonstrator does not grant rights to StrikeX branding, proprietary hardware, firmware or production software. No additional open-source license is granted here.

## Current delivery

Stage 1: athlete account and profile, visually accepted by the user. Stage 2: server-generated and saved demonstration class plans for up to 11 athletes, station exclusions, 12 rounds, round/matrix/athlete views. Stage 3: own-class demo coaching with start/pause/resume/interrupt, server time, persistent snapshots and conflict-safe commands. Stage 4: manual demonstration participation review and immutable closeout receipts with export and checksum verification. Stage 5: account-linked test units, manager/coach/athlete roles and invitations. Stage 6: shared rehearsal classes with account-linked rosters, role-authorized controls and private athlete sequences. See `docs/STAGE-06-ACCEPTANCE.md` for visual acceptance. Production Solver integration, authorized account-linked closeout and physical telemetry remain later deliveries. Automated verification: 105 TypeScript tests and 34 SQLite invariant tests.

## Class planner boundaries

The Turma/Class tab generates a demonstration schedule with fixed capacities 3/3/2/1/1/1, no consecutive station repetition and manual per-athlete exclusions. There is no all-station coverage requirement. The full 12-round plan is computed on the server and stored before it is shown. Plans are private to the current account/guest scope, capped at 20, and removable individually. Viewing a plan does not run a class or award JAB. The production Solver’s weekly history, category and protection rules are not integrated.

## Coach demo boundaries

Each account/guest scope may have one open class and 20 saved runs. The default rehearsal is 94 seconds (12 × 6 seconds of work + 11 × 2 seconds of rest). Reloading does not pause a running class. Commands use server time and an observed revision; stale commands cannot rewind a run. Completed/interrupted runs cannot resume and can be deleted individually. Saved runs preserve the original class snapshot even if the plan is deleted. These records do not generate points or prove physical effort. Unit roles do not grant access to another person's private demo classes. Shared unit classes use their own API and records. Reset demo does not delete class plans or runs.

## Class closeout boundaries

Saved reports are owner-scoped `demo_declared` records, not athlete account attestations or sensor evidence. Every roster member must be reviewed explicitly. Partial participation cannot exceed fully elapsed work rounds. One report per class; matching retries recover the original, changed declarations conflict. Reports contain a complete snapshot and survive deletion of the original run/plan. Up to 100 reports per scope; no report deletion or correction workflow yet. Reset demo preserves reports. No points, physical score or Solana transaction is created by closeout.

The report checksum is SHA-256 of UTF-8 canonical payload JSON (object keys sorted recursively, arrays preserved). `verifyReport()` checks envelope, schema and checksum. This is integrity verification against the saved digest, not an issuer signature.

## Unit and team boundaries

Authenticated accounts can own one test unit and join up to ten other units. Creating a test unit does not register an official StrikeX venue or grant global administration. The manager controls invitations and coach/athlete roles; coaches can view the roster; athletes see only their own membership. Display names are supplied by users and do not establish physical identity. Earlier personal classes, reports, sessions and balances remain private to their original scopes. Shared unit rehearsals are described below.

Single-use invitation codes expire after seven days. Whoever holds a code can accept its selected role, so share it only with the intended recipient. The raw code is shown only on creation and never stored server-side; the database retains its SHA-256 hash. A lost response cannot recover the code: revoke that invitation and create another. There are 50 people per unit including its manager, 10 available invitations and 100 invitations total per unit. Membership removal or voluntary departure requires a new invitation to rejoin; a used code cannot reactivate access. Stable member IDs survive legitimate reentry. There is no unit deletion, rename, ownership transfer or invitation archive in this stage. Reset demo preserves units and memberships.

## Shared unit rehearsal boundaries

Managers and current coaches can create a unit class from one to eleven currently active members with the athlete role. The server resolves their names and persists stable membership IDs, the complete generated plan and timing as an immutable snapshot. Per-athlete station exclusions follow the same independent demo planner. Guests, arbitrary names and foreign-unit members cannot enter this roster.

A unit can have one active rehearsal and twenty saved records. Managers/coaches can start, pause, resume, interrupt and delete terminal records. Roles and roster eligibility are rechecked at write time, and revisions prevent competing commands from rewinding the shared clock. Athletes receive only classes containing their own membership and only their own name/sequence. Removal or departure revokes access on subsequent requests; rejoining restores own historical access through the stable member ID.

Class names are shared with selected athletes, so use a neutral class title. Clock completion is not an attendance declaration. No automatic closeout, reservation, check-in, physical measurement, points or on-chain receipt is created. The next stage adds explicit participation review and actor-attributed records. Reset demo preserves unit rehearsals.
