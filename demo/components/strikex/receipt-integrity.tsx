'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { verifySessionReceipt, type SessionIntegrity } from '@/lib/session-receipt';
import type { Lang } from './types';

export function ReceiptIntegrity({ receipt, lang }: { receipt: unknown; lang: Lang }) {
  const [result, setResult] = useState<SessionIntegrity | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const pt = lang === 'pt';
  useEffect(() => { generation.current++; setResult(null); setBusy(false); return () => { generation.current++; }; }, [receipt]);
  async function verify() {
    const current = ++generation.current; setBusy(true);
    const checked = await verifySessionReceipt(receipt);
    if (current === generation.current) { setResult(checked); setBusy(false); }
  }
  const labels = {
    verified: pt ? 'Hash confere com os dados de sessão e resultado.' : 'The hash matches the session data and result.',
    mismatch: pt ? 'O conteúdo não corresponde ao hash informado.' : 'The content does not match the supplied hash.',
    unavailable: pt ? 'Registro antigo sem os dados originais. Não é possível recalcular o hash.' : 'Legacy record without its original input. The hash cannot be recalculated.',
    invalid: pt ? 'O arquivo não contém um comprovante de sessão compatível.' : 'This file does not contain a compatible session receipt.',
    unsupported: pt ? 'Formato de comprovante não suportado por este verificador.' : 'Receipt format not supported by this verifier.',
  };
  return <div className="receipt-integrity">
    <button className="text-link" disabled={busy} onClick={verify}>{busy ? <Loader2 size={15} className="spin"/> : <ShieldCheck size={15}/>} {pt ? 'Verificar integridade' : 'Verify integrity'}</button>
    {result && <div className={`integrity-result integrity-${result.status}`} role="status"><p>{result.status === 'verified' && <CheckCircle2 size={15}/>} {labels[result.status]}</p>{result.computedHash && <details><summary>{pt ? 'Conferir hashes' : 'Inspect hashes'}</summary><span>{pt ? 'Informado' : 'Supplied'}</span><code>{result.expectedHash}</code><span>{pt ? 'Calculado neste navegador' : 'Computed in this browser'}</span><code>{result.computedHash}</code></details>}</div>}
    <p className="receipt-integrity-note">{pt ? 'Conferência local dos dados da sessão e do resultado. Data de criação e status da blockchain não entram neste hash. Não autentica o emissor, o esforço físico ou a confirmação na blockchain.' : 'Local check of session data and result. Creation date and blockchain status are not included in this hash. It does not authenticate the issuer, physical effort or blockchain confirmation.'}</p>
  </div>;
}

export function ReceiptFileVerifier({ lang }: { lang: Lang }) {
  const [receipt, setReceipt] = useState<unknown>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const pt = lang === 'pt';
  useEffect(() => () => { generation.current++; }, []);
  async function read(file: File | undefined) {
    const current = ++generation.current; setReceipt(null); setFilename(''); setError(false); setLoading(false);
    if (!file) return;
    if (file.size > 512_000) { setError(true); return; }
    setLoading(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (current === generation.current) { setReceipt(parsed); setFilename(file.name); }
    } catch { if (current === generation.current) setError(true); }
    finally { if (current === generation.current) setLoading(false); }
  }
  return <section className="system-file-verifier"><div className="system-section-title"><ShieldCheck size={21}/><h2>{pt ? 'Confira um comprovante exportado' : 'Check an exported receipt'}</h2></div><p>{pt ? 'Baixe o JSON de uma batalha em Atividade e selecione o arquivo aqui. A leitura acontece só neste navegador, sem enviar o arquivo ao servidor. Até 500 KB.' : 'Download a battle’s JSON from Activity and select it here. The file is read only in this browser and is not uploaded. Up to 500 KB.'}</p><label className="system-file-label"><Upload size={18}/>{pt ? 'Selecionar JSON da sessão' : 'Select session JSON'}<input type="file" accept=".json,application/json" onChange={event=>{void read(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/></label>{loading&&<p role="status">{pt ? 'Lendo arquivo…' : 'Reading file…'}</p>}{error&&<p role="alert">{pt ? 'Use um arquivo JSON válido de até 500 KB.' : 'Use a valid JSON file up to 500 KB.'}</p>}{filename&&<><p className="system-filename">{filename}</p><ReceiptIntegrity receipt={receipt} lang={lang}/></>}</section>;
}
