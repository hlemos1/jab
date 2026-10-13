'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Building2, Clock3, Pause, Play, RefreshCw, ShieldCheck, Square, Trash2, Users } from 'lucide-react';
import { CAPACITIES } from '@/lib/class-planner';
import { projectRun, type RunState } from '@/lib/class-run';
import type { UnitClass } from '@/lib/unit-classes';
import type { StationId } from '@/lib/effort';
import type { UnitDetail, UnitRole } from '@/lib/units';
import { stations } from './stations';
import type { Lang, Snapshot } from './types';

type ClassesResponse = {
  unitId: string; myRole: UnitRole; runs: UnitClass[]; serverNow: number;
  run?: UnitClass; code?: string; deleted?: boolean;
};
type RosterSelection = Record<string, StationId[]>;
const SIGN_IN = '/signin-with-chatgpt?return_to=%2F%3Fview%3Dunit-classes';
const isEnded = (status: RunState['status']) => status === 'completed' || status === 'interrupted';
function timeLabel(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function UnitClassesPage({ lang, ready, data, onUnits }: {
  lang: Lang; ready: boolean; data: Snapshot; onUnits: () => void;
}) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const signedIn = data.identity?.mode === 'account';
  const [expired, setExpired] = useState(false);
  const [units, setUnits] = useState<UnitDetail[]>([]);
  const [unitId, setUnitId] = useState('');
  const [runs, setRuns] = useState<UnitClass[]>([]);
  const [role, setRole] = useState<UnitRole | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<RosterSelection>({});
  const [name, setName] = useState('');
  const [work, setWork] = useState('6');
  const [rest, setRest] = useState('2');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [anchor, setAnchor] = useState<{ server: number; received: number } | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const loading = useRef<number | null>(null);
  const pending = useRef(false);
  const createRequest = useRef<{ key: string; id: string } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    const generation = epoch.current;
    if (pending.current || loading.current === generation) return;
    loading.current = generation;
    try {
      const [unitResponse, classResponse] = await Promise.all([
        fetch('/api/units', { cache: 'no-store', signal: AbortSignal.timeout(10000) }),
        unitId ? fetch(`/api/unit-classes?unitId=${encodeURIComponent(unitId)}`, {
          cache: 'no-store', signal: AbortSignal.timeout(10000),
        }) : Promise.resolve(null),
      ]);
      if (!mounted.current || generation !== epoch.current) return;
      if (unitResponse.status === 401 || classResponse?.status === 401) {
        setExpired(true); setUnits([]); setRuns([]); setRole(null); setAnchor(null);
        return;
      }
      if (!unitResponse.ok) throw new Error('SYNC');
      const snapshot = await unitResponse.json() as { units: UnitDetail[] };
      if (!mounted.current || generation !== epoch.current) return;
      setUnits(snapshot.units);
      if (!unitId || !snapshot.units.some(unit => unit.id === unitId)) {
        setRuns([]); setRole(null); setAnchor(null); setRoster({});
        setUnitId(snapshot.units[0]?.id || '');
        setLoaded(snapshot.units.length === 0); setSyncFailed(false);
        return;
      }
      if (classResponse?.status === 403 || classResponse?.status === 404) {
        setRuns([]); setRole(null); setAnchor(null); setRoster({});
        throw new Error('ACCESS_CHANGED');
      }
      if (!classResponse?.ok) throw new Error('SYNC');
      const classes = await classResponse.json() as ClassesResponse;
      if (!mounted.current || generation !== epoch.current) return;
      const unit = snapshot.units.find(item => item.id === unitId)!;
      // Never combine an old privileged roster with a newly restricted class response.
      if (classes.myRole !== unit.myRole) {
        setUnits([]); setRuns([]); setRole(null); setRoster({}); setAnchor(null);
        throw new Error('ACCESS_CHANGED');
      }
      setRole(classes.myRole);
      setRuns(classes.runs);
      setRoster(previous => Object.fromEntries(Object.entries(previous).filter(([id]) =>
        unit.members.some(member => member.id === id && member.role === 'athlete'))));
      setSelectedId(previous => classes.runs.some(run => run.id === previous) ? previous :
        (classes.runs.find(run => !isEnded(run.clock.status))?.id || classes.runs[0]?.id || ''));
      if (classes.runs.some(run => run.id === createRequest.current?.id)) createRequest.current = null;
      const received = performance.now();
      setAnchor({ server: classes.serverNow, received }); setTick(received);
      setSyncFailed(false); setLoaded(true);
    } catch (error) {
      if (mounted.current && generation === epoch.current) {
        setSyncFailed(true);
        if (error instanceof Error && error.message === 'ACCESS_CHANGED') setErrorCode('ACCESS_CHANGED');
      }
    } finally {
      if (loading.current === generation) loading.current = null;
    }
  }, [unitId]);

  useEffect(() => {
    mounted.current = true;
    if (!ready || !signedIn || expired) return () => { mounted.current = false; epoch.current++; };
    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 3000);
    const ticker = window.setInterval(() => setTick(performance.now()), 250);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false; epoch.current++;
      clearInterval(poll); clearInterval(ticker);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [ready, signedIn, expired, refresh]);

  function selectUnit(nextId: string) {
    epoch.current++;
    setUnitId(nextId); setRuns([]); setRole(null); setSelectedId(''); setRoster({});
    setAnchor(null); setLoaded(false); setErrorCode(''); setSyncFailed(false);
    createRequest.current = null;
  }

  async function command(body: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    const generation = ++epoch.current;
    setBusy(true); setErrorCode('');
    try {
      const response = await fetch('/api/unit-classes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      const result = await response.json() as ClassesResponse;
      if (!mounted.current || epoch.current !== generation) return;
      if (!response.ok) {
        if (response.status === 401) { setExpired(true); setUnits([]); }
        if ([401, 403, 404].includes(response.status)) {
          setRuns([]); setRole(null); setAnchor(null); setRoster({});
        }
        setSyncFailed(true);
        setErrorCode(result.code || (response.status === 409 ? 'CONFLICT' : 'ACTION_FAILED'));
        return;
      }
      if (result.run) {
        const run = result.run;
        setRuns(previous => [run, ...previous.filter(item => item.id !== run.id)]);
        setSelectedId(run.id);
        if (body.action === 'create') {
          createRequest.current = null;
          requestAnimationFrame(() => {
            panelRef.current?.focus();
            panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      } else if (result.deleted) {
        setRuns(previous => previous.filter(run => run.id !== body.id)); setSelectedId('');
      }
      const received = performance.now();
      setAnchor({ server: result.serverNow, received }); setTick(received);
      setSyncFailed(false);
    } catch {
      if (mounted.current && epoch.current === generation) { setErrorCode('CONNECTION'); setSyncFailed(true); }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); void refresh(); }
    }
  }

  const selectedUnit = units.find(unit => unit.id === unitId);
  const canManage = role === 'owner' || role === 'coach';
  const candidates = selectedUnit?.members.filter(member => member.role === 'athlete') || [];
  const rosterIds = Object.keys(roster).filter(id => candidates.some(member => member.id === id));
  const selected = runs.find(run => run.id === selectedId);
  const open = runs.find(run => !isEnded(run.clock.status));
  const now = anchor ? anchor.server + Math.max(0, tick - anchor.received) : 0;
  const clock = selected && anchor ? projectRun(selected.state, selected.timing, now) : selected?.clock;
  const stale = !anchor || tick - anchor.received > 12000 || syncFailed;
  const disabled = busy || stale;
  const timingValid = /^\d+$/.test(work) && /^\d+$/.test(rest) && +work >= 5 && +work <= 300 && +rest <= 120;
  const statusLabel = (status: RunState['status']) => ({
    ready: tr('Ready to start', 'Pronta para iniciar'), running: tr('In progress', 'Em andamento'),
    paused: tr('Paused', 'Pausada'), completed: tr('Completed', 'Concluída'), interrupted: tr('Interrupted', 'Interrompida'),
  })[status];
  const roleLabel = role === 'owner' ? tr('Manager', 'Gestor') : role === 'coach' ? 'Coach' : tr('Athlete', 'Atleta');
  const messages: Record<string, string> = {
    AUTH_REQUIRED: tr('Sign in again to access your unit.', 'Entre novamente para acessar sua unidade.'),
    ACCESS_CHANGED: tr('Your access changed. Refresh to load your current permissions.', 'Seu acesso mudou. Atualize para carregar suas permissões atuais.'),
    FORBIDDEN: tr('Your current role cannot perform this action.', 'Seu papel atual não permite esta ação.'),
    NOT_FOUND: tr('This class or unit is no longer available to you.', 'Esta aula ou unidade não está mais disponível para você.'),
    ACTIVE_RUN: tr('Finish or interrupt the open class before preparing another.', 'Conclua ou interrompa a aula aberta antes de preparar outra.'),
    INVALID_INPUT: tr('Check the name, selected athletes, restrictions and whole-second timing.', 'Confira o nome, os atletas selecionados, as restrições e os tempos em segundos inteiros.'),
    INVALID_MEMBERS: tr('The roster changed. Refresh and select current athletes again.', 'A equipe mudou. Atualize e selecione os atletas atuais novamente.'),
    CONFLICT: tr('Another coach changed this class. The panel is refreshing.', 'Outro coach alterou esta aula. O painel está sendo atualizado.'),
    INVALID_TRANSITION: tr('This command no longer applies. Check the updated class state.', 'Este comando não se aplica mais. Confira o estado atualizado da aula.'),
    INFEASIBLE: tr('These restrictions cannot fit the station capacities. Review the selected athletes and exclusions.', 'Estas restrições não cabem na capacidade das estações. Revise os atletas e as exclusões.'),
    SEARCH_LIMIT: tr('The planner could not finish with these restrictions. Try fewer exclusions or a smaller group.', 'O planejador não conseguiu concluir com estas restrições. Tente menos exclusões ou uma turma menor.'),
    RUN_LIMIT: tr('The unit has 20 saved classes. Delete an ended class to free space.', 'A unidade tem 20 aulas salvas. Exclua uma aula encerrada para liberar espaço.'),
    CONNECTION: tr('Connection interrupted. Refresh to check whether your action was received before retrying.', 'Conexão interrompida. Atualize para conferir se sua ação foi recebida antes de tentar novamente.'),
  };

  function create() {
    if (!canManage || disabled || !timingValid || !name.trim() || rosterIds.length < 1 || rosterIds.length > 11) return;
    const input = {
      unitId, name: name.trim(), athletes: rosterIds.map(memberId => ({ memberId, excludedStations: roster[memberId] })),
      timing: { workSeconds: +work, restSeconds: +rest },
    };
    const key = JSON.stringify(input);
    if (createRequest.current?.key !== key) createRequest.current = { key, id: crypto.randomUUID() };
    void command({ action: 'create', requestId: createRequest.current.id, ...input });
  }
  function act(action: 'start' | 'pause' | 'resume' | 'interrupt' | 'delete') {
    if (!selected || !canManage || disabled) return;
    if ((action === 'interrupt' || action === 'delete') && !window.confirm(action === 'delete'
      ? tr('Delete this ended shared class for everyone in the unit?', 'Excluir esta aula compartilhada encerrada para todos da unidade?')
      : tr('Interrupt this shared class for everyone? It cannot be resumed.', 'Interromper esta aula compartilhada para todos? Ela não poderá ser retomada.'))) return;
    void command({ action, unitId, id: selected.id, expectedRevision: selected.revision,
      ...(action === 'delete' ? {} : { requestId: crypto.randomUUID() }) });
  }
  function toggleAthlete(id: string, checked: boolean) {
    setRoster(previous => {
      const next = { ...previous };
      if (checked) next[id] = []; else delete next[id];
      return next;
    });
  }
  function toggleExclusion(id: string, stationId: StationId, checked: boolean) {
    setRoster(previous => ({ ...previous, [id]: checked
      ? [...previous[id], stationId] : previous[id].filter(station => station !== stationId) }));
  }
  const round = clock?.phase === 'rest' ? Math.min(12, clock.round + 1) : clock?.round || 1;

  return <section className="inner-page class-page coach-page units-page unit-classes-page">
    <div className="eyebrow">COMBATFIT / {tr('UNIT CLASSES', 'AULAS DA UNIDADE')}</div>
    <h1 className="page-title">{tr('One class. Your team', 'Uma aula. Sua equipe')}<span>.</span></h1>
    <p className="page-subtitle">{tr('Coaches lead together. Athletes follow their own rounds, on their own accounts.', 'Coaches conduzem juntos. Cada atleta acompanha seus rounds pela própria conta.')}</p>
    <div className="coach-toolbar">
      <button className="text-link" onClick={onUnits}><ArrowLeft size={15}/>{tr('Unit and team', 'Unidade e equipe')}</button>
      {signedIn && !expired && <>
        <span className={`coach-sync ${stale ? 'is-offline' : ''}`} role="status"><span/>{stale ? tr('Waiting for sync', 'Aguardando sincronização') : tr('Synced with server', 'Sincronizado com o servidor')}</span>
        <button className="text-link" disabled={busy || !ready} onClick={() => void refresh()}><RefreshCw size={14}/>{tr('Refresh', 'Atualizar')}</button>
      </>}
    </div>
    {!ready ? <p className="saved-class-empty">{tr('Loading your account…', 'Carregando sua conta…')}</p>
      : !signedIn || expired ? <div className="unit-signin">
        <div className="unit-symbol"><Building2 size={28}/></div>
        <h2>{tr('Join your team’s class', 'Entre na aula da sua equipe')}</h2>
        <p>{tr('Sign in with ChatGPT to see the test units you belong to and your shared classes.', 'Entre com ChatGPT para ver suas unidades de teste e suas aulas compartilhadas.')}</p>
        <a className="btn btn-primary" href={SIGN_IN} target="_top">{tr('Sign in with ChatGPT', 'Entrar com ChatGPT')}<ArrowUpRight size={17}/></a>
      </div> : <>
        <p className="planner-disclosure"><ShieldCheck size={16}/>{tr('Shared class rehearsal. The clock and roster do not confirm attendance or physical effort and do not award JAB.', 'Ensaio de aula compartilhada. Relógio e escala não confirmam presença nem esforço físico e não concedem JAB.')}</p>
        {errorCode && <p className="planner-error" role="alert">{messages[errorCode] || tr('Could not complete this action. Refresh and try again.', 'Não foi possível concluir esta ação. Atualize e tente novamente.')}</p>}
        {(syncFailed || (stale && loaded && !!unitId)) && <p className="planner-error" role="status">{tr('Waiting for the server. The displayed clock is estimated; controls return after synchronization.', 'Aguardando o servidor. O relógio exibido é estimado; os controles voltam após a sincronização.')}</p>}
        {units.length > 0 && <div className="unit-picker">
          <label htmlFor="unit-class-unit">{tr('Unit', 'Unidade')}</label>
          <select id="unit-class-unit" value={unitId} disabled={busy} onChange={event => selectUnit(event.target.value)}>
            {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          {role && <span className={`unit-role role-${role}`}>{roleLabel}</span>}
        </div>}
        {!loaded ? <p className="saved-class-empty">{syncFailed ? tr('Use Refresh to retry.', 'Use Atualizar para tentar novamente.') : tr('Loading shared classes…', 'Carregando aulas compartilhadas…')}</p>
          : !units.length ? <div className="uc-empty">
            <Users size={28}/><h2>{tr('Your team starts with a unit', 'Sua equipe começa por uma unidade')}</h2>
            <p>{tr('Create a test unit or accept an invitation first.', 'Crie uma unidade de teste ou aceite um convite primeiro.')}</p>
            <button className="btn btn-primary" onClick={onUnits}>{tr('Open unit and team', 'Abrir unidade e equipe')}</button>
          </div> : <>
            {open && <div className="coach-open"><Clock3 size={20}/><div>
              <strong>{tr('Open shared class', 'Aula compartilhada aberta')}</strong><p>{open.name} · {statusLabel(open.clock.status)}</p>
            </div><button className="btn btn-subtle" onClick={() => setSelectedId(open.id)}>{tr('Open class', 'Abrir aula')}</button></div>}
            {canManage && !open && <form className="uc-setup" onSubmit={event => { event.preventDefault(); create(); }}>
              <div className="uc-setup-heading"><span className="tiny-label">{tr('NEW SHARED CLASS', 'NOVA AULA COMPARTILHADA')}</span>
                <h2>{tr('Choose who enters the arena', 'Escolha quem entra na arena')}</h2>
                <p>{tr('Select 1–11 active athletes. Managers and coaches conduct the class. Quick rehearsal: 6 seconds per round + 2 seconds rest.', 'Selecione de 1 a 11 atletas ativos. Gestores e coaches conduzem a aula. Ensaio rápido: 6 segundos por round + 2 segundos de descanso.')}</p>
              </div>
              <div className="uc-config">
                <label>{tr('Class name', 'Nome da aula')}<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={disabled} placeholder={tr('Morning team', 'Turma da manhã')}/></label>
                <div className="coach-timing">
                  <label>{tr('Round / seconds', 'Round / segundos')}<input type="number" min={5} max={300} step={1} value={work} onChange={event => setWork(event.target.value)} disabled={disabled} required/></label>
                  <label>{tr('Rest / seconds', 'Descanso / segundos')}<input type="number" min={0} max={120} step={1} value={rest} onChange={event => setRest(event.target.value)} disabled={disabled} required/></label>
                  <span>12 rounds · {timingValid ? timeLabel((12 * +work + 11 * +rest) * 1000) : '—'}</span>
                </div>
              </div>
              <fieldset className="uc-roster" disabled={disabled}>
                <legend>{tr('Athletes', 'Atletas')} <span>{rosterIds.length}/11</span></legend>
                {!candidates.length ? <p>{tr('No active athlete yet. Invite someone as an athlete in Unit and team.', 'Ainda não há atleta ativo. Convide alguém como atleta em Unidade e equipe.')}</p> : candidates.map(member => {
                  const checked = Object.hasOwn(roster, member.id);
                  return <div className={`uc-candidate ${checked ? 'is-selected' : ''}`} key={member.id}>
                    <label className="uc-athlete-check"><input type="checkbox" checked={checked} disabled={disabled || (!checked && rosterIds.length >= 11)} onChange={event => toggleAthlete(member.id, event.target.checked)}/><span>{member.name}</span></label>
                    {checked && <details className="uc-exclusions"><summary>{tr('Station restrictions', 'Restrições de estação')} · {roster[member.id].length}</summary>
                      <p>{tr('Check stations this athlete must not use.', 'Marque as estações que este atleta não pode usar.')}</p>
                      <div>{stations.map(station => <label key={station.id}><input type="checkbox" checked={roster[member.id].includes(station.id as StationId)} onChange={event => toggleExclusion(member.id, station.id as StationId, event.target.checked)}/>{station[lang]}</label>)}</div>
                    </details>}
                  </div>;
                })}
              </fieldset>
              <div className="uc-create-footer"><p>{tr('12 rounds, respecting station capacity and each athlete’s restrictions. The sequence may use a subset of stations.', '12 rounds, respeitando a capacidade das estações e as restrições de cada atleta. A sequência pode usar parte das estações.')}</p>
                <button className="btn btn-primary" type="submit" disabled={disabled || !timingValid || !name.trim() || !rosterIds.length || rosterIds.length > 11}><Users size={17}/>{busy ? tr('Preparing…', 'Preparando…') : tr('Prepare class', 'Preparar aula')}</button>
              </div>
            </form>}
            {role === 'athlete' && <p className="uc-athlete-note">{tr('Your coach starts and controls the clock. You see only classes that include you and your own station sequence.', 'Seu coach inicia e controla o relógio. Você vê apenas as aulas em que foi incluído e sua própria sequência de estações.')}</p>}
            {selected && clock && <section className="coach-live" ref={panelRef} tabIndex={-1} aria-label={tr('Shared class', 'Aula compartilhada')}>
              <div className="coach-live-heading"><div><span className="tiny-label">{canManage ? tr('SHARED CLASS CONTROL', 'CONTROLE COMPARTILHADO') : tr('YOUR CLASS', 'SUA AULA')}</span><h2>{selected.name}</h2></div><span className={`coach-status status-${clock.status}`}>{statusLabel(clock.status)}</span></div>
              <div className={`coach-clock phase-${clock.phase}`}><div>
                <span>{clock.phase === 'rest' ? tr('REST · NEXT ROUND COMING', 'DESCANSO · PRÓXIMO ROUND A SEGUIR') : clock.status === 'ready' ? tr('WAITING FOR THE COACH', 'AGUARDANDO O COACH') : isEnded(clock.status) ? tr('CLASS ENDED', 'AULA ENCERRADA') : clock.status === 'paused' ? tr('CLOCK PAUSED', 'RELÓGIO PAUSADO') : tr('ROUND IN PROGRESS', 'ROUND EM ANDAMENTO')}</span>
                <strong role="timer" aria-live="off" aria-label={tr('Time remaining', 'Tempo restante')}>{timeLabel(clock.phaseRemainingMs)}</strong>
              </div><div className="coach-round"><span>ROUND</span><strong>{String(clock.round).padStart(2, '0')}<small>/12</small></strong></div></div>
              <div className="coach-progress" role="progressbar" aria-label={tr('Class progress', 'Progresso da aula')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clock.elapsedMs / clock.totalMs * 100)}><span style={{ width: `${clock.elapsedMs / clock.totalMs * 100}%` }}/></div>
              <div className="coach-time-meta"><span>{timeLabel(clock.elapsedMs)} / {timeLabel(clock.totalMs)}</span><span>{selected.timing.workSeconds}s {tr('work', 'round')} · {selected.timing.restSeconds}s {tr('rest', 'descanso')}</span></div>
              {canManage && <div className="coach-actions">
                {clock.status === 'ready' && <button className="btn btn-primary" disabled={disabled} onClick={() => act('start')}><Play size={18}/>{tr('Start class', 'Iniciar aula')}</button>}
                {clock.status === 'running' && <button className="btn btn-primary" disabled={disabled} onClick={() => act('pause')}><Pause size={18}/>{tr('Pause', 'Pausar')}</button>}
                {clock.status === 'paused' && <button className="btn btn-primary" disabled={disabled} onClick={() => act('resume')}><Play size={18}/>{tr('Resume', 'Retomar')}</button>}
                {!isEnded(clock.status) && <button className="btn btn-subtle" disabled={disabled} onClick={() => act('interrupt')}><Square size={15}/>{tr('Interrupt', 'Interromper')}</button>}
                {isEnded(selected.state.status) && <button className="text-link" disabled={disabled} onClick={() => act('delete')}><Trash2 size={15}/>{tr('Delete record', 'Excluir registro')}</button>}
              </div>}
              {!isEnded(clock.status) && <>
                <div className="round-preview-heading"><span>{clock.phase === 'rest' ? tr('NEXT POSITIONS', 'PRÓXIMAS POSIÇÕES') : tr('CURRENT POSITIONS', 'POSIÇÕES ATUAIS')} / R{String(round).padStart(2, '0')}</span></div>
                <div className={`round-station-grid ${!canManage ? 'uc-own-station' : ''}`}>
                  {stations.filter(station => canManage || selected.athletes.some(athlete => athlete.stations[round - 1] === station.id)).map(station => {
                    const athletes = selected.athletes.filter(athlete => athlete.stations[round - 1] === station.id);
                    return <article className={`round-station station-tone-${station.id}`} key={station.id}>
                      <div className="round-station-top"><station.icon size={22}/>{canManage && <span>{athletes.length}/{CAPACITIES[station.id as StationId]}</span>}</div><h3>{station[lang]}</h3>
                      <ul>{athletes.length ? athletes.map(athlete => <li key={athlete.memberId}>{athlete.name}</li>) : <li className="empty-place">{tr('Available', 'Disponível')}</li>}</ul>
                    </article>;
                  })}
                </div>
              </>}
              <details className="uc-sequences" open={!canManage}>
                <summary>{canManage ? tr('See all athlete sequences', 'Ver sequências dos atletas') : tr('Your 12 rounds', 'Seus 12 rounds')}</summary>
                {selected.athletes.map(athlete => <div className="uc-sequence" key={athlete.memberId}>
                  <h3>{athlete.name}</h3><ol>{athlete.stations.map((stationId, index) => <li key={index} className={index + 1 === round && !isEnded(clock.status) ? 'is-current' : ''}>
                    <span>R{String(index + 1).padStart(2, '0')}</span>{stations.find(station => station.id === stationId)?.[lang] || stationId}
                  </li>)}</ol>
                </div>)}
              </details>
              {isEnded(clock.status) && <p className="planner-disclosure">{tr('This record preserves the planned sequence and elapsed class time. It does not attest participation.', 'Este registro preserva a sequência planejada e o tempo decorrido da aula. Não atesta participação.')}</p>}
            </section>}
            <section className="saved-class-section">
              <div className="class-section-heading"><h2>{canManage ? tr('Unit class history', 'Histórico da unidade') : tr('Your shared classes', 'Suas aulas compartilhadas')}</h2>{canManage && <span className="tiny-label">{runs.length}/20</span>}</div>
              {runs.length ? <div className="saved-class-list">{runs.map(run => <div key={run.id} className={`saved-class ${selectedId === run.id ? 'is-active' : ''}`}>
                <button onClick={() => setSelectedId(run.id)} aria-pressed={selectedId === run.id}><Clock3 size={20}/><span><strong>{run.name}</strong><small>{statusLabel(run.clock.status)} · {new Date(run.createdAt).toLocaleString(pt ? 'pt-PT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span></button>
              </div>)}</div> : <p className="saved-class-empty">{canManage ? tr('Prepare the first shared class above.', 'Prepare a primeira aula compartilhada acima.') : tr('No class for you yet. Ask your coach to include you in a class.', 'Ainda não há aula para você. Peça ao coach para incluir você em uma turma.')}</p>}
            </section>
          </>}
      </>}
  </section>;
}
