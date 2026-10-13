# Public architecture refinement · October 13, 2026

This increment refines the public demonstrator without advancing the functional roadmap beyond Stage 6.

## Changes

- The system screen separates the pitch, implemented architecture and inspection laboratory, with English/Portuguese copy and direct links to public source.
- Local validator scenarios identify their browser authority and absence of persistence. Saved-session replay reports the actual server duplicate flag and returned balance, including the non-duplicate outcome.
- Individual session receipts share one SHA-256 serializer between the API and local verifier. Export metadata names the format; historical ordered JSON bytes and original rule results are preserved.
- Session IDs now use the existing API contract throughout generator, validator and Memo construction: 8–100 ASCII letters, digits, underscores or hyphens. Event IDs retain their separate contract.
- Public documentation separates operational classes, synthetic rewards, optional Devnet commitments and proposed physical evidence. Proprietary Solver and firmware remain outside the demo.

No database migration, reward-policy change, token deployment or historical receipt rewrite is included.

## Automated evidence

`npm run check` passed in the development checkout: TypeScript compilation, 118 Node tests and 34 SQLite invariant tests. Receipt tests independently compare legacy digest bytes, detect changed payloads, retain historical results and handle missing or unsupported inputs. Existing API, permission, retry and concurrency checks passed.

The production build is part of the managed publication workflow. Test doubles and a passing build do not establish browser acceptance, native sign-in or a confirmed live Devnet transaction.

## User acceptance to record

1. Open How it works and inspect Pitch, Architecture and Lab in both languages, including a narrow viewport and keyboard navigation.
2. Finish a synthetic battle. Verify its receipt, export the JSON and check that file in the Lab. Alter an event without changing the hash and confirm a mismatch.
3. Run valid/invalid local scenarios; confirm neither changes the balance. Replay the saved session and inspect the server duplicate result.
4. Follow the source and documentation links. Confirm the presentation matches the intended public narrative.

Browser visual acceptance and a live Devnet confirmation were not performed for this increment. They remain separate observations, not inferred from automated checks.
