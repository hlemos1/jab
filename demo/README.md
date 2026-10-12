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

## Actual scope

| Implemented | Simulated / not implemented |
|---|---|
| Responsive React interface; English/Portuguese | SINAPSE sensor events, effort, accuracy and intensity |
| Server-side schema, sequence and round validation | Calibrated physical effort measurement or physical antifraud |
| Native Sites account sign-in, editable profile, per-account D1 history; separate guest mode | Coach roles, class membership and production participation |
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
pnpm run build
```

The managed deployment applies tracked D1 migrations and binds the database as `DB`. For an independent Cloudflare deployment, provide a D1 database binding and apply `drizzle/*.sql` before serving requests. The GitHub export omits the managed Site project ID; configure your own deployment identity and D1 binding.

Native ChatGPT sign-in is provided by Sites dispatch; independent hosting must supply a trusted identity adapter and must not trust client-supplied identity headers. No real wallet, payment credentials or separate email service are needed. Receipt sponsorship uses an ephemeral server-only key funded only by the public Devnet faucet. This is a demo convenience, not production custody or a guaranteed available sponsorship service.

## Data and limits

Signed-in records are scoped to the stable Sites user identity and can be recovered by signing into the same account on another device. Guest records remain scoped to a random HttpOnly cookie; clearing it loses guest access. Guest and account histories are separate and never merged automatically. **Reset demo** deletes only the current scope’s demonstration profile, sessions and points; account sign-in stays active. Display names never enter the on-chain memo. Each profile is limited to 30 stored sessions; benefits are redeemable once each. There is no value associated with balances. This public prototype is not hardened against automated creation of many guest profiles.

## Ownership

Copyright 2026 IRON GUARDIAN - LDA. Public availability of this demonstrator does not grant rights to StrikeX branding, proprietary hardware, firmware or production software. No additional open-source license is granted here.

## Current delivery

Stage 1: athlete account and profile, with visual validation pending. See `docs/STAGE-01-ACCEPTANCE.md`. Class operations, production Solver integration and coach permissions remain later deliveries.
