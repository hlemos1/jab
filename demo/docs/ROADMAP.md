# Roadmap toward a bounded MVP

The current release is a working demonstrator, not a production deployment. Deliver one reviewable increment at a time; user visual acceptance follows the technical checks before advancing to the next product stage. The work below is a proposal and does not imply implementation or a committed delivery date.

## Current baseline

| Available | Boundary |
|---|---|
| Individual replay, result, demo ledger and fictional benefits | Synthetic events and uncalibrated illustrative score |
| Session receipt export and integrity inspection; optional Devnet integration | No physical proof, guaranteed faucet availability or confirmed live-chain claim |
| Private planning, persistent coach clock and manual closeout | Owner-scoped demonstrations; local athlete labels |
| Account-linked units, invitations and shared class clocks | Role-protected rehearsals; no shared attendance closeout or points |
| Branded PT/EN interface and role-specific onboarding | Guide progress is browser-local and grants no permissions |
| Public architecture, pitch and executable checks | Production Solver, firmware and scoring are outside the repository |

## Delivery gates

| Increment | Outcome | Required evidence before acceptance |
|---|---|---|
| **Next: authorized unit closeout** | Explicit participation review for an ended shared unit class, attributed to its authorized actor | Current manager/coach authority checked at write time; roster uses saved stable membership IDs; complete/partial/absent is explicitly reviewed; identical retries return one immutable report; changed submissions conflict; each athlete reads only their own participation. No automatic JAB. |
| **Corrections and operational reliability** | Recoverable operations and accountable correction history | Correction appends an actor/reason-linked record instead of overwriting history; concurrent command and revocation races tested; interrupted requests recover after reload; backup/restore drill passes; request limits and retention/deletion behavior documented and tested. |
| **Sensor ingestion pilot** | One enrolled device produces authenticated evidence tied to an authorized session | Versioned envelope and server-issued challenge; replayed/out-of-session/revoked-device events rejected; disconnect and reconnect recovery demonstrated; comparison against labeled physical observations records errors and agreed acceptance thresholds before evaluation. |
| **Versioned evaluation and Solver adapter** | Demonstration substitutes are replaced through explicit contracts | Allocation preserves approved capacity/exclusion/repetition invariants; production Solver remains private; calibrated metric definitions and evaluation version recorded; regression fixtures cover allowed and rejected physical patterns; independent sign-off on supported claims. |
| **Reward policy and audit ledger** | Accepted evidence can create a controlled entitlement | Policy defines eligibility, limits and review states; synthetic inputs cannot enter the operational ledger; idempotency spans session and policy version; concurrent reward/redemption and correction behavior tested; fulfilment failure is recoverable without duplicate issuance. |
| **Durable Solana receipt pilot** | Receipt confirmation survives process restarts and provider failures | Managed signer and funding policy; durable submission/confirmation recovery; saved candidate before broadcast; retry/expiry handling; at least one actual test-network transaction linked to its exact saved commitment and independently verified. |
| **Limited user pilot** | An end-to-end operational flow is accepted with test participants | Native sign-in and recovery tested with distinct accounts; manager/coach/athlete access verified; mobile/keyboard and connection-loss acceptance completed; data handling and support/runbook agreed; every public production claim maps to evidence. |

The next closeout increment remains off-chain and does not introduce financial rewards. Later reward or settlement design requires a separate explicit product decision; no mainnet migration or SPL issuance is assumed by this roadmap.

## Dependency rules

- Membership and a finished class clock establish context, not attendance. Authorized participation must be recorded explicitly.
- A participation declaration establishes what an authorized actor reported, not sensor-measured effort. Device evidence is a separate gate.
- Device signatures establish origin/integrity under their key model, not automatically physiological truth. Calibration and adversarial validation remain necessary.
- A receipt can be piloted independently, but operational rewards require validated evidence and an approved policy first.
- The public repository exposes contracts and evidence of behavior while proprietary implementation remains behind reviewed adapters.

## Acceptance record for each delivery

Record scope, changed contracts, migration impact, commands run, observed results, unresolved failure states and the user's visual acceptance. Use the existing `STAGE-XX-ACCEPTANCE.md` pattern. Do not replace dated evidence with new totals or mark an unperformed browser/chain check complete.

Success for the next delivery is narrow: a real authorized account can close an eligible shared rehearsal once, with durable actor attribution and privacy-preserving access. It is not a claim that physical effort has been proven.
