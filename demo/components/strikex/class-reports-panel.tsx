'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Download, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react';
import { availableRounds, verifyReport, type ParticipantInput, type ReportRun, type SavedReport } from '@/lib/class-report';
import type { Lang } from './types';

type Draft = { athleteId: string; status: ParticipantInput['status'] | ''; rounds: string };
type Props = { lang: Lang; ready: boolean; run?: ReportRun };
const statusName = (status: ParticipantInput['status'], pt: boolean) => ({ completed: pt ? 'Completo' : 'Complete', partial: pt ? 'Parcial' : 'Partial', absent: pt ? 'Ausente' : 'Absent' })[status];

function CloseoutEditor({ lang, run, onSaved, onConflict, syncBlocked }: { lang: Lang; run: ReportRun; syncBlocked: boolean; onSaved: (report: SavedReport) => void; onConflict: () => Promise<void> }) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const maximum = availableRounds(run.state, run.timing);
  const [draft, setDraft] = useState<Draft[]>(() => run.input.athletes.map(a => ({ athleteId: a.id, status: '', rounds: '' })));
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reviewed = draft.filter(d => d.status).length;
  const valid = draft.every(d => d.status && /^\d+$/.test(d.rounds) && (d.status === 'absent' ? +d.rounds === 0 : d.status === 'completed' ? +d.rounds === 12 && maximum === 12 : +d.rounds >= 0 && +d.rounds <= Math.min(11, maximum) && run.state.elapsedMs > 0));
  function edit(next: Draft[]) { setDraft(next); setAcknowledged(false); setError(''); requestId.current = null; }
  function choose(id: string, status: Draft['status']) {
    edit(draft.map(d => d.athleteId !== id ? d : { ...d, status, rounds: status === 'completed' ? '12' : status === 'absent' ? '0' : status === 'partial' ? String(Math.min(1, maximum)) : '' }));
  }
  async function finalize() {
    if (!valid || !acknowledged || submitting.current || syncBlocked) return;
    submitting.current = true; setBusy(true); setError(''); requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/class-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'finalize', runId: run.id, requestId: requestId.current, participants: draft.map(d => ({ athleteId: d.athleteId, status: d.status, roundsCompleted: +d.rounds })) }), signal: AbortSignal.timeout(15000) });
      const data = await response.json() as { report?: SavedReport; code?: string };
      if (!mounted.current) return;
      if (!response.ok || !data.report) {
        if (response.status >= 500) throw new Error(tr('The service is temporarily unavailable. Retry without changing the form to recover the same closeout.', 'O serviço está temporariamente indisponível. Tente novamente sem alterar o formulário para recuperar o mesmo fechamento.'));
        if (response.status === 409) { await onConflict(); throw new Error(tr('This class may already be closed or its state has changed. Review the saved record below.', 'Esta aula pode já ter sido fechada ou seu estado mudou. Confira o registro salvo abaixo.')); }
        throw new Error(response.status === 429 ? tr('The demo limit of 100 receipts has been reached. Export your history.', 'O limite demo de 100 comprovantes foi atingido. Exporte o histórico.') : response.status === 404 ? tr('This class is no longer available. It may have been deleted in another window.', 'Esta aula não está mais disponível. Ela pode ter sido excluída em outra janela.') : tr('Check every athlete and the number of rounds before retrying.', 'Confira cada atleta e a quantidade de rounds antes de tentar novamente.'));
      }
      onSaved(data.report);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && !['TypeError', 'TimeoutError'].includes(e.name) ? e.message : tr('Connection interrupted. Retry without changing the form to recover the same closeout.', 'Conexão interrompida. Tente novamente sem alterar o formulário para recuperar o mesmo fechamento.'));
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="closeout-editor" aria-labelledby="closeout-title">
    <div className="report-heading"><div><span className="tiny-label">{tr('NEXT STEP / CLOSEOUT', 'PRÓXIMO PASSO / FECHAMENTO')}</span><h2 id="closeout-title">{tr('Who took part?', 'Quem participou?')}</h2><p>{run.input.name}</p></div><ClipboardCheck size={28}/></div>
    <p className="report-intro">{tr('Review each athlete in this demonstration. The clock ended; participation still needs your declaration.', 'Revise cada atleta nesta demonstração. O relógio terminou; a participação ainda precisa da sua declaração.')}</p>
    <div className="closeout-context"><span>{maximum}/12 {tr('full rounds elapsed', 'rounds inteiros transcorridos')}</span><span>{reviewed}/{draft.length} {tr('reviewed', 'revisados')}</span></div>
    {maximum < 12 && <p className="report-interruption">{tr('Interrupted class: declared rounds cannot exceed the full rounds elapsed. A started round is not a completed round: partial participation can have zero full rounds.', 'Aula interrompida: os rounds declarados não podem superar os rounds inteiros transcorridos. Round iniciado não é round concluído: a participação parcial pode ter zero rounds inteiros.')}</p>}
    <div className="closeout-batch">{maximum === 12 && <button type="button" className="text-link" disabled={busy} onClick={() => edit(draft.map(d => ({ ...d, status: 'completed', rounds: '12' })))}>{tr('Mark everyone: 12 rounds', 'Marcar todos: 12 rounds')}</button>}<button type="button" className="text-link" disabled={busy} onClick={() => edit(draft.map(d => ({ ...d, status: 'absent', rounds: '0' })))}>{tr('Mark everyone absent', 'Marcar todos ausentes')}</button></div>
    <form onSubmit={event => { event.preventDefault(); void finalize(); }}>
      <fieldset disabled={busy} className="closeout-fields"><legend className="sr-only">{tr('Athlete participation', 'Participação dos atletas')}</legend>{draft.map((d, index) => <div className="closeout-athlete" key={d.athleteId}>
        <div className="closeout-athlete-name"><span>{String(index + 1).padStart(2, '0')}</span><strong>{run.input.athletes[index].name}</strong></div>
        <label>{tr('Participation', 'Participação')}<select value={d.status} required onChange={e => choose(d.athleteId, e.target.value as Draft['status'])} aria-label={`${tr('Participation', 'Participação')}: ${run.input.athletes[index].name}`}><option value="">{tr('Review…', 'Revisar…')}</option>{maximum === 12 && <option value="completed">{tr('Complete · 12 rounds', 'Completo · 12 rounds')}</option>}{run.state.elapsedMs > 0 && <option value="partial">{tr('Partial', 'Parcial')}</option>}<option value="absent">{tr('Absent · 0 rounds', 'Ausente · 0 rounds')}</option></select></label>
        <label>{tr('Declared rounds', 'Rounds declarados')}<input type="number" min={0} max={d.status === 'partial' ? Math.min(11, maximum) : maximum} step="1" required value={d.rounds} disabled={d.status !== 'partial'} onChange={e => edit(draft.map(x => x.athleteId === d.athleteId ? { ...x, rounds: e.target.value } : x))} aria-label={`${tr('Declared rounds', 'Rounds declarados')}: ${run.input.athletes[index].name}`}/></label>
      </div>)}</fieldset>
      <label className="closeout-ack"><input type="checkbox" checked={acknowledged} disabled={busy || !valid} onChange={e => setAcknowledged(e.target.checked)}/><span>{tr('I reviewed this demo declaration. Once saved, this closeout cannot be edited. It does not certify physical effort or award JAB.', 'Revisei esta declaração de demonstração. Depois de salvo, este fechamento não pode ser editado. Ele não certifica esforço físico nem gera JAB.')}</span></label>
      {error && <div className="planner-error" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy || syncBlocked || !valid || !acknowledged}><FileCheck2 size={18}/>{busy ? tr('Saving closeout…', 'Salvando fechamento…') : tr('Close and generate receipt', 'Fechar e gerar comprovante')}</button>
      <p className="report-draft-note">{tr('The form is saved only when you close the class. Review it before confirming.', 'O formulário só é salvo ao fechar a aula. Confira antes de confirmar.')}</p>
    </form>
  </section>;
}

