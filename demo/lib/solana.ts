/** Server-only Devnet receipt sponsor. Never import this module into a client component. */
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const encoder = new TextEncoder();

export type ReceiptResult = {
  status: "confirmed" | "pending" | "unavailable";
  signature?: string;
  error?: string;
};

export function encodeBase58(input: Uint8Array): string {
  if (!input.length) return "";
  const digits = [0];
  for (const byte of input) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros++;
  return "1".repeat(zeros) + (zeros === input.length ? "" : digits.reverse().map(n => ALPHABET[n]).join(""));
}

export function decodeBase58(input: string): Uint8Array {
  if (!input.length) return new Uint8Array();
  if (input.length > 1500) throw new Error("Base58 input is too long");
  const bytes = [0];
  for (const char of input) {
    let carry = ALPHABET.indexOf(char);
    if (carry < 0) throw new Error("Invalid base58 input");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 255;
      carry >>= 8;
    }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  let zeros = 0;
  while (zeros < input.length && input[zeros] === "1") zeros++;
  return new Uint8Array([...new Array(zeros).fill(0), ...(zeros === input.length ? [] : bytes.reverse())]);
}

function shortVec(length: number): number[] {
  const out: number[] = [];
  do { const next = length & 127; length >>>= 7; out.push(next | (length ? 128 : 0)); } while (length);
  return out;
}

export function receiptMemo(sessionId: string, hash: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(sessionId) || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("Invalid session ID or SHA-256 receipt hash");
  }
  return `STRIKEX_DEMO_V1|${sessionId}|${hash}|synthetic`;
}

/** One signer, one read-only program, one Memo instruction requiring the sponsor's signature. */
export function buildMemoMessage(publicKey: Uint8Array, blockhash: string, memo: string): Uint8Array {
  const recentBlockhash = decodeBase58(blockhash);
  const program = decodeBase58(MEMO_PROGRAM);
  const data = encoder.encode(memo);
  if (publicKey.length !== 32 || recentBlockhash.length !== 32 || data.length > 300) {
    throw new Error("Invalid legacy Memo transaction input");
  }
  return new Uint8Array([
    1, 0, 1, 2, ...publicKey, ...program, ...recentBlockhash,
    1, 1, 1, 0, ...shortVec(data.length), ...data,
  ]);
}

type RpcTransaction = {
  meta: { err: unknown } | null;
  transaction: {
    signatures: string[];
    message: { accountKeys: string[]; instructions: { programIdIndex: number; data: string }[] };
  };
};

async function rpc<T>(method: string, params: unknown[], deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Devnet request deadline exceeded");
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), Math.min(5000, remaining));
  try {
    const response = await fetch(DEVNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: abort.signal,
    });
    if (!response.ok) throw new Error(`Devnet RPC unavailable (HTTP ${response.status})`);
    const body = await response.json() as { result?: T; error?: { message?: string } };
    if (body.error) throw new Error(`Devnet RPC: ${(body.error.message ?? "request failed").slice(0,180)}`);
    if (!("result" in body)) throw new Error("Invalid Devnet RPC response");
    return body.result as T;
  } finally { clearTimeout(timer); }
}

/** Confirmation requires successful execution AND the exact on-chain memo, not just a signature. */
export async function verifyReceipt(signature: string, sessionId: string, hash: string): Promise<ReceiptResult> {
  try {
    const memo = receiptMemo(sessionId, hash);
    if (decodeBase58(signature).length !== 64) throw new Error("Invalid transaction signature");
    const tx = await rpc<RpcTransaction | null>("getTransaction", [signature, {
      commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0,
    }], Date.now() + 5000);
    if (!tx) return { status: "pending", signature, error: "Transaction is not yet confirmed or is no longer available on this Devnet node." };
    if (!tx.meta || tx.meta.err !== null) return { status: "unavailable", signature, error: "The transaction failed on Devnet." };
    const matching = tx.transaction.signatures.includes(signature) && tx.transaction.message.instructions.some(ix =>
      tx.transaction.message.accountKeys[ix.programIdIndex] === MEMO_PROGRAM &&
      new TextDecoder("utf-8", { fatal: true }).decode(decodeBase58(ix.data)) === memo,
    );
    return matching ? { status: "confirmed", signature } : { status: "unavailable", signature, error: "The on-chain memo does not match this session." };
  } catch (error) {
    return { status: "pending", signature, error: safeError(error) };
  }
}

let sponsor: Promise<{ pair: CryptoKeyPair; publicKey: Uint8Array }> | undefined;
let funding: Promise<void> | undefined;

function getSponsor() {
  sponsor ??= (async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]) as CryptoKeyPair;
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    return { pair, publicKey };
  })().catch(error => { sponsor = undefined; throw error; });
  return sponsor;
}

async function ensureFunded(publicKey: Uint8Array, deadline: number) {
  if (!funding) funding = (async () => {
    const address = encodeBase58(publicKey);
    let balance = await rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }], deadline);
    if (balance.value >= 10000) return;
    await rpc<string>("requestAirdrop", [address, 10000000, { commitment: "confirmed" }], deadline);
    // Faucet acceptance does not imply funds are confirmed. Check balance before signing.
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      balance = await rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }], deadline);
      if (balance.value >= 10000) return;
    }
    throw new Error("Devnet faucet funding is pending; please try again later.");
  })().finally(() => { funding = undefined; });
  await funding;
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "Devnet did not respond in time. No confirmation was claimed.";
  return error instanceof Error ? error.message.slice(0,220) : "Devnet is currently unavailable.";
}

export async function anchorReceipt(input: {
  sessionId: string;
  hash: string;
  /** Persist this candidate before broadcast. If it already exists, call verifyReceipt instead. */
  onPrepared?: (signature: string) => Promise<void>;
}): Promise<ReceiptResult> {
  let signature: string | undefined;
  let broadcastAttempted = false;
  try {
    if (typeof window !== "undefined") throw new Error("Receipt signing is server-only");
    const memo = receiptMemo(input.sessionId, input.hash);
    const deadline = Date.now() + 18000;
    const { pair, publicKey } = await getSponsor();
    await ensureFunded(publicKey, deadline);
    const latest = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }], deadline);
    const message = buildMemoMessage(publicKey, latest.value.blockhash, memo);
    const signed = new Uint8Array(await crypto.subtle.sign("Ed25519", pair.privateKey, new Uint8Array(message)));
    signature = encodeBase58(signed);
    // Persist BEFORE submission; a timeout after submission must never create a fresh duplicate.
    await input.onPrepared?.(signature);
    const bytes = new Uint8Array([1, ...signed, ...message]);
    const serialized = btoa(String.fromCharCode(...bytes));
    broadcastAttempted = true;
    const remoteSignature = await rpc<string>("sendTransaction", [serialized, {
      encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 2,
    }], deadline);
    if (remoteSignature !== signature) throw new Error("Devnet returned an unexpected transaction signature");
    if (Date.now() + 5000 > deadline) return { status: "pending", signature, error: "Submitted to Devnet; confirmation is pending." };
    return await verifyReceipt(signature, input.sessionId, input.hash);
  } catch (error) {
    return { status: broadcastAttempted ? "pending" : "unavailable", ...(signature ? { signature } : {}), error: safeError(error) };
  }
}
