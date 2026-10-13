# Public review boundaries

The public demonstrator should be useful to an independent reviewer: runnable code, explicit contracts, known limitations and reproducible checks. It should not imply that proprietary StrikeX production systems are included or already integrated.

## What is intentionally public

- The independent synthetic generator, demo validation rules and illustrative score formula.
- The independent class planner and its public invariants: capacities, manual exclusions and no consecutive station repetition; no universal station coverage requirement.
- Account/guest isolation, unit role enforcement, retry behavior, atomic ledger operations and relevant tests.
- Demo schemas, tracked migrations, receipt formats, checksum algorithms and Solana Devnet Memo integration.
- The difference between private manual declarations, shared unit rehearsals, synthetic sessions and proposed physical evidence.
- Approved presentation assets used by the public interface, with provenance in [brand identity](brand-identity.md).

Public does not mean production-calibrated. The example formula and planner must remain labeled as demonstrative when copied into slides or documentation.

## What stays outside this repository

| Private material | Public interface that can be discussed |
|---|---|
| Production Solver source, detailed internal weighting and scheduling strategies | Allocation request/result schema, version, capacity and compatibility invariants |
| Sensor firmware, device secrets and manufacturing details | Versioned evidence envelope, enrollment/revocation behavior and validation outcomes |
| Calibration procedures, labeled raw datasets and production scoring internals | Defined metric meaning, result version and independently supported validation evidence |
| Real athlete identifiers, biometric streams and operational rosters | Synthetic fixtures and redacted examples with opaque references |
| Signing keys, credentials and private infrastructure identifiers | Required configuration names and deployment boundaries |
| Confidential commercial strategy, investor terms and internal brand source documents | Approved product narrative and public brand assets |

This is a disclosure boundary, not a reason to hide the algorithm actually used by the demo. Reviewers can inspect all executable demo rules. Production internals should be introduced through a reviewed adapter rather than pasted into this repository.

## Claim discipline

| Use | Avoid unless independently established |
|---|---|
| “Synthetic training events validated by the server” | “Physical effort verified” |
| “One credit per session ID within its account/guest scope” | “Fraud-proof rewards” or “one human, one reward” |
| “Demo JAB in the application database” | “JAB token minted on Solana” |
| “Optional Devnet Memo integration” | “Mainnet settlement is live” |
| “Digest matches this serialized declaration” | “Hash proves the athlete or issuer is authentic” |
| “Shared roster and server class clock” | “Attendance automatically verified” |
| “Independent demonstration planner” | “Production Solver integrated” |

A confirmed Memo publishes the supplied commitment. It does not certify sensor provenance, athletic performance or a business entitlement. The current sponsor is ephemeral and faucet-dependent; confirmation should be shown only after the implementation verifies the transaction.

## Before publishing an increment

1. Check that screen labels, pitch and repository describe the same actual state.
2. Keep examples synthetic and exclude private source documents, raw invitation codes, keys and real account/athlete identifiers.
3. Verify that newly exported records contain only the intended public or owner-authorized fields.
4. Preserve the distinction between local lab checks, server-persisted operations and observed chain confirmation.
5. Record test commands and remaining acceptance limits, without treating a build as a browser or live-chain test.

The existing ownership statement is in [README](../README.md). This document adds no license or legal grant.
