import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { generateSession, validateSession } from '../lib/effort.ts';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { serializeSessionReceipt, sessionReceiptHash, verifySessionReceipt, SESSION_RECEIPT_FORMAT, SESSION_DIGEST_SERIALIZATION } from '../lib/session-receipt.ts';

function fixture() {
  const input = generateSession('receipt-session-01', 42);
  const result = validateSession(input);
  // This is the exact pre-refactor API preimage, independent of the helper under test.
  const legacyJSON = JSON.stringify({sessionId: input.sessionId, source: 'simulator', rulesVersion: result.rulesVersion, rounds: input.rounds, events: input.events, result});
  const hash = createHash('sha256').update(legacyJSON, 'utf8').digest('hex');
  return { input, result, legacyJSON, hash, receipt: { id: input.sessionId, input, result, hash } };
}

test('receipt serialization and SHA-256 preserve the original API bytes', async () => {
  const { input, result, legacyJSON, hash } = fixture();
  assert.equal(serializeSessionReceipt(input, result), legacyJSON);
  assert.equal(await sessionReceiptHash(input, result), hash);
});

test('both original exports and explicitly versioned exports verify', async () => {
  const { receipt, hash } = fixture();
  const expected = { status: 'verified', expectedHash: hash, computedHash: hash };
  assert.deepEqual(await verifySessionReceipt(receipt), expected);
  const exported = JSON.parse(JSON.stringify({ ...receipt, receiptFormat: SESSION_RECEIPT_FORMAT, digestAlgorithm: 'SHA-256', digestSerialization: SESSION_DIGEST_SERIALIZATION, disclosure: 'Synthetic telemetry.' }));
  assert.deepEqual(await verifySessionReceipt(exported), expected);
});

test('changed input or result mismatches the saved digest', async () => {
  const { receipt } = fixture();
  const changedInput = structuredClone(receipt);
  changedInput.input.events[0].accuracy = 0;
  const changedResult = structuredClone(receipt);
  changedResult.result.score += 1;
  for (const changed of [changedInput, changedResult]) {
    const verification = await verifySessionReceipt(changed);
    assert.equal(verification.status, 'mismatch');
    assert.equal(verification.expectedHash, receipt.hash);
    assert.notEqual(verification.computedHash, receipt.hash);
  }
});

test('legacy digest deliberately preserves nested JSON property order', async () => {
  const { receipt } = fixture();
  const reordered = structuredClone(receipt);
  reordered.input.rounds = reordered.input.rounds.map((round: ReturnType<typeof generateSession>['rounds'][number]) => ({ station: round.station, id: round.id, startMs: round.startMs, endMs: round.endMs }));
  assert.equal(validateSession(reordered.input).valid, true);
  assert.equal((await verifySessionReceipt(reordered)).status, 'mismatch');
  assert.equal((await verifySessionReceipt(receipt)).status, 'verified');
});

test('historical rules and score are verified as stored rather than recalculated', async () => {
  const { input, result } = fixture();
  const historicalResult = { ...result, score: 37, reward: 3, rulesVersion: 'demo-1.0.0' };
  assert.notEqual(validateSession(input).score, historicalResult.score);
  const legacyJSON = JSON.stringify({sessionId: input.sessionId, source: 'simulator', rulesVersion: historicalResult.rulesVersion, rounds: input.rounds, events: input.events, result: historicalResult});
  const hash = createHash('sha256').update(legacyJSON, 'utf8').digest('hex');
  assert.equal((await verifySessionReceipt({ id: input.sessionId, input, result: historicalResult, hash })).status, 'verified');
});

test('missing historical input is unavailable and cannot claim verification', async () => {
  const { receipt } = fixture();
  assert.deepEqual(await verifySessionReceipt({ ...receipt, input: null }), { status: 'unavailable' });
  const { input: _input, ...withoutInput } = receipt;
  assert.deepEqual(await verifySessionReceipt(withoutInput), { status: 'unavailable' });
});

test('malformed receipts are invalid and unsupported format metadata is explicit', async () => {
  const { receipt } = fixture();
  for (const malformed of [null, [], 'receipt', {}, { ...receipt, hash: 'not-a-digest' }, { ...receipt, id: 'another-session' }, { ...receipt, input: [] }, { ...receipt, input: { ...receipt.input, source: 'sensor' } }, { ...receipt, result: { ...receipt.result, valid: false } }, { ...receipt, result: { ...receipt.result, rulesVersion: null } }]) {
    assert.equal((await verifySessionReceipt(malformed)).status, 'invalid');
  }
  for (const metadata of [{ receiptFormat: 'strikex-session-v2' }, { digestSerialization: 'sorted-json-v1' }, { digestAlgorithm: 'SHA-512' }]) {
    assert.deepEqual(await verifySessionReceipt({ ...receipt, ...metadata }), { status: 'unsupported' });
  }
});
