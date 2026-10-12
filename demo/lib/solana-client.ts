/** Safe to import in client UI; contains no signing or RPC credentials. */
export function devnetExplorerUrl(signature: string): string | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

export const DEVNET_DISCLOSURE = {
  en: "Real Devnet receipt · synthetic workout data · no monetary value. A blockchain receipt proves the recorded statement, not physical exercise.",
  pt: "Comprovante real na Devnet · treino com dados sintéticos · sem valor monetário. O registro comprova a declaração gravada, não o exercício físico.",
} as const;
