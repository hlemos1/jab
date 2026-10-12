'use client';

import { ArrowRight, ArrowUpRight, Check, Flame, History, Loader2, LogOut, Pencil, ShieldCheck, Target, Trophy, UserRound, Zap } from 'lucide-react';
import type { Lang, Snapshot } from './types';

type Props = {
  lang: Lang;
  data: Snapshot;
  ready: boolean;
  busy: boolean;
  onEdit: () => void;
  onTrain: () => void;
  onHistory: () => void;
};

export function AccountPage({ lang, data, ready, busy, onEdit, onTrain, onHistory }: Props) {
  const pt = lang === 'pt';
  const signedIn = data.identity?.mode === 'account';
  const profile = data.profile;
  const Avatar = ({ '01': Zap, '02': Flame, '03': Target, '04': Trophy } as const)[profile?.avatar as '01'] || UserRound;
  const latest = data.sessions[0];
  const steps = [
    { done: signedIn, title: pt ? 'Conecte sua conta' : 'Connect your account', text: pt ? 'Recupere seu progresso ao entrar novamente.' : 'Recover your progress when you sign in again.' },
    { done: !!profile, title: pt ? 'Escolha seu nome na arena' : 'Choose your arena name', text: pt ? 'Um nome e uma marca para o seu perfil.' : 'A name and a mark for your profile.' },
    { done: data.sessions.length > 0, title: pt ? 'Complete sua primeira batalha' : 'Complete your first battle', text: pt ? 'Veja o resultado salvo no seu histórico.' : 'See your result saved in your history.' },
  ];

  return <section className="inner-page account-page">
    <div className="eyebrow">STRIKEX / {pt ? 'MINHA CONTA' : 'MY ACCOUNT'}</div>
    <h1 className="page-title">{pt ? 'Sua jornada começa aqui' : 'Your journey starts here'}<span>.</span></h1>
    <p className="page-subtitle">{pt ? 'Seu perfil, suas batalhas e o próximo passo na arena.' : 'Your profile, your battles and your next step in the arena.'}</p>

    {!ready ? <div className="account-loading" role="status"><Loader2 className="spin" size={24}/>{pt ? 'Carregando seu perfil…' : 'Loading your profile…'}</div> : <>
      <div className="account-grid">
        <article className="athlete-card">
          <div className="account-card-top"><span className="tiny-label">{pt ? 'PERFIL DO ATLETA' : 'ATHLETE PROFILE'}</span><span className={`account-status ${signedIn ? 'connected' : ''}`}><span/>{signedIn ? (pt ? 'Conta conectada' : 'Account connected') : (pt ? 'Visitante' : 'Guest')}</span></div>
          <div className="athlete-identity"><div className="athlete-avatar"><Avatar size={40} strokeWidth={1.3}/></div><div><h2>{profile?.name || (pt ? 'Qual é a sua marca?' : 'What’s your mark?')}</h2><p>{profile ? (pt ? 'Atleta StrikeX · Demonstração' : 'StrikeX athlete · Demonstration') : (pt ? 'Personalize seu perfil para começar.' : 'Make your profile yours to get started.')}</p></div></div>
          <div className="account-storage"><ShieldCheck size={18}/><p>{signedIn ? (pt ? 'Seu perfil e histórico ficam vinculados a esta conta. Entre com a mesma conta em outro dispositivo para continuar.' : 'Your profile and history are linked to this account. Sign in with the same account on another device to continue.') : (pt ? 'Seu progresso de visitante fica associado a este navegador. Entre para criar um histórico recuperável com sua conta.' : 'Guest progress is associated with this browser. Sign in to create a history you can recover with your account.')}</p></div>
          <button className="btn btn-subtle" onClick={onEdit} disabled={busy}>{profile ? (pt ? 'Editar perfil' : 'Edit profile') : (pt ? 'Criar meu perfil' : 'Create my profile')}<Pencil size={15}/></button>
          {signedIn ? <a className="account-signout" href={data.identity!.signOutUrl} target="_top"><LogOut size={14}/>{pt ? 'Sair da conta' : 'Sign out'}</a> : <div className="account-connect"><a className="btn btn-primary" href={data.identity?.signInUrl} target="_top">{pt ? 'Entrar com ChatGPT' : 'Sign in with ChatGPT'}<ArrowUpRight size={17}/></a><p>{pt ? 'A conta e o modo visitante têm históricos separados. O progresso de visitante não é transferido ao entrar.' : 'Account and guest histories are separate. Guest progress is not transferred when you sign in.'}</p></div>}
        </article>
        <article className="journey-card">
          <span className="tiny-label">{pt ? 'SEU PRÓXIMO PASSO' : 'YOUR NEXT STEP'}</span>
          <h2>{pt ? 'Entre no seu ritmo.' : 'Find your rhythm.'}</h2>
          <ol className="journey-steps">{steps.map((step, i) => <li key={step.title} className={step.done ? 'is-done' : ''}><span className="journey-number">{step.done ? <Check size={15}/> : String(i + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}</ol>
          <button className="btn btn-primary" onClick={onTrain} disabled={busy}>{data.sessions.length ? (pt ? 'Ir para a próxima batalha' : 'Start your next battle') : (pt ? 'Experimentar a primeira batalha' : 'Try your first battle')}<ArrowRight size={17}/></button>
          <span className="account-demo-note">{pt ? '72 segundos · Treino simulado · Sem carteira' : '72 seconds · Simulated workout · No wallet'}</span>
        </article>
      </div>
      <article className="account-history"><div className="account-history-icon"><History size={22}/></div><div><span className="tiny-label">{pt ? 'SEU HISTÓRICO' : 'YOUR HISTORY'}</span><h3>{data.sessions.length ? `${data.sessions.length} ${pt ? (data.sessions.length === 1 ? 'batalha registrada' : 'batalhas registradas') : (data.sessions.length === 1 ? 'battle recorded' : 'battles recorded')}` : (pt ? 'A primeira batalha é o começo.' : 'The first battle is your beginning.')}</h3><p>{latest ? `${pt ? 'Último resultado' : 'Latest result'}: ${latest.result.score}/100 · ${new Date(latest.createdAt).toLocaleDateString(pt ? 'pt-BR' : 'en-GB')}` : (pt ? 'Ao concluir, seu resultado aparece aqui.' : 'Your result appears here when you finish.')}</p></div><button className="text-link" onClick={onHistory}>{pt ? 'Ver atividade' : 'View activity'}<ArrowUpRight size={17}/></button></article>
      <p className="disclosure account-boundary"><ShieldCheck size={15}/>{pt ? 'Os treinos, pontos JAB e benefícios desta versão continuam sendo demonstrações.' : 'Workouts, JAB points and benefits in this version remain demonstrations.'}</p>
    </>}
  </section>;
}
