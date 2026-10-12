import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { anchorReceipt, verifyReceipt, receiptMemo, encodeBase58, decodeBase58, buildMemoMessage, MEMO_PROGRAM } from "../lib/solana.ts";

const sessionId = "test-session-001";
const hash = "a".repeat(64);
const signatureFixture = encodeBase58(new Uint8Array(64).fill(7));

function transaction(signature: string, memo: string, err: unknown = null) {
  return {
    meta: { err },
    transaction: {
      signatures: [signature],
      message: { accountKeys: [MEMO_PROGRAM], instructions: [{ programIdIndex: 0, data: encodeBase58(new TextEncoder().encode(memo)) }] },
    },
  };
}

test("base58 preserves zero prefixes and known Solana addresses", () => {
  assert.equal(encodeBase58(new Uint8Array(32)), "1".repeat(32));
  assert.equal(decodeBase58(MEMO_PROGRAM).length, 32);
  for (const address of [MEMO_PROGRAM, "1".repeat(32), signatureFixture]) assert.equal(encodeBase58(decodeBase58(address)), address);
  assert.throws(() => decodeBase58("0OIl"));
});

test("receipt input cannot inject memo fields", () => {
  assert.equal(receiptMemo(sessionId, hash), `STRIKEX_DEMO_V1|${sessionId}|${hash}|synthetic`);
  assert.throws(() => receiptMemo("session|real", hash));
  assert.throws(() => receiptMemo(sessionId, "not-a-hash"));
});

test("legacy message has one payer and a signed Memo with multi-byte shortvec", () => {
  const memo = receiptMemo("s".repeat(100), hash);
  const message = buildMemoMessage(new Uint8Array(32).fill(5), "1".repeat(32), memo);
  assert.deepEqual(Array.from(message.slice(0,4)), [1,0,1,2]);
  assert.equal(encodeBase58(message.slice(36,68)), MEMO_PROGRAM);
  assert.deepEqual(Array.from(message.slice(100,104)), [1,1,1,0]);
  assert.ok(message[104] & 128);
  assert.equal(new TextDecoder().decode(message.slice(106)), memo);
});

test("only successful transactions containing the exact receipt memo are confirmed", async t => {
  let result: unknown = transaction(signatureFixture, receiptMemo(sessionId, hash));
  t.mock.method(globalThis, "fetch", async () => Response.json({ result }));
  assert.equal((await verifyReceipt(signatureFixture, sessionId, hash)).status, "confirmed");
  result = transaction(signatureFixture, receiptMemo(sessionId, "b".repeat(64)));
  assert.equal((await verifyReceipt(signatureFixture, sessionId, hash)).status, "unavailable");
  result = transaction(signatureFixture, receiptMemo(sessionId, hash), { InstructionError: [0,"Custom"] });
  assert.equal((await verifyReceipt(signatureFixture, sessionId, hash)).status, "unavailable");
  result = null;
  assert.equal((await verifyReceipt(signatureFixture, sessionId, hash)).status, "pending");
});

test("sponsor signs valid bytes and persists the signature before broadcasting", async t => {
  let prepared = "";
  let sent = "";
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    if (request.method === "getBalance") return Response.json({ result: { value: 100000 } });
    if (request.method === "getLatestBlockhash") return Response.json({ result: { value: { blockhash: "1".repeat(32) } } });
    if (request.method === "sendTransaction") {
      const bytes = Uint8Array.from(atob(request.params[0]), char => char.charCodeAt(0));
      assert.equal(bytes[0], 1);
      const signature = bytes.slice(1,65);
      const message = bytes.slice(65);
      const publicKey = await crypto.subtle.importKey("raw", message.slice(4,36), "Ed25519", false, ["verify"]);
      assert.equal(await crypto.subtle.verify("Ed25519", publicKey, signature, message), true);
      sent = encodeBase58(signature);
      assert.equal(prepared, sent);
      assert.equal(request.params[1].skipPreflight, false);
      return Response.json({ result: sent });
    }
    if (request.method === "getTransaction") return Response.json({ result: transaction(sent, receiptMemo(sessionId, hash)) });
    throw new Error(`Unexpected method ${request.method}`);
  });
  const result = await anchorReceipt({ sessionId, hash, onPrepared: async value => { prepared = value; } });
  assert.equal(result.status, "confirmed");
  assert.equal(result.signature, sent);
});

test("uncertain broadcast returns the precomputed signature without claiming confirmation", async t => {
  let prepared = "";
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    if (request.method === "getBalance") return Response.json({ result: { value: 100000 } });
    if (request.method === "getLatestBlockhash") return Response.json({ result: { value: { blockhash: "1".repeat(32) } } });
    if (request.method === "sendTransaction") throw new DOMException("Timeout", "AbortError");
    throw new Error(`Unexpected method ${request.method}`);
  });
  const result = await anchorReceipt({ sessionId, hash, onPrepared: async value => { prepared = value; } });
  assert.equal(result.status, "pending");
  assert.equal(result.signature, prepared);
  assert.equal(decodeBase58(prepared).length, 64);
});

test("faucet failure remains unavailable, never a fake receipt", async t => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    if (request.method === "getBalance") return Response.json({ result: { value: 0 } });
    return Response.json({ error: { message: "Airdrop rate limit" } });
  });
  const result = await anchorReceipt({ sessionId, hash });
  assert.equal(result.status, "unavailable");
  assert.equal(result.signature, undefined);
  assert.match(result.error ?? "", /Airdrop rate limit/);
});
