'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Building2, Check, CheckCircle2, Clock3, Compass, Flag, Gift, HelpCircle, Layers3, LockKeyhole, Play, ShieldCheck, Target, Trophy, UserRound, Users, X } from 'lucide-react';
import { guideLessons, type GuideLesson, type GuideRole } from './onboarding-content';
import { GUIDE_STORAGE_KEY, lessonsFor, markLessonRead, restoreGuide } from './onboarding-state';
import type { Lang, View } from './types';

type Props = { lang: Lang; autoStart: boolean; onNavigate: (view: View) => void };
type GuideMode = 'welcome' | 'lessons' | 'finish';
const roleIcons = { athlete: Target, coach: Users, manager: Building2 };
const visualIcons = { loop: Layers3, account: UserRound, session: Play, receipt: ShieldCheck, rewards: Gift, units: Building2, planner: Users, clock: Clock3, report: Flag, privacy: LockKeyhole };

function LessonVisual({ lesson, lang }: { lesson: GuideLesson; lang: Lang }) {
  const pt = lang === 'pt';
  const Icon = visualIcons[lesson.visual];
  if (lesson.visual === 'loop') return <div className="sx-guide-loop" aria-label={pt ? 'O caminho na plataforma' : 'Your path through the platform'}>{[
    [UserRound, pt ? 'Entre' : 'Join'], [Play, pt ? 'Experimente' : 'Experience'], [ShieldCheck, pt ? 'Entenda' : 'Understand'], [Trophy, pt ? 'Evolua' : 'Progress'],
  ].map(([Item, label], index) => { const Symbol = Item as typeof UserRound; return <div key={index}><span>0{index + 1}</span><Symbol size={23}/><strong>{label as string}</strong></div>; })}</div>;
  if (lesson.visual === 'session' || lesson.visual === 'clock') return <div className="sx-guide-preview"><div><Icon size={20}/><span>{pt ? 'EXEMPLO EXPLICATIVO' : 'ILLUSTRATIVE EXAMPLE'}</span></div><strong className="sx-guide-time">{lesson.visual === 'session' ? '01:12' : 'R01 / 12'}</strong><div className="sx-guide-rounds" aria-hidden="true">{Array.from({length:12}, (_,i)=><span className={i===0?'is-current':''} key={i}/>)}</div><p>{lesson.visual === 'session' ? (pt ? '12 rounds × 6 segundos · demonstração individual' : '12 rounds × 6 seconds · individual demo') : (pt ? 'Pronto → Round → Descanso → Próximo round' : 'Ready → Round → Rest → Next round')}</p></div>;
  const caption = {
    account: pt ? 'VISITANTE ≠ CONTA' : 'GUEST ≠ ACCOUNT',
    receipt: pt ? 'RESULTADO → COMPROVANTE' : 'RESULT → RECEIPT',
    rewards: pt ? 'JAB DE DEMONSTRAÇÃO' : 'DEMONSTRATION JAB',
    units: pt ? 'GESTOR · COACH · ATLETA' : 'MANAGER · COACH · ATHLETE',
    planner: '3 / 3 / 2 / 1 / 1 / 1',
    report: pt ? 'REVISAR → CONFIRMAR → GUARDAR' : 'REVIEW → CONFIRM → SAVE',
    privacy: pt ? 'SEUS DADOS. SEU ACESSO.' : 'YOUR DATA. YOUR ACCESS.',
  }[lesson.visual];
  return <div className={`sx-guide-preview sx-guide-preview-${lesson.visual}`}><div><Icon size={22}/><span>{lesson.kicker[lang]}</span></div><strong className="sx-guide-preview-title">{caption}</strong><p>{lesson.visual === 'planner' ? (pt ? 'Volume · Técnica · Força · Velocidade · VR · Reflexo' : 'Volume · Technique · Power · Speed · VR · Reflex') : (pt ? 'Leia os passos abaixo e abra a tela quando quiser experimentar.' : 'Read the steps below, then open the screen whenever you are ready.')}</p></div>;
}