function ReportCard({ report, lang }: { report: SavedReport; lang: Lang }) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const [verified, setVerified] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const { payload } = report;
  const count = (status: ParticipantInput['status']) => payload.participants.filter(p => p.status === status).length;
  async function check() {
    setVerified('checking');
    try { setVerified(await verifyReport(report) ? 'valid' : 'invalid'); } catch { setVerified('invalid'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `strikex-closeout-${report.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <article className="class-receipt">
    <div className="report-heading"><div><span className="tiny-label">{tr('DEMO RECEIPT / SAVED', 'COMPROVANTE DEMO / SALVO')}</span><h2>{payload.run.input.name}</h2><p>{new Date(report.createdAt).toLocaleString(pt ? 'pt-PT' : 'en-GB')} · {payload.run.state.status === 'completed' ? tr('Clock completed', 'Relógio concluído') : tr('Clock interrupted', 'Relógio interrompido')}</p></div><FileCheck2 size={28}/></div>
    <div className="report-summary">{(['completed', 'partial', 'absent'] as const).map(status => <div key={status}><span>{statusName(status, pt)}</span><strong>{count(status).toString().padStart(2, '0')}</strong></div>)}</div>
    <p className="report-intro">{tr('Manually declared demo participation. No sensor readings, physical verification or blockchain transaction.', 'Participação demo declarada manualmente. Sem medições de sensores, verificação física ou transação blockchain.')}</p>
    <div className="report-table-scroll"><table className="report-table"><caption>{tr('Saved participation declaration', 'Declaração de participação salva')}</caption><thead><tr><th>{tr('Athlete', 'Atleta')}</th><th>{tr('Participation', 'Participação')}</th><th>{tr('Declared rounds', 'Rounds declarados')}</th></tr></thead><tbody>{payload.participants.map(p => <tr key={p.athleteId}><th scope="row">{p.name}</th><td><span className={`participation-status participation-${p.status}`}>{statusName(p.status, pt)}</span></td><td>{p.roundsCompleted}/12</td></tr>)}</tbody></table></div>
    <details className="receipt-details"><summary>{tr('Receipt data and integrity', 'Dados e integridade do comprovante')}</summary><dl><dt>ID</dt><dd>{report.id}</dd><dt>{tr('Source', 'Origem')}</dt><dd>demo_declared</dd><dt>{tr('Rules version', 'Versão das regras')}</dt><dd>{payload.version}</dd><dt>SHA-256</dt><dd>{report.hash}</dd></dl><p>{tr('The hash detects content changes when compared with this saved digest. It is not a digital signature or proof of physical participation.', 'O hash detecta mudanças no conteúdo quando comparado com este resumo salvo. Não é assinatura digital nem prova de participação física.')}</p></details>
    <div className="report-actions"><button className="btn btn-subtle" onClick={download}><Download size={16}/>{tr('Export JSON', 'Exportar JSON')}</button><button className="text-link" disabled={verified === 'checking'} onClick={() => void check()}><ShieldCheck size={16}/>{verified === 'checking' ? tr('Checking…', 'Verificando…') : tr('Verify integrity', 'Verificar integridade')}</button></div>
    {verified !== 'idle' && verified !== 'checking' && <p className={verified === 'valid' ? 'planner-notice' : 'planner-error'} role="status">{verified === 'valid' ? <><CheckCircle2 size={17}/>{tr('Content matches the saved hash.', 'O conteúdo corresponde ao hash salvo.')}</> : tr('Integrity could not be verified. Reload the record and retry.', 'Não foi possível verificar a integridade. Recarregue o registro e tente novamente.')}</p>}
  </article>;
}

export function ClassReportsPanel({ lang, ready, run }: Props) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [chosen, setChosen] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const runId = run?.id;
  const refresh = useCallback(async () => {
    const version = ++epoch.current;
    try {
      const response = await fetch('/api/class-reports', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('reports');
      const data = await response.json() as { reports: SavedReport[] };
      if (!mounted.current || epoch.current !== version) return;
      setReports(data.reports); setLoaded(true); setLoadFailed(false);
    } catch { if (mounted.current && epoch.current === version) setLoadFailed(true); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (ready) void refresh();
    return () => { mounted.current = false; epoch.current++; };
  }, [ready, refresh, runId]);
  useEffect(() => { setChosen(runId || ''); setNotice(false); }, [runId]);
  const existing = run && reports.find(r => r.id === run.id);
  const selected = reports.find(r => r.id === chosen) || (!chosen ? reports[0] : undefined);
  function saved(report: SavedReport) {
    epoch.current++; setReports(previous => [report, ...previous.filter(r => r.id !== report.id)]); setChosen(report.id); setNotice(true); setLoadFailed(false);
    requestAnimationFrame(() => { resultRef.current?.focus(); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  function select(id: string) { setChosen(id); setNotice(false); requestAnimationFrame(() => { resultRef.current?.focus(); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
  return <section className="class-reports-panel">
    {loadFailed && <div className="planner-error" role="alert">{tr('Could not sync receipts. Refresh before closing a class.', 'Não foi possível sincronizar os comprovantes. Atualize antes de fechar a aula.')}<button className="text-link" onClick={() => void refresh()}><RefreshCw size={14}/>{tr('Retry', 'Tentar novamente')}</button></div>}
    {run && !loaded && !loadFailed && <p className="saved-class-empty">{tr('Checking saved closeout…', 'Consultando o fechamento salvo…')}</p>}
    {run && loaded && !existing && <CloseoutEditor key={run.id} lang={lang} run={run} syncBlocked={loadFailed} onSaved={saved} onConflict={refresh}/>}
    <div ref={resultRef} tabIndex={-1} className="report-result" aria-label={tr('Saved receipt', 'Comprovante salvo')}>{notice && <p className="planner-notice" role="status"><CheckCircle2 size={18}/>{tr('Class closed. Receipt saved without duplication.', 'Aula fechada. Comprovante salvo sem duplicação.')}</p>}{selected && <ReportCard key={selected.hash} report={selected} lang={lang}/>}</div>
    <div className="saved-class-section"><div className="class-section-heading"><div><span className="tiny-label">{tr('PERMANENT DEMO RECORDS', 'REGISTROS DA DEMONSTRAÇÃO')}</span><h2>{tr('Closeout history', 'Histórico de fechamentos')}</h2></div><button className="text-link" onClick={() => void refresh()}><RefreshCw size={14}/>{tr('Refresh', 'Atualizar')}</button></div><p className="report-history-note">{tr('Saved receipts remain available even if the original class is deleted. Up to 100 receipts in this demo.', 'Os comprovantes salvos permanecem disponíveis mesmo ao excluir a aula original. Até 100 comprovantes nesta demo.')}</p>{reports.length ? <div className="saved-class-list">{reports.map(report => <div key={report.id} className={`saved-class ${selected?.id === report.id ? 'is-active' : ''}`}><button onClick={() => select(report.id)}><FileCheck2 size={21}/><span><strong>{report.payload.run.input.name}</strong><small>{new Date(report.createdAt).toLocaleString(pt ? 'pt-PT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {report.payload.participants.length} {tr('athletes reviewed', 'atletas revisados')}</small></span></button></div>)}</div> : loaded && <p className="saved-class-empty">{tr('After a class ends, review participation here to generate its first receipt.', 'Depois que uma aula terminar, revise a participação aqui para gerar o primeiro comprovante.')}</p>}</div>
  </section>;
}
