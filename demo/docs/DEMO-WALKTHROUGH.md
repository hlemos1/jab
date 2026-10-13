# Judge walkthrough

[Open the app](https://strikex-proof-of-effort.lemos10.chatgpt.site) · [Open the onboarding](https://strikex-proof-of-effort.lemos10.chatgpt.site/?guide=1) · [Pitch EN / PT](PITCH.md)

## Preparation

Choose English or Portuguese in the top bar. The individual demonstration works with a guest profile and no wallet. Account-linked units require native sign-in. Use synthetic display names and neutral class titles during a public presentation.

The 90-second path uses **fast-forward**, because the full replay itself lasts 72 seconds. Preload one completed session if the presentation time is strict. Do not label local lab output as a server or chain transaction.

## 90-second path

| Time | Action | What to explain or verify |
|---|---|---|
| 0–10s | Open the Arena and create a guest profile if needed | This is an interactive CombatFit prototype with synthetic telemetry. |
| 10–25s | Start a battle, inspect the feed, fast-forward | Twelve rounds; six available station types; a variable sequence with no mandatory visit to every station. |
| 25–40s | Inspect result, saved input/hash and receipt verification | The API calculated the illustrative score and credited the session once. A matching checksum verifies the exported declaration against its own hash. |
| 40–55s | Request the optional Devnet receipt | Show the actual status. Open Explorer only for a confirmed receipt; if unavailable or pending, say so and continue. |
| 55–65s | Redeem the fictional guest pass | The server deducts demo JAB. Nothing is purchased, booked or fulfilled. |
| 65–80s | Open the architecture/demo area and its laboratory; replay the saved session | This request reaches the server. The existing record returns with no extra credit. |
| 80–90s | Run the invalid-timing scenario and show the architecture boundary | This rule check is local. Invalid synthetic data is rejected; physical sensor validation remains future work. |

Never substitute an unrelated transaction, recorded animation or local validator result for successful server or chain execution. If no saved input exists for an older record, use a new demo session instead of claiming that old checksum is reproducible.

## Optional operational walkthrough

Allow a separate session for this flow. It needs two authenticated accounts for manager/athlete access, or three to demonstrate an independent coach. Two windows using the same account do not test role separation.

1. Create a test unit as its manager. Create a single-use athlete invitation and accept it with the second account. For a public recording, hide the invitation code and use test identities.
2. Open **Unit classes**. Select active athlete members and prepare a shared rehearsal. The server resolves names and saves the roster/plan snapshot.
3. In the athlete's account, inspect only that athlete's assigned sequence. Other athletes' names and sequences must not appear.
4. As manager or current coach, start, pause, reload and resume. The clock is server-authoritative; an outdated command must refresh rather than rewind it.
5. Explain that finishing the clock records neither verified attendance nor physical effort, and creates no JAB or chain receipt.
6. Separately, open the private class workflow to demonstrate manual closeout and JSON export. These owner-scoped declarations are independent of account-linked unit classes.

Use [Stage 6 acceptance](STAGE-06-ACCEPTANCE.md) for the full role-change and stale-state checks. Account-linked closeout is proposed next work, not part of this walkthrough.

## Failure and evidence checklist

| Situation | Honest expected behavior |
|---|---|
| Public faucet/RPC refuses funding or times out | Show unavailable/pending; the accepted demo session remains saved. |
| Same accepted session is replayed | Same saved result and no additional reward. |
| Existing session ID is submitted with changed input | Conflict; no replacement of the saved declaration. |
| Benefit is redeemed again or balance is insufficient | No second debit/benefit and no negative balance. |
| Guest switches to a signed-in account | Separate history; no automatic import of guest points. |
| Coach is removed or demoted | Subsequent authorized requests lose management permission. |
| Session input or result covered by the digest changes without updating it | Integrity verification fails. A self-consistent changed file is still not an issuer signature. |

Automated checks cover domain rules, route behavior with mocked trusted identity, and migrated SQLite invariants. Record browser acceptance and a real chain confirmation separately if performed. A build passing is not evidence of either.
