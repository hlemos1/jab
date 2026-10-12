# Stage 5 — Unit & Team

## Delivered

Account-linked test units, manager/coach/athlete membership, single-use invitations, role changes, access removal and voluntary departure. Entry points: My account, Class and `?view=units`. English/Portuguese interface. Existing personal demo classes remain private.

## Visual acceptance with two accounts

1. Open Unit & Team as a guest. Check the sign-in prompt; sign in through the native ChatGPT link.
2. Create a test unit with a name and your display name. Reload: the unit and manager role should persist. A second owned unit cannot be created.
3. Generate an athlete invitation. Copy its code before navigating away. Confirm its selected role and seven-day expiry. After reload, only invitation metadata should remain, with no recoverable code.
4. In a different browser profile signed into a **different ChatGPT account**, open Unit & Team. Paste the code, set a display name and accept. The athlete sees their own membership, while the manager sees both people.
5. Refresh the manager view and change the member to coach. Refresh the second account: the coach sees the unit roster but cannot manage invitations or other members. Personal class plans are not shared by this change.
6. Generate another invitation and revoke it. Acceptance with that code must fail. Remove the existing member: after refreshing, the second account no longer sees the unit. Reusing its previously accepted code must fail.
7. Generate a fresh code and rejoin using the second account. Check that the new role applies. Test Leave unit; returning requires another fresh invitation.
8. Check mobile-width layout, language switching and clear feedback after refresh or connection failure. Do not navigate away until a newly generated code has been copied.

The same ChatGPT account in two windows tests persistence, not two distinct memberships. Invitation delivery is manual; the app does not send messages.

## Verification performed

- TypeScript type check.
- 85 TypeScript tests, including 14 actual unit API handler tests backed by migrated SQLite.
- 34 SQLite invariant tests, including nine new concurrency tests for units and invitations.
- Identity, authorization, role visibility, retry behavior, secret hashing, expiry, revocation, stable reentry IDs, rollback and capacity limits.

Managed build and publication are checked separately. Browser sign-in, responsive rendering and the two-account acceptance flow remain for user visual validation; automated tests mock trusted identity and do not claim a completed provider login.

## Limits and next delivery

One owned test unit and ten joined units per account; 50 people per unit including manager; ten pending invitations and 100 total invitations per unit. Codes are bearer invitations: anyone holding an unused code can accept its selected role. The database stores only its hash. A lost creation response cannot recover its plaintext; revoke and create another invitation.

No unit rename, deletion, owner transfer or invitation archive yet. Display names do not verify physical identity. Creation does not certify an official StrikeX unit. No shared class operation, account-linked attendance, physical telemetry, JAB or Solana transaction is added in this stage.

After visual acceptance, the next cut is unit-scoped classes with roster selection from active members, stable member IDs and manager/coach authorization for class operations. Athlete visibility should be restricted to their own participation. Existing private demo records must retain their original scope and provenance.
