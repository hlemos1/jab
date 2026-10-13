# Stage 6 — Shared unit classes

## Scope

Authenticated managers and current coaches prepare and operate shared rehearsal classes in their test unit. Rosters contain one to eleven active athlete memberships. Names are resolved on the server and membership IDs are preserved in the class snapshot. Athletes see only their own class sequence. Earlier private plans, runs and closeouts retain their original scopes.

The independent demonstration planner retains capacities 3/3/2/1/1/1, station exclusions and no consecutive station repetition. Universal station coverage is not required. This is not integration of the proprietary Solver.

## Visual acceptance

1. Use Unit & Team to create a test unit and invite another account as an athlete. The manager cannot substitute a guest or arbitrary display name for a real membership.
2. Open **Unit classes**. Select the athlete, name the class and prepare the distribution. Optionally exclude a station. The default rehearsal is twelve six-second rounds with eleven two-second rests.
3. In the athlete's separate signed-in browser, open the same area. Confirm that only the selected athlete's sequence appears and no class management controls are available.
4. As manager, start, pause, reload and resume. Both accounts should recover the server clock. Finishing the clock must not claim attendance, points or measured effort.
5. To test collaboration, invite a third account as coach. The coach should see the shared roster and operate the same class. Conflicting commands from manager and coach must refresh rather than rewind or duplicate state.
6. Demote or remove the coach in Unit & Team and refresh their class view. Management access must disappear. Remove the athlete and verify that their next refresh no longer returns the class. Rejoining with a fresh invitation preserves the member ID and access to their own history while active.
7. Prepare a second rehearsal, interrupt it, then remove its terminal record. Active classes cannot be deleted. Test mobile layout, long names, PT/EN, keyboard access and connection recovery.

Two windows using the same ChatGPT account test persistence, not separate roles. Two accounts suffice for manager/athlete visibility; a third account is needed to test a coach operating a class that contains a separate athlete.

## Verification

105 TypeScript tests and 34 SQLite invariant tests passed. Twenty new actual-handler tests cover shared-class authorization, athlete-only responses, same-unit eligibility, snapshots, concurrent revisions, retries, clock recovery, limits and membership changes between authorization and SQL execution.

## Verification limits

Automated handler tests use the real migrated SQLite schema and mocked trusted identity. They validate authorization and response projection but do not establish a completed native browser login. Managed build and publication are checked separately. Visual sign-in and multiple-account behavior remain for the user's acceptance pass.

## Boundaries and next step

One active class and twenty saved classes per unit. Rosters and timing are immutable after preparation; end the rehearsal and create another to change the selection. Only currently active members with the athlete role can be selected at creation. Current managers/coaches operate the unit's classes; role changes apply to subsequent server requests.

These are account-linked rehearsals, not attendance attestations. No check-in, reservation, physical sensor data, operational JAB or Solana transaction is created. Names remain self-declared. The next delivery is explicit participation review by an authorized coach, with actor attribution and a durable account-linked record; points remain a later, separate ledger.
