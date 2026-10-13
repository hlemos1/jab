import { ArrowUpRight, Clock3, Play, Users } from 'lucide-react';
import type { Lang } from './types';

type Props = { lang: Lang; ready: boolean; returning: boolean; onTrain: () => void; onClasses: () => void };

export function BrandHero({ lang, ready, returning, onTrain, onClasses }: Props) {
  const pt = lang === 'pt';
  return <section className="strike-hero" aria-labelledby="arena-title">
    <div className="strike-hero-image">
      <img src="/brand/arena.webp" alt={pt ? 'Conceito da arena StrikeX: sacos pretos e linhas de luz vermelha' : 'StrikeX arena concept: black punching bags and red light lines'} width="900" height="1600" fetchPriority="high" />
    </div>
    <div className="strike-hero-content">
      <span className="strike-kicker"><span />STRIKEX / COMBATFIT</span>
      <h1 id="arena-title">{pt ? 'A SALA' : 'THE ARENA'}<br /><em>{pt ? 'EM PLAY.' : 'IN PLAY.'}</em></h1>
      <p>{pt ? 'Entre no round. Encontre seu ritmo. Veja seu progresso. O universo StrikeX começa aqui.' : 'Enter the round. Find your rhythm. See your progress. Your StrikeX experience starts here.'}</p>
      <div className="strike-hero-actions">
        <button className="btn btn-primary" disabled={!ready} onClick={onTrain}><Play size={16} fill="currentColor" />{pt ? (returning ? 'Meu próximo round' : 'Entrar na arena') : (returning ? 'My next round' : 'Enter the arena')}<ArrowUpRight size={18} /></button>
        <button className="strike-secondary" onClick={onClasses}><Users size={16} />{pt ? 'Aulas da unidade' : 'Unit classes'}<ArrowUpRight size={15} /></button>
      </div>
      <div className="strike-demo-note"><Clock3 size={14} /><span>{pt ? 'Demo de 72s · treino e pontos simulados' : '72s demo · simulated training and points'}</span></div>
    </div>
    <div className="strike-hero-caption"><span>STRIKEX STUDIO</span><span>{pt ? 'VISÃO DA ARENA' : 'ARENA CONCEPT'} / 001</span></div>
    <div className="strike-hero-bottom"><span>{pt ? 'SEU PRÓXIMO ROUND COMEÇA AQUI' : 'YOUR NEXT ROUND STARTS HERE'}</span><span>12 ROUNDS <i /> 06 {pt ? 'ESTAÇÕES' : 'STATIONS'}</span></div>
  </section>;
}

export function BrandCircuit({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const cards = [
    { src: 'arena', tag: '01 / COMBATFIT', title: pt ? 'Encontre seu ritmo.' : 'Find your rhythm.', description: pt ? 'Combate, movimento e energia de arena.' : 'Combat, movement and arena energy.', position: '50% 48%' },
    { src: 'reflex', tag: '02 / REFLEX', title: pt ? 'Cada reação conta.' : 'Every reaction counts.', description: pt ? 'Foco e precisão a cada novo desafio.' : 'Focus and precision with every challenge.', position: '50% 43%' },
    { src: 'immersion', tag: '03 / IMMERSION', title: pt ? 'Entre no jogo.' : 'Step into the game.', description: pt ? 'Uma nova dimensão do CombatFit.' : 'A new dimension of CombatFit.', position: '50% 35%' },
  ];
  return <div className="strike-circuit-visuals" aria-label={pt ? 'Conceitos visuais StrikeX' : 'StrikeX visual concepts'}>{cards.map(card => <article className="strike-circuit-card" key={card.src}>
    <img src={`/brand/${card.src}.webp`} alt="" width="900" height="1600" loading="lazy" style={{ objectPosition: card.position }} />
    <div><span>{card.tag}</span><h3>{card.title}</h3><p>{card.description}</p></div>
  </article>)}</div>;
}