export function OnboardingGuide({ lang, autoStart, onNavigate }: Props) {
  const pt = lang === 'pt';
  const [state, setState] = useState(() => restoreGuide(null, guideLessons));
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GuideMode>('welcome');
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const offered = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visible = lessonsFor(state.role, guideLessons);
  const lesson = visible.find(item => item.id === state.lessonId) || visible[0];
  const index = visible.indexOf(lesson);
  const readCount = visible.filter(item => state.completed.includes(item.id)).length;
  const roleLabel = (role: GuideRole) => ({ athlete: pt ? 'Atleta' : 'Athlete', coach: 'Coach', manager: pt ? 'Gestor' : 'Manager' }[role]);

  useEffect(() => {
    let saved = restoreGuide(null, guideLessons);
    try { saved = restoreGuide(localStorage.getItem(GUIDE_STORAGE_KEY), guideLessons); } catch { setStorageUnavailable(true); }
    setState(saved);
    setLoaded(true);
    if (new URLSearchParams(window.location.search).get('guide') === '1') {
      offered.current = true; setMode(saved.started ? 'lessons' : 'welcome'); setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(state)); } catch { setStorageUnavailable(true); }
  }, [loaded, state]);

  useEffect(() => {
    if (!loaded || !autoStart || offered.current || state.dismissed) return;
    offered.current = true; setMode(state.started ? 'lessons' : 'welcome'); setOpen(true);
  }, [autoStart, loaded, state.dismissed, state.started]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setState(previous => ({ ...previous, dismissed: true }));
    const url = new URL(window.location.href);
    if (url.searchParams.has('guide')) { url.searchParams.delete('guide'); window.history.replaceState(null, '', url); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const app = document.querySelector<HTMLElement>('.app-shell');
    const previousInert = app?.inert || false;
    if (app) app.inert = true;
    document.body.style.overflow = 'hidden';
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,[tabindex="0"]') || []).filter(node => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (app) app.inert = previousInert;
      if (previous?.isConnected && previous !== document.body) previous.focus(); else triggerRef.current?.focus();
    };
  }, [open, dismiss]);

  useEffect(() => {
    if (!open) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    headingRef.current?.focus();
  }, [open, mode, state.lessonId, state.role]);

  function openGuide() {
    offered.current = true; setMode(state.started ? 'lessons' : 'welcome'); setOpen(true);
  }
  function chooseRole(role: GuideRole) {
    const lessons = lessonsFor(role, guideLessons);
    setState(previous => ({ ...previous, role, lessonId: previous.role === role && lessons.some(item => item.id === previous.lessonId) ? previous.lessonId : (lessons.find(item => !previous.completed.includes(item.id)) || lessons[0]).id }));
  }
  function advance() {
    const next = markLessonRead(state, guideLessons);
    setState(next.state);
    if (next.finished) setMode('finish');
  }
  function openScreen(view: View) {
    dismiss(); onNavigate(view);
    requestAnimationFrame(() => {
      const title = document.querySelector<HTMLElement>('main h1');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
    });
  }

  return <>
    <button ref={triggerRef} className="sx-guide-trigger" onClick={openGuide} aria-label={pt ? 'Abrir guia da plataforma' : 'Open platform guide'} aria-haspopup="dialog" aria-expanded={open} title={pt ? 'Guia da plataforma' : 'Platform guide'}><HelpCircle size={18}/><span>{pt ? 'Guia' : 'Guide'}</span></button>
    {loaded && open && createPortal(<div className="sx-guide-backdrop">
      <section className={`sx-guide-dialog sx-guide-mode-${mode}`} role="dialog" aria-modal="true" aria-labelledby="sx-guide-title" ref={dialogRef}>
        <header className="sx-guide-header"><div><img src="/brand/strikex-logo.png" alt="StrikeX" width="345" height="70"/><span><BookOpen size={14}/>{pt ? 'GUIA DA PLATAFORMA' : 'PLATFORM GUIDE'}</span></div><button className="sx-guide-close" onClick={dismiss} aria-label={pt ? 'Fechar e continuar depois' : 'Close and continue later'}><X size={21}/></button></header>
        {mode === 'welcome' ? <div className="sx-guide-welcome" ref={scrollRef}>
          <div className="sx-guide-welcome-art"><div><span>COMBATFIT / STRIKEX</span><strong>{pt ? 'SEU PRIMEIRO ROUND.' : 'YOUR FIRST ROUND.'}</strong><p>{pt ? 'Conheça o caminho antes de entrar na arena.' : 'Know your way before entering the arena.'}</p></div></div>
          <div className="sx-guide-welcome-copy"><span className="sx-guide-kicker">{pt ? 'BEM-VINDO À STRIKEX' : 'WELCOME TO STRIKEX'}</span><h2 id="sx-guide-title" ref={headingRef} tabIndex={-1}>{pt ? 'Vamos por partes.' : 'One step at a time.'}</h2><p>{pt ? 'Entenda o treino, o resultado e a operação da unidade. Escolha por onde começar; você pode trocar de trilha a qualquer momento.' : 'Learn how training, results and unit operations work. Choose where to begin; you can switch paths at any time.'}</p>
            <div className="sx-guide-roles" role="group" aria-label={pt ? 'Escolha sua trilha' : 'Choose your path'}>{(['athlete','coach','manager'] as GuideRole[]).map(role => { const Icon = roleIcons[role]; return <button key={role} aria-pressed={state.role===role} onClick={()=>chooseRole(role)}><Icon size={22}/><span><strong>{roleLabel(role)}</strong><small>{role==='athlete' ? (pt ? 'Treinar, acompanhar e participar.' : 'Train, track and participate.') : role==='coach' ? (pt ? 'Planejar e conduzir aulas.' : 'Plan and run classes.') : (pt ? 'Organizar unidade, equipe e acesso.' : 'Organize your unit, team and access.')}</small></span><b>{lessonsFor(role, guideLessons).length} {pt ? 'etapas' : 'steps'}</b>{state.role===role&&<Check size={15}/>}</button>; })}</div>
            <p className="sx-guide-permission-note"><LockKeyhole size={14}/>{pt ? 'A trilha só adapta o guia. Seu acesso depende do papel recebido na unidade.' : 'The path only adapts this guide. Your access depends on your assigned unit role.'}</p>
            {storageUnavailable && <p className="sx-guide-storage" role="status">{pt ? 'O navegador não permite salvar este guia. A leitura será mantida apenas enquanto a página estiver aberta.' : 'This browser cannot save the guide. Reading progress lasts only while this page remains open.'}</p>}
            <button className="btn btn-primary sx-guide-start" onClick={()=>{setState(previous=>({...previous,started:true}));setMode('lessons')}}>{state.started ? (pt ? 'Continuar meu guia' : 'Continue my guide') : (pt ? 'Começar meu guia' : 'Start my guide')}<ArrowRight size={18}/></button><button className="sx-guide-skip" onClick={dismiss}>{pt ? 'Explorar agora e ver depois' : 'Explore now and read later'}</button>
          </div>
        </div> : mode === 'finish' ? <div className="sx-guide-finish" ref={scrollRef}><CheckCircle2 size={46}/><span className="sx-guide-kicker">{pt ? 'TRILHA LIDA' : 'PATH READ'} / {roleLabel(state.role).toUpperCase()}</span><h2 id="sx-guide-title" ref={headingRef} tabIndex={-1}>{pt ? 'Agora, entre no round.' : 'Now, enter the round.'}</h2><p>{pt ? `Você percorreu as ${visible.length} etapas do guia. A leitura não cria uma conta nem executa uma aula; o próximo passo é experimentar na plataforma.` : `You have read all ${visible.length} guide steps. Reading does not create an account or run a class; your next step is to try the platform.`}</p><div className="sx-guide-finish-actions"><button className="btn btn-primary" onClick={()=>openScreen(state.role==='athlete'?'arena':'units')}>{state.role==='athlete' ? (pt ? 'Experimentar a arena' : 'Try the arena') : (pt ? 'Abrir unidade e equipe' : 'Open unit & team')}<ArrowUpRight size={18}/></button><button className="btn btn-subtle" onClick={()=>{setState(previous=>({...previous,lessonId:visible[0].id}));setMode('lessons')}}>{pt ? 'Consultar o guia' : 'Review the guide'}</button><button className="sx-guide-skip" onClick={()=>setMode('welcome')}>{pt ? 'Conhecer outra trilha' : 'Explore another path'}</button></div><p className="sx-guide-return-note"><HelpCircle size={16}/>{pt ? 'O botão Guia fica sempre no topo da plataforma.' : 'The Guide button stays at the top of the platform.'}</p></div> : <>
          <div className="sx-guide-workspace"><aside className="sx-guide-index"><div className="sx-guide-track-label"><Compass size={18}/><strong>{roleLabel(state.role)}</strong></div><button className="sx-guide-change-role" onClick={()=>setMode('welcome')}>{pt ? 'Trocar trilha' : 'Change path'}<ArrowRight size={13}/></button><div className="sx-guide-progress"><span>{readCount}/{visible.length} {pt ? 'etapas lidas' : 'steps read'}</span><progress value={readCount} max={visible.length} aria-label={pt ? 'Etapas lidas' : 'Steps read'}/></div><nav aria-label={pt ? 'Etapas do guia' : 'Guide steps'}>{visible.map((item, i)=><button key={item.id} className={lesson.id===item.id?'is-active':''} aria-current={lesson.id===item.id?'step':undefined} onClick={()=>setState(previous=>({...previous,lessonId:item.id}))}><span>{state.completed.includes(item.id)?<Check size={14}/>:String(i+1).padStart(2,'0')}</span><span>{item.title[lang]}</span>{state.completed.includes(item.id)&&<span className="sx-guide-sr">{pt ? 'Lida' : 'Read'}</span>}</button>)}</nav></aside>
            <div className="sx-guide-body" ref={scrollRef}><div className="sx-guide-mobile-nav"><label htmlFor="sx-guide-step">{roleLabel(state.role)} · {readCount}/{visible.length} {pt ? 'lidas' : 'read'}</label><select id="sx-guide-step" value={lesson.id} onChange={event=>setState(previous=>({...previous,lessonId:event.target.value}))}>{visible.map((item,i)=><option key={item.id} value={item.id}>{String(i+1).padStart(2,'0')} · {item.title[lang]}{state.completed.includes(item.id)?' ✓':''}</option>)}</select><button onClick={()=>setMode('welcome')}>{pt ? 'Trocar trilha' : 'Change path'}</button></div>
              <div className="sx-guide-lesson-heading"><span className="sx-guide-kicker">{String(index+1).padStart(2,'0')} / {String(visible.length).padStart(2,'0')} · {lesson.kicker[lang]}</span><h2 id="sx-guide-title" ref={headingRef} tabIndex={-1}>{lesson.title[lang]}</h2><p>{lesson.intro[lang]}</p></div><LessonVisual lesson={lesson} lang={lang}/><h3 className="sx-guide-steps-heading">{pt ? 'Como funciona, passo a passo' : 'How it works, step by step'}</h3><ol className="sx-guide-steps">{lesson.steps[lang].map((step,i)=><li key={`${lesson.id}-${i}`}><span aria-hidden="true">{i+1}</span><p>{step}</p></li>)}</ol><div className="sx-guide-note"><ShieldCheck size={19}/><p>{lesson.note[lang]}</p></div><button className="sx-guide-open-screen" onClick={()=>openScreen(lesson.view)}>{lesson.actionLabel[lang]}<ArrowUpRight size={17}/></button><p className="sx-guide-return-note">{pt ? 'O guia fecha para você experimentar. Sua leitura fica neste navegador; retome pelo botão Guia, no topo.' : 'The guide closes so you can explore. Reading progress stays in this browser; resume with the Guide button at the top.'}</p>
              {storageUnavailable&&<p className="sx-guide-storage" role="status">{pt ? 'Leitura salva apenas nesta sessão do navegador.' : 'Reading progress is only kept for this browser session.'}</p>}
            </div>
          </div><div className="sx-guide-footer"><button className="sx-guide-back" onClick={()=>index===0?setMode('welcome'):setState(previous=>({...previous,lessonId:visible[index-1].id}))}><ArrowLeft size={17}/>{pt ? 'Voltar' : 'Back'}</button><span>{storageUnavailable ? (pt ? 'Leitura mantida nesta sessão.' : 'Reading kept for this session.') : (pt ? 'Leitura salva neste navegador.' : 'Reading saved in this browser.')}</span><button className="btn btn-primary" onClick={advance}>{index===visible.length-1 ? (pt ? 'Concluir leitura' : 'Finish reading') : (pt ? 'Entendi. Próximo' : 'Got it. Next')}<ArrowRight size={17}/></button></div>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
