import type { SessionInput, SessionResult } from './effort';

/** Public export metadata. The original digest bytes remain unchanged. */
export const SESSION_RECEIPT_FORMAT = 'strikex-session-v1';
export const SESSION_DIGEST_SERIALIZATION = 'legacy-json-v1';

/** Do not sort nested keys: historical receipts bind the originally stored JSON order. */
export function serializeSessionReceipt(input: SessionInput, result: SessionResult): string {
  return JSON.stringify({ sessionId: input.sessionId, source: 'simulator', rulesVersion: result.rulesVersion, rounds: input.rounds, events: input.events, result });
}

export async function sessionReceiptHash(input: SessionInput, result: SessionResult): Promise<string> {
  const bytes = new TextEncoder().encode(serializeSessionReceipt(input, result));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export type SessionIntegrity = { status: 'verified' | 'mismatch' | 'unavailable' | 'invalid' | 'unsupported'; expectedHash?: string; computedHash?: string };
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** Checks consistency with the supplied hash, not issuer authenticity or physical effort. */
export async function verifySessionReceipt(value: unknown): Promise<SessionIntegrity> {
  try {
    if (!record(value)) return { status: 'invalid' };
    if ((value.receiptFormat !== undefined && value.receiptFormat !== SESSION_RECEIPT_FORMAT) ||
        (value.digestSerialization !== undefined && value.digestSerialization !== SESSION_DIGEST_SERIALIZATION) ||
        (value.digestAlgorithm !== undefined && value.digestAlgorithm !== 'SHA-256')) return { status: 'unsupported' };
    if (typeof value.id !== 'string' || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) return { status: 'invalid' };
    if (value.input === null || value.input === undefined) return { status: 'unavailable' };
    if (!record(value.input) || !record(value.result) || value.input.source !== 'simulator' || value.input.sessionId !== value.id ||
        !Array.isArray(value.input.rounds) || !Array.isArray(value.input.events) || value.result.valid !== true || typeof value.result.rulesVersion !== 'string') return { status: 'invalid' };
    // Do not recalculate historical scores using today's rules.
    const computedHash = await sessionReceiptHash(value.input as unknown as SessionInput, value.result as unknown as SessionResult);
    return { status: computedHash === value.hash ? 'verified' : 'mismatch', expectedHash: value.hash, computedHash };
  } catch { return { status: 'invalid' }; }
}
