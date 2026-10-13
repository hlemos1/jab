# Solana Devnet receipts

This prototype records a synthetic training-session statement using the existing Solana Memo program. It does not deploy a custom program, mint a token, prove physical exercise, or transfer real funds. JAB demo points remain in the app database and have no monetary value.

## Exact statement

`STRIKEX_DEMO_V1|<sessionId>|<sha256 hash>|synthetic`

The server computes and persists the session result and SHA-256 hash. `anchorReceipt` accepts that persisted hash, not an arbitrary browser-supplied result. One legacy transaction invokes Memo with the sponsor as a required signer. A non-extractable Ed25519 private key is generated with WebCrypto and stays in the server isolate. Only its public key is exported. It is an ephemeral demonstration sponsor; an isolate restart loses it. The faucet supplies 0.01 test SOL if necessary. Nothing connects to mainnet.

## API integration

1. Authenticate ownership of an accepted session and apply the server's per-session concurrency/idempotency control.
2. If a candidate signature already exists, call `verifyReceipt(existingSignature, sessionId, storedHash)`; do not create a new transaction automatically.
3. Otherwise call `anchorReceipt({sessionId, hash: storedHash, onPrepared})`.
4. `onPrepared(signature)` must atomically persist the candidate signature **before** broadcast. Do not overwrite an existing candidate. Throw if the atomic claim fails.
5. Persist the returned status. Failed anchoring must never undo the accepted workout, add points again, or display a confirmed blockchain badge.

The helper returns `confirmed` only after `getTransaction` at confirmed commitment reports `meta.err === null`, the expected transaction signature, and the exact Memo bytes. A broadcast timeout returns `pending` with the locally computed signature, since it may already have reached the chain. The public Explorer link always includes `?cluster=devnet`. Unknown or expired transactions remain pending rather than inventing confirmation. An expired unlanded transaction requires an explicit operator recovery process, which this MVP does not implement.

RPC calls are bounded to five seconds each; anchoring targets an 18-second overall budget. No private keys, wallet login, token balance, or personally identifying profile fields are written to the chain. Repeated sessions may exhaust a public faucet or face RPC throttling. A stable production sponsor, private RPC, rate limiting, funding management, and durable retry worker would be separate work.

## Verification performed

- Live Devnet `getLatestBlockhash` succeeded during development.
- A live `anchorReceipt` attempt returned `unavailable` with `Devnet RPC: Internal error` from the public RPC/faucet path. **No successful real on-chain transaction is claimed by this development check.** The application reports this honestly and remains usable without a receipt.
- Automated tests cover base58 and legacy serialization, cryptographic Ed25519 signature verification, exact memo matching, failed transactions, persist-before-broadcast ordering, uncertain broadcast handling, and faucet refusal.

## Primary documentation

- [Solana transaction structure](https://solana.com/docs/core/transactions)
- [sendTransaction](https://solana.com/docs/rpc/http/sendtransaction)
- [getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- [Memo program](https://www.solana-program.com/docs/memo)
