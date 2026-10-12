'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, Pause, Play, RefreshCw, ShieldCheck, Square, Trash2, Users } from 'lucide-react';
import type { ClassInput, ClassPlan } from '@/lib/class-planner';
import { CAPACITIES } from '@/lib/class-planner';
import { projectRun, type RunState, type RunProjection, type Timing } from '@/lib/class-run';
import type { StationId } from '@/lib/effort';
import type { Lang } from './types';
import { stations } from './stations';

type SavedPlan = { id: string; input: ClassInput; plan: ClassPlan };
type SavedRun = SavedPlan & { planId: string; createdAt: string; updatedAt: string; revision: number; timing: Timing; state: RunState; clock: RunProjection };
type RunResponse = { runs?: SavedRun[]; run?: SavedRun; serverNow: number; code?: string; error?: string };
const terminal = (status: RunState['status']) => status === 'completed' || status === 'interrupted';
const timeLabel = (ms: number) => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; };

export function CoachPage({ lang, ready, onPlan, initialPlanId }: { lang: Lang; ready: boolean; onPlan: () => void; initialPlanId?: string }) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [planId, setPlanId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [work, setWork] = useState('6');
  const [rest, setRest] = useState('2');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [networkFailed, setNetworkFailed] = useState(false);
  const [anchor, setAnchor] = useState<{ server: number; received: number } | null>(null);
  const [tick, setTick] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const loadingRef = useRef(false);
  const epoch = useRef(0);
  const createRequest = useRef<{ key: string; id: string } | null>(null);

  const refresh = useCallback(async () => {
    if (loadingRef.current || busyRef.current) return;
    loadingRef.current = true;
    const version = epoch.current;
    try {
      const response = await fetch('/api/class-runs', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('sync');
      const data = await response.json() as RunResponse;
      if (!mounted.current || epoch.current !== version) return;
      setRuns(data.runs || []);
      if (data.runs?.some(r => r.id === createRequest.current?.id)) createRequest.current = null;
      setSelectedId(previous => data.runs?.some(r => r.id === previous) ? previous : (data.runs?.find(r => !terminal(r.state.status))?.id || data.runs?.[0]?.id || ''));
      setAnchor({ server: data.serverNow, received: performance.now() });
      setNetworkFailed(false); setLoaded(true);
    } catch {
      if (mounted.current && epoch.current === version) setNetworkFailed(true);
    } finally { loadingRef.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!ready) return () => { mounted.current = false; };
    void refresh();
    const controller = new AbortController();
    void fetch('/api/classes', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('plans');
      const data = await response.json() as { plans: SavedPlan[] };
      if (mounted.current) { setPlans(data.plans); setPlanId(data.plans.some(p => p.id === initialPlanId) ? initialPlanId! : data.plans[0]?.id || ''); }
    }).catch(() => { if (!controller.signal.aborted && mounted.current) setError(pt ? 'Não foi possível carregar as turmas. Volte a Turma e tente novamente.' : 'Could not load classes. Return to Class and try again.'); });
    const poll = window.setInterval(() => void refresh(), 3000);
    const ticker = window.setInterval(() => setTick(performance.now()), 250);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; epoch.current++; controller.abort(); clearInterval(poll); clearInterval(ticker); document.removeEventListener('visibilitychange', visible); };
  }, [ready, refresh, pt, initialPlanId]);

  async function command(body: Record<string, unknown>) {
    if (busyRef.current) return;
    busyRef.current = true; epoch.current++; setBusy(true); setError('');
    try {
      const response = await fetch('/api/class-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const data = await response.json() as RunResponse;
      if (!mounted.current) return;
      if (!response.ok) {
        const messages: Record<string, string> = {
          ACTIVE_RUN: tr('Finish or interrupt the open class before creating another.', 'Conclua ou interrompa a aula aberta antes de criar outra.'),
          INVALID_INPUT: tr('Use whole seconds: work 5–300, rest 0–120.', 'Use segundos inteiros: round de 5 a 300 e descanso de 0 a 120.'),
        };
        throw new Error((data.code && messages[data.code]) || (response.status === 409 ? tr('The class changed in another window. The panel will refresh.', 'A aula mudou em outra janela. O painel será atualizado.') : response.status === 429 ? tr('Delete an ended class to free history space.', 'Exclua uma aula encerrada para liberar espaço no histórico.') : tr('Could not complete this action. Refresh and retry.', 'Não foi possível concluir. Atualize e tente novamente.')));
      }
      if (body.action === 'create') createRequest.current = null;
      if (data.run) {
        const run = data.run;
        setRuns(previous => [run, ...previous.filter(r => r.id !== run.id)]);
        setSelectedId(run.id);
        if (body.action === 'create') requestAnimationFrame(() => { panelRef.current?.focus(); panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      } else if (body.action === 'delete') { setRuns(previous => previous.filter(r => r.id !== body.id)); setSelectedId(''); }
      setAnchor({ server: data.serverNow, received: performance.now() }); setNetworkFailed(false);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : tr('Connection interrupted. Refresh to check whether the command was received.', 'Conexão interrompida. Atualize para conferir se o comando foi recebido.'));
    } finally {
      busyRef.current = false;
      if (mounted.current) { setBusy(false); void refresh(); }
    }
  }

  const selected = runs.find(r => r.id === selectedId);
  const open = runs.find(r => !terminal(r.state.status));
  const now = anchor ? anchor.server + Math.max(0, tick - anchor.received) : 0;
  const clock = selected && anchor ? projectRun(selected.state, selected.timing, now) : selected?.clock;
  const stale = !anchor || tick - anchor.received > 12000 || networkFailed;
  const controlsDisabled = busy || stale;
  const timingValid = /^\d+$/.test(work) && /^\d+$/.test(rest) && +work >= 5 && +work <= 300 && +rest <= 120;
  const statusLabel = (status: RunState['status']) => ({ ready: tr('Ready to start', 'Pronta para iniciar'), running: tr('In progress', 'Em andamento'), paused: tr('Paused', 'Pausada'), completed: tr('Completed', 'Concluída'), interrupted: tr('Interrupted', 'Interrompida') })[status];
  function create() {
    const timing = { workSeconds: +work, restSeconds: +rest };
    const key = JSON.stringify({ planId, timing });
    if (createRequest.current?.key !== key) createRequest.current = { key, id: crypto.randomUUID() };
    void command({ action: 'create', requestId: createRequest.current.id, planId, timing });
  }
  function act(action: string) {
    if (!selected) return;
    if ((action === 'interrupt' || action === 'delete') && !window.confirm(action === 'delete' ? tr('Delete this ended class?', 'Excluir esta aula encerrada?') : tr('End this class now? It cannot be resumed.', 'Interromper esta aula agora? Ela não poderá ser retomada.'))) return;
    void command({ action, id: selected.id, expectedRevision: selected.revision, ...(action === 'delete' ? {} : { requestId: crypto.randomUUID() }) });
  }
  const assignmentRound = clock?.phase === 'rest' ? Math.min(12, clock.round + 1) : clock?.round || 1;
  const assignments = selected?.plan.rounds.find(r => r.round === assignmentRound)?.assignments || [];
  const names = new Map(selected?.input.athletes.map(a => [a.id, a.name]) || []);

  return <section className="inner-page class-page coach-page">
    <div className="eyebrow">COMBATFIT / COACH</div>
    <h1 className="page-title">{tr('Your class. In motion.', 'Sua turma. Em movimento.')}<span>.</span></h1>
    <p className="page-subtitle">{tr('Lead a saved class through 12 rounds. Pause, resume and pick up where you left off.', 'Conduza uma turma salva por 12 rounds. Pause, retome e continue de onde parou.')}</p>
    <div className="coach-toolbar"><button className="text-link" onClick={onPlan}><ArrowLeft size={15}/>{tr('Class planner', 'Montar turma')}</button><span className={`coach-sync ${stale ? 'is-offline' : ''}`} role="status"><span/>{stale ? tr('Waiting for sync', 'Aguardando sincronização') : tr('Synced with server', 'Sincronizado com o servidor')}</span><button className="text-link" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>{tr('Refresh', 'Atualizar')}</button></div>
    <p className="planner-disclosure"><ShieldCheck size={15}/>{tr('Demo coaching for your own classes. Shared gym roles come later. This clock does not validate physical effort or credit JAB.', 'Condução de demonstração das suas próprias turmas. Papéis compartilhados de unidade vêm depois. O relógio não comprova esforço físico nem credita JAB.')}</p>
    {error && <div className="planner-error" role="alert">{error}</div>}
    {stale && loaded && <div className="planner-error" role="status">{tr('The displayed time is estimated. The server keeps the class running. Controls return after synchronization.', 'O tempo exibido é estimado. O servidor mantém a aula em andamento. Os controles voltam após a sincronização.')}</div>}
    {!loaded ? <div className="saved-class-empty">{networkFailed ? tr('Connection unavailable. Use Refresh to retry.', 'Conexão indisponível. Use Atualizar para tentar novamente.') : tr('Loading your classes…', 'Carregando suas aulas…')}</div> : <>
      {open ? <div className="coach-open"><Clock3 size={20}/><div><strong>{tr('One open class', 'Uma aula aberta')}</strong><p>{open.input.name} · {statusLabel(open.state.status)}</p></div><button className="btn btn-subtle" onClick={() => setSelectedId(open.id)}>{tr('Open panel', 'Abrir painel')}</button></div> : <form className="coach-setup" onSubmit={event => { event.preventDefault(); create(); }}>
        <div><span className="tiny-label">{tr('NEW DEMO CLASS', 'NOVA AULA DEMO')}</span><h2>{tr('Ready for the next round?', 'Pronto para o próximo round?')}</h2><p>{tr('Quick rehearsal: 6 seconds of work + 2 seconds of rest.', 'Ensaio rápido: 6 segundos por round + 2 segundos de descanso.')}</p></div>
        {plans.length ? <><label className="coach-plan-label">{tr('Saved class', 'Turma salva')}<select value={planId} onChange={e => setPlanId(e.target.value)} disabled={busy}>{plans.map(p => <option key={p.id} value={p.id}>{p.input.name} · {p.input.athletes.length} {tr('athletes', 'atletas')}</option>)}</select></label><div className="coach-timing"><label>{tr('Round / seconds', 'Round / segundos')}<input type="number" min="5" max="300" step="1" value={work} onChange={e => setWork(e.target.value)} disabled={busy} required/></label><label>{tr('Rest / seconds', 'Descanso / segundos')}<input type="number" min="0" max="120" step="1" value={rest} onChange={e => setRest(e.target.value)} disabled={busy} required/></label><span>12 {tr('rounds', 'rounds')} · {timingValid ? timeLabel((12 * +work + 11 * +rest) * 1000) : '—'}</span></div><button className="btn btn-primary" disabled={controlsDisabled || !timingValid || !planId} type="submit"><Users size={17}/>{busy ? tr('Preparing…', 'Preparando…') : tr('Prepare class', 'Preparar aula')}</button></> : <button className="btn btn-primary" type="button" onClick={onPlan}>{tr('Save your first class', 'Salvar a primeira turma')}</button>}
      </form>}
      {selected && clock && <section ref={panelRef} tabIndex={-1} className="coach-live" aria-label={tr('Class controls', 'Controles da aula')}>
        <div className="coach-live-heading"><div><span className="tiny-label">{tr('CLASS CONTROL', 'CONTROLE DA AULA')}</span><h2>{selected.input.name}</h2></div><span className={`coach-status status-${clock.status}`} role="status">{statusLabel(clock.status)}</span></div>
        <div className={`coach-clock phase-${clock.phase}`}><div><span>{clock.phase === 'rest' ? tr('REST · PREPARE THE NEXT ROUND', 'DESCANSO · PREPARE O PRÓXIMO ROUND') : clock.status === 'ready' ? tr('EVERYONE IN POSITION', 'TODOS EM POSIÇÃO') : terminal(clock.status) ? tr('CLASS ENDED', 'AULA ENCERRADA') : clock.status === 'paused' ? tr('CLOCK PAUSED', 'RELÓGIO PAUSADO') : tr('ROUND IN PROGRESS', 'ROUND EM ANDAMENTO')}</span><strong role="timer" aria-live="off" aria-label={tr('Time remaining in phase', 'Tempo restante na fase')}>{timeLabel(clock.phaseRemainingMs)}</strong></div><div className="coach-round"><span>ROUND</span><strong>{String(clock.round).padStart(2, '0')}<small>/12</small></strong></div></div>
        <div className="coach-progress" role="progressbar" aria-label={tr('Class progress', 'Progresso da aula')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clock.elapsedMs / clock.totalMs * 100)}><span style={{ width: `${clock.elapsedMs / clock.totalMs * 100}%` }}/></div>
        <div className="coach-time-meta"><span>{timeLabel(clock.elapsedMs)} / {timeLabel(clock.totalMs)}</span><span>{selected.timing.workSeconds}s {tr('work', 'round')} · {selected.timing.restSeconds}s {tr('rest', 'descanso')}</span></div>
        <div className="coach-actions">{clock.status === 'ready' && <button className="btn btn-primary" disabled={controlsDisabled} onClick={() => act('start')}><Play size={18}/>{tr('Start class', 'Iniciar aula')}</button>}{clock.status === 'running' && <button className="btn btn-primary" disabled={controlsDisabled} onClick={() => act('pause')}><Pause size={18}/>{tr('Pause', 'Pausar')}</button>}{clock.status === 'paused' && <button className="btn btn-primary" disabled={controlsDisabled} onClick={() => act('resume')}><Play size={18}/>{tr('Resume class', 'Retomar aula')}</button>}{!terminal(clock.status) && <button className="btn btn-subtle" disabled={controlsDisabled} onClick={() => act('interrupt')}><Square size={15}/>{tr('Interrupt', 'Interromper')}</button>}{terminal(selected.state.status) && <button className="text-link" disabled={controlsDisabled} onClick={() => act('delete')}><Trash2 size={15}/>{tr('Delete record', 'Excluir registro')}</button>}</div>
        {terminal(clock.status) ? <p className="planner-disclosure">{clock.status === 'completed' ? tr('All 12 rounds have elapsed. This is a timing record, without effort certification or rewards.', 'Os 12 rounds terminaram. Este é um registro de tempo, sem certificação de esforço ou recompensas.') : tr('This class was interrupted. Prepare a new one to start again.', 'Esta aula foi interrompida. Prepare uma nova para começar novamente.')}</p> : <><div className="round-preview-heading"><span>{clock.phase === 'rest' ? tr('NEXT POSITIONS', 'PRÓXIMAS POSIÇÕES') : tr('ATHLETE POSITIONS', 'POSIÇÕES DOS ATLETAS')} / R{String(assignmentRound).padStart(2, '0')}</span><span>{selected.input.athletes.length} {tr('ATHLETES', 'ATLETAS')}</span></div><div className="round-station-grid">{stations.map(station => { const members = assignments.filter(a => a.station === station.id); return <article key={station.id} className={`round-station station-tone-${station.id}`}><div className="round-station-top"><station.icon size={21}/><span>{members.length}/{CAPACITIES[station.id as StationId]}</span></div><h3>{station[lang]}</h3><ul>{members.length ? members.map(a => <li key={a.athleteId}>{names.get(a.athleteId)}</li>) : <li className="empty-place">{tr('Available', 'Disponível')}</li>}</ul></article>; })}</div></>}
      </section>}
      <section className="saved-class-section"><div className="class-section-heading"><h2>{tr('Your class history', 'Histórico das suas aulas')}</h2><span className="tiny-label">{runs.length}/20</span></div>{runs.length ? <div className="saved-class-list">{runs.map(run => <div key={run.id} className={`saved-class ${selectedId === run.id ? 'is-active' : ''}`}><button onClick={() => setSelectedId(run.id)}><Clock3 size={20}/><span><strong>{run.input.name}</strong><small>{statusLabel(run.state.status)} · {new Date(run.createdAt).toLocaleString(pt ? 'pt-PT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span></button></div>)}</div> : <p className="saved-class-empty">{tr('Prepare a saved class to begin.', 'Prepare uma turma salva para começar.')}</p>}</section>
    </>}
  </section>;
}
