'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Download, Grid2X2, Layers3, Loader2, Plus, RotateCcw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { CAPACITIES, type Athlete, type ClassInput, type ClassPlan } from '@/lib/class-planner';
import type { StationId } from '@/lib/effort';
import type { Lang } from './types';
import { stations } from './stations';

type SavedClass = { id: string; createdAt: string; input: ClassInput; plan: ClassPlan };
type Props = { lang: Lang; ready: boolean; account: boolean; onCoach: (planId?: string) => void; onUnits: () => void };
const initialRoster = (): Athlete[] => Array.from({ length: 11 }, (_, i) => ({ id: `athlete-${i + 1}`, name: `Atleta ${String(i + 1).padStart(2, '0')}`, excludedStations: [] }));

export function ClassPlannerPage({ lang, ready, account, onCoach, onUnits }: Props) {
  const pt = lang === 'pt';
  const [input, setInput] = useState<ClassInput>(() => ({ name: 'CombatFit / BOD 001', athletes: initialRoster() }));
  const [saved, setSaved] = useState<SavedClass[]>([]);
  const [active, setActive] = useState<SavedClass | null>(null);
  const [round, setRound] = useState(1);
  const [mode, setMode] = useState<'round' | 'matrix'>('round');
  const [athleteId, setAthleteId] = useState('athlete-1');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const stationName = (id: string) => stations.find(s => s.id === id)?.[lang] || id;

  async function api(body?: Record<string, unknown>) {
    const response = await fetch('/api/classes', { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json() as { plans: SavedClass[]; plan: SavedClass; code?: string; error?: string };
    if (!response.ok) {
      const messages: Record<string, string> = {
        INVALID_INPUT: tr('Check the class name, athlete names and station restrictions.', 'Confira o nome da turma, os nomes dos atletas e os bloqueios de estações.'),
        INFEASIBLE: tr('These restrictions do not allow a valid distribution. Free up stations or reduce the class.', 'Esses bloqueios não permitem uma distribuição válida. Libere estações ou reduza a turma.'),
        SEARCH_LIMIT: tr('No complete plan was found within the search limit. Adjust the restrictions and try again.', 'Não foi encontrado um plano completo no limite de busca. Ajuste os bloqueios e tente novamente.'),
      };
      throw new Error(response.status === 429 ? tr('You have 20 saved plans. Delete one to generate another.', 'Você tem 20 planos salvos. Exclua um para gerar outro.') : (data.code && messages[data.code]) || data.error || tr('Could not complete this action. Please retry.', 'Não foi possível concluir. Tente novamente.'));
    }
    return data;
  }
  function selectPlan(plan: SavedClass) {
    setActive(plan); setInput(plan.input); setRound(1); setAthleteId(plan.input.athletes[0].id); requestId.current = null; setError(''); setNotice('');
  }
  async function load() {
    setError('');
    try { const data = await api(); setSaved(data.plans); if (data.plans.length) selectPlan(data.plans[0]); setLoaded(true); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { if (ready) void load(); }, [ready]);
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [error]);
  function edit(next: ClassInput) { setInput(next); setActive(null); setError(''); setNotice(''); requestId.current = null; }
  function editAthlete(id: string, update: Partial<Athlete>) { edit({ ...input, athletes: input.athletes.map(a => a.id === id ? { ...a, ...update } : a) }); }
  function toggleStation(athlete: Athlete, station: StationId) {
    editAthlete(athlete.id, { excludedStations: athlete.excludedStations.includes(station) ? athlete.excludedStations.filter(s => s !== station) : [...athlete.excludedStations, station] });
  }
  function addAthlete() {
    if (input.athletes.length >= 11) return;
    edit({ ...input, athletes: [...input.athletes, { id: crypto.randomUUID(), name: '', excludedStations: [] }] });
  }
  async function generate() {
    setBusy(true); setError(''); setNotice('');
    requestId.current ||= crypto.randomUUID();
    try {
      const data = await api({ action: 'generate', requestId: requestId.current, input: { name: input.name.trim(), athletes: input.athletes.map(a => ({ ...a, name: a.name.trim() })) } });
      selectPlan(data.plan);
      setSaved(previous => [data.plan, ...previous.filter(p => p.id !== data.plan.id)]);
      setNotice(tr('Distribution saved. Explore the rounds below.', 'Distribuição salva. Explore os rounds abaixo.'));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function removePlan(plan: SavedClass) {
    if (!window.confirm(tr('Delete this saved class plan?', 'Excluir este plano de turma salvo?'))) return;
    setBusy(true); setError('');
    try {
      await api({ action: 'delete', id: plan.id });
      setSaved(previous => previous.filter(p => p.id !== plan.id));
      if (active?.id === plan.id) setActive(null);
      setNotice(tr('Plan deleted.', 'Plano excluído.'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function download() {
    if (!active) return;
    const blob = new Blob([JSON.stringify({ ...active, disclosure: 'Demonstration class allocation. Not a completed workout or the production StrikeX Solver.' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `strikex-class-${active.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  const chosen = active?.input.athletes.find(a => a.id === athleteId) || active?.input.athletes[0];
  const roundData = active?.plan.rounds.find(r => r.round === round);
  const names = new Map(active?.input.athletes.map(a => [a.id, a.name]) || []);
  const invalid = !input.name.trim() || input.athletes.some(a => !a.name.trim() || a.excludedStations.length > 4);

  return <section className="inner-page class-page">
    <div className="coach-entry"><button className="text-link" onClick={onUnits}>{tr('Unit & team', 'Unidade e equipe')}<Users size={16}/></button><button className="btn btn-subtle" onClick={() => onCoach(active?.id)}>{tr('Coach panel', 'Painel do coach')}<ArrowRight size={16}/></button></div>
    <div className="eyebrow">COMBATFIT / {tr('CLASS PLANNER', 'PLANEJADOR DE TURMA')}</div>
    <h1 className="page-title">{tr('One arena. Every athlete.', 'Uma arena. Cada atleta.')}<span></span></h1>
    <p className="page-subtitle">{tr('Build your class and preview where each athlete goes in every round.', 'Monte a turma e veja onde cada atleta fica em cada round.')}</p>
    <div className="class-rules"><span><Users size={15}/>{tr('Up to 11 athletes', 'Até 11 atletas')}</span><span><RotateCcw size={15}/>12 rounds</span><span><ShieldCheck size={15}/>{tr('No consecutive station repeat', 'Sem repetir a estação em sequência')}</span></div>
    {error && <div className="planner-error" ref={errorRef} role="alert">{error}{!loaded && <button className="text-link" onClick={load}>{tr('Retry', 'Tentar novamente')}<RotateCcw size={14}/></button>}</div>}
    {!ready || !loaded ? <div className="account-loading" role="status"><Loader2 className="spin" size={22}/>{tr('Loading class plans…', 'Carregando planos de turma…')}</div> : <>
      <div className="class-editor-layout">
        <section className="class-editor" aria-labelledby="roster-title">
          <div className="class-section-heading"><div><span className="tiny-label">01 / {tr('BUILD THE CLASS', 'MONTE A TURMA')}</span><h2 id="roster-title">{tr('Who’s in the arena?', 'Quem entra na arena?')}</h2></div><span className="roster-count">{input.athletes.length}<small>/11</small></span></div>
          <label className="class-label" htmlFor="class-name">{tr('Class name', 'Nome da turma')}</label><input id="class-name" className="class-input" value={input.name} maxLength={80} onChange={e => edit({ ...input, name: e.target.value })} disabled={busy}/>
          <div className="roster-list">{input.athletes.map((a, i) => <div className="roster-row" key={a.id}>
            <div className="roster-main"><span className="roster-number">{String(i + 1).padStart(2, '0')}</span><input className="class-input" aria-label={`${tr('Athlete', 'Atleta')} ${i + 1}`} value={a.name} maxLength={60} placeholder={tr('Athlete name', 'Nome do atleta')} onChange={e => editAthlete(a.id, { name: e.target.value })} disabled={busy}/><button className="roster-remove" disabled={busy || input.athletes.length === 1} onClick={() => edit({ ...input, athletes: input.athletes.filter(x => x.id !== a.id) })} aria-label={`${tr('Remove', 'Remover')} ${a.name || i + 1}`}><Trash2 size={15}/></button></div>
            <details className="station-exclusions"><summary>{tr('Station restrictions', 'Bloqueios de estações')}<span>{a.excludedStations.length ? `${a.excludedStations.length} ${tr('blocked', 'bloqueadas')}` : tr('None', 'Nenhum')}<ChevronDown size={12}/></span></summary><div className="exclusion-options">{stations.map(s => <label key={s.id}><input type="checkbox" checked={a.excludedStations.includes(s.id as StationId)} onChange={() => toggleStation(a, s.id as StationId)} disabled={busy}/>{s[lang]}</label>)}</div><p>{tr('Checked stations are excluded for this athlete. At least two must remain available.', 'Estações marcadas ficam fora da sequência deste atleta. Deixe pelo menos duas disponíveis.')}</p>{a.excludedStations.length > 4 && <strong className="restriction-warning">{tr('Free up another station to continue.', 'Libere mais uma estação para continuar.')}</strong>}</details>
          </div>)}</div>
          <button className="add-athlete" disabled={busy || input.athletes.length >= 11} onClick={addAthlete}><Plus size={16}/>{tr('Add athlete', 'Adicionar atleta')}</button>
        </section>
        <aside className="class-config"><span className="tiny-label">{tr('STANDARD ARENA', 'ARENA STANDARD')}</span><h2>{tr('A place for every round.', 'Uma vaga a cada round.')}</h2><p>{tr('Simultaneous capacity by station. A plan is saved only when the entire class fits.', 'Capacidade simultânea por estação. O plano só é salvo quando a turma inteira cabe.')}</p><div className="capacity-list">{stations.map(s => <div key={s.id}><s.icon size={17}/><span>{s[lang]}</span><b>{CAPACITIES[s.id as StationId]}</b></div>)}</div><div className="capacity-total"><span>{tr('Total places', 'Vagas totais')}</span><strong>11</strong></div><button className="btn btn-primary" disabled={busy || invalid} onClick={generate}>{busy ? <Loader2 size={17} className="spin"/> : <Layers3 size={17}/>} {active ? tr('Generate a new plan', 'Gerar novo plano') : tr('Generate distribution', 'Gerar distribuição')}<ArrowRight size={16}/></button><p className="class-save-note">{account ? tr('Saved to your account.', 'Salvo na sua conta.') : tr('Saved to this browser’s guest profile.', 'Salvo no perfil visitante deste navegador.')}</p><div className="class-demo-label">{tr('PLANNING DEMO', 'DEMONSTRAÇÃO DE PLANEJAMENTO')}</div></aside>
      </div>
      {notice && <p className="planner-notice" role="status"><CheckCircle2 size={17}/>{notice}</p>}
      {active && <section className="class-result" ref={resultRef} aria-labelledby="distribution-title">
        <div className="class-section-heading"><div><span className="tiny-label">02 / {tr('DISTRIBUTION SAVED', 'DISTRIBUIÇÃO SALVA')}</span><h2 id="distribution-title">{active.input.name}</h2></div><button className="text-link" onClick={download}><Download size={16}/>{tr('Export plan', 'Exportar plano')}</button></div>
        <div className="planner-view-tabs" role="group" aria-label={tr('Plan view', 'Visualização do plano')}><button aria-pressed={mode === 'round'} onClick={() => setMode('round')} className={mode === 'round' ? 'selected' : ''}><Layers3 size={15}/>{tr('By round', 'Por round')}</button><button aria-pressed={mode === 'matrix'} onClick={() => setMode('matrix')} className={mode === 'matrix' ? 'selected' : ''}><Grid2X2 size={15}/>{tr('Full schedule', 'Grade completa')}</button></div>
        {mode === 'round' ? <><div className="round-selector" role="group" aria-label={tr('Select round', 'Selecionar round')}>{active.plan.rounds.map(r => <button key={r.round} aria-pressed={round === r.round} className={round === r.round ? 'selected' : ''} onClick={() => setRound(r.round)}><small>R</small>{String(r.round).padStart(2, '0')}</button>)}</div><div className="round-preview-heading"><button disabled={round === 1} onClick={() => setRound(v => v - 1)} aria-label={tr('Previous round', 'Round anterior')}><ArrowLeft size={17}/></button><span>{tr('PREVIEW', 'PRÉVIA')} / ROUND {String(round).padStart(2, '0')}</span><button disabled={round === 12} onClick={() => setRound(v => v + 1)} aria-label={tr('Next round', 'Próximo round')}><ArrowRight size={17}/></button></div><div className="round-station-grid">{stations.map(s => { const occupants = roundData?.assignments.filter(a => a.station === s.id) || []; return <article className={`round-station station-tone-${s.id}`} key={s.id}><div className="round-station-top"><s.icon size={22} strokeWidth={1.5}/><span>{occupants.length}/{active.plan.capacities[s.id as StationId]}</span></div><h3>{s[lang]}</h3><ul>{occupants.length ? occupants.map(a => <li key={a.athleteId}>{names.get(a.athleteId)}</li>) : <li className="empty-place">{tr('Available', 'Vaga livre')}</li>}</ul></article>; })}</div></> : <div className="class-matrix-scroll" tabIndex={0} role="region" aria-label={tr('Class schedule, scroll horizontally', 'Grade da turma, role na horizontal')}><table className="class-matrix"><caption>{tr('Station assigned to each athlete in every round', 'Estação de cada atleta em cada round')}</caption><thead><tr><th scope="col">{tr('Athlete', 'Atleta')}</th>{active.plan.rounds.map(r => <th key={r.round} scope="col">R{String(r.round).padStart(2, '0')}</th>)}</tr></thead><tbody>{active.input.athletes.map(a => <tr key={a.id}><th scope="row">{a.name}</th>{active.plan.rounds.map(r => { const station = r.assignments.find(x => x.athleteId === a.id)?.station; return <td key={r.round}><span className={`matrix-station station-tone-${station}`} title={stationName(station || '')}>{stationName(station || '')}</span></td>; })}</tr>)}</tbody></table></div>}
        <div className="athlete-journey"><div><label className="tiny-label" htmlFor="journey-athlete">{tr('FOLLOW AN ATHLETE', 'ACOMPANHE UM ATLETA')}</label><select id="journey-athlete" value={chosen?.id} onChange={e => setAthleteId(e.target.value)}>{active.input.athletes.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></div><ol>{active.plan.rounds.map(r => <li key={r.round}><small>R{String(r.round).padStart(2, '0')}</small><span>{stationName(r.assignments.find(a => a.athleteId === chosen?.id)?.station || '')}</span></li>)}</ol></div>
        <p className="planner-disclosure"><ShieldCheck size={16}/>{tr('Capacity, manual exclusions and consecutive repetition are checked. This demo does not include the production Solver’s weekly history, categories or protection rules. Previewing rounds does not start a class or award JAB.', 'Vagas, bloqueios manuais e repetição consecutiva são verificados. Esta demo ainda não incorpora histórico semanal, categorias ou regras de proteção do Solver de produção. A prévia não inicia uma aula nem gera JAB.')}</p>
      </section>}
      <section className="saved-class-section"><div className="class-section-heading"><div><span className="tiny-label">{tr('COME BACK TO YOUR PLAN', 'RETOME SEU PLANO')}</span><h2>{tr('Saved classes', 'Turmas salvas')} <small>{saved.length}/20</small></h2></div></div>{!saved.length ? <p className="saved-class-empty">{tr('Your first distribution will appear here.', 'Sua primeira distribuição vai aparecer aqui.')}</p> : <div className="saved-class-list">{saved.map(plan => <div className={`saved-class ${active?.id === plan.id ? 'is-active' : ''}`} key={plan.id}><button disabled={busy} onClick={() => { selectPlan(plan); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}><Layers3 size={20}/><span><strong>{plan.input.name}</strong><small>{plan.input.athletes.length} {tr('athletes', 'atletas')} · 12 rounds · {new Date(plan.createdAt).toLocaleString(pt ? 'pt-BR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><ArrowRight size={17}/></button><button disabled={busy} className="delete-class" aria-label={`${tr('Delete plan', 'Excluir plano')} ${plan.input.name}`} onClick={() => removePlan(plan)}><Trash2 size={16}/></button></div>)}</div>}</section>
    </>}
  </section>;
}
