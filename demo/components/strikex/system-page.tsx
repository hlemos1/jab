'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Code2, FileCheck2, FlaskConical, Layers3, ShieldCheck } from 'lucide-react';
import { generateSession, validateSession, type SessionInput } from '@/lib/effort';
import { ReceiptFileVerifier } from './receipt-integrity';
import type { Lang, Session, View } from './types';

const repo = 'https://github.com/hlemos1/jab/tree/strikex-proof-of-effort-demo';
const source = `${repo}/demo`;
type Panel = 'pitch' | 'architecture' | 'lab';
type LabResult = { authority: 'local' | 'server'; message: string; body: unknown };

export function SystemPage({ lang, sessions, balance, ready, onNavigate, onReplay }: {
  lang: Lang; sessions: Session[]; balance: number; ready: boolean;
  onNavigate: (view: View) => void;
  onReplay: (input: SessionInput) => Promise<{ duplicate: boolean; balance: number }>;
}) {
  const pt = lang === 'pt';
  const [panel, setPanel] = useState<Panel>('pitch');
  const [lab, setLab] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = sessions.find(session => session.input);
  const choose = (a: string, b: string) => pt ? a : b;
  async function run(mode: 'valid' | 'invalid' | 'replay') {
    setError(''); setLab(null); setBusy(true);
    try {
      if (mode === 'replay') {
        if (!saved?.input) throw Error(choose('Conclua uma batalha na Arena primeiro.', 'Complete a battle in the Arena first.'));
        const before = balance;
        const result = await onReplay(saved.input);
        setLab({ authority: 'server', message: result.duplicate
          ? choose('Reenvio reconhecido. Esta requisição não gerou outro crédito.', 'Replay recognized. This request did not create another credit.')
          : choose('O servidor aceitou uma nova sessão. O registro anterior pode ter sido apagado; este resultado não demonstra um bloqueio de duplicata.', 'The server accepted a new session. The earlier record may have been deleted; this result does not demonstrate a duplicate block.'),
          body: { sessionId: saved.id, duplicate: result.duplicate, balanceBeforeInBrowser: before, balanceReturnedByServer: result.balance } });
      } else {
        const input = generateSession(crypto.randomUUID(), 42);
        if (mode === 'invalid') input.events[0].timestampMs = -100;
        const result = validateSession(input);
        setLab({ authority: 'local', message: result.valid
          ? choose('As regras aceitaram os dados sintéticos neste navegador.', 'The rules accepted the synthetic input in this browser.')
          : choose('As regras rejeitaram um evento fora da janela temporal.', 'The rules rejected an event outside its time window.'), body: result });
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : choose('Não foi possível executar o teste.', 'Unable to run the test.')); }
    finally { setBusy(false); }
  }
  const steps = [
    { title: choose('Simular', 'Simulate'), tag: 'BROWSER', text: choose('12 rounds e eventos sintéticos. O navegador envia a entrada, nunca um saldo autorizado.', '12 rounds and synthetic events. The browser submits input, never an authoritative balance.'), file: 'lib/effort.ts' },
    { title: choose('Validar', 'Validate'), tag: 'SERVER', text: choose('O servidor verifica a estrutura, as janelas e as regras públicas antes de calcular o resultado.', 'The server checks structure, time windows and public rules before calculating the result.'), file: 'app/api/demo/route.ts' },
    { title: choose('Registrar', 'Record'), tag: 'D1 / SHA-256', text: choose('Resultado e entrada ficam vinculados a um hash. A mesma sessão credita JAB de demonstração uma vez.', 'Input and result are bound to a hash. The same session credits demonstration JAB once.'), file: 'lib/session-receipt.ts' },
    { title: choose('Ancorar', 'Anchor'), tag: 'SOLANA DEVNET · OPTIONAL', text: choose('Uma transação Memo pode registrar ID e hash. A interface só confirma após verificar a transação e o Memo.', 'A Memo transaction can record the ID and hash. The interface confirms only after checking the transaction and Memo.'), file: 'lib/solana.ts' },
  ];
  return <section className="inner-page system-page system-review">
    <div className="eyebrow">STRIKEX / PROOF OF EFFORT</div>
    <div className="system-heading"><div><h1 className="page-title">{choose('Do treino à evidência.', 'From training to evidence.')}</h1><p className="page-subtitle">{choose('Conheça a proposta, acompanhe o fluxo e confira o que este protótipo realmente demonstra.', 'Explore the proposition, follow the flow and inspect what this prototype actually demonstrates.')}</p></div><a className="system-repo-link" href={repo} target="_blank" rel="noreferrer"><Code2 size={18}/>{choose('Repositório público', 'Public repository')}<ArrowUpRight size={16}/></a></div>
    <nav className="system-switcher" aria-label={choose('Explorar a plataforma', 'Explore the platform')}>
      {([{ id: 'pitch', title: 'Pitch', icon: FileCheck2 }, { id: 'architecture', title: choose('Arquitetura', 'Architecture'), icon: Layers3 }, { id: 'lab', title: choose('Laboratório', 'Lab'), icon: FlaskConical }] as const).map(item=><button key={item.id} aria-pressed={panel===item.id} onClick={()=>setPanel(item.id)}><item.icon size={17}/>{item.title}</button>)}
    </nav>
    {panel==='pitch'&&<div className="system-panel">
      <article className="system-thesis"><span className="tiny-label">01 / {choose('A PROPOSTA', 'THE PROPOSITION')}</span><h2>{choose('O esforço precisa deixar um registro.', 'Effort should leave a record.')}</h2><p>{choose('A StrikeX conecta a experiência de treino, a organização da turma e um registro verificável da sessão. Neste protótipo, você percorre essa jornada com telemetria sintética e pontos JAB de demonstração.', 'StrikeX connects the training experience, class operations and a verifiable session record. This prototype lets you explore that journey with synthetic telemetry and demonstration JAB points.')}</p><div className="system-actions"><button className="btn btn-primary" onClick={()=>onNavigate('arena')}>{choose('Experimentar a Arena', 'Try the Arena')}<ArrowRight size={17}/></button><a className="text-link" href={`${source}/docs/PITCH.md`} target="_blank" rel="noreferrer">{choose('Pitch de 90 segundos', '90-second pitch')}<ArrowUpRight size={15}/></a></div></article>
      <div className="system-proof-grid">
        <article><span className="tiny-label">02 / {choose('EXPERIÊNCIA', 'EXPERIENCE')}</span><h3>{choose('Treinar. Evoluir. Retornar.', 'Train. Progress. Return.')}</h3><p>{choose('Perfil, batalha de 72 segundos, resultado, histórico e resgates demonstram o ciclo do atleta. Uma trilha separada organiza unidades, membros e turmas.', 'Profile, a 72-second battle, results, history and redemptions demonstrate the athlete loop. A separate track organizes units, members and classes.')}</p></article>
        <article><span className="tiny-label">03 / {choose('EVIDÊNCIA', 'EVIDENCE')}</span><h3>{choose('Cada promessa tem um limite.', 'Every claim has a boundary.')}</h3><p>{choose('Regras executam no servidor; saldos persistem no banco; reenvios são controlados. O hash permite conferir conteúdo. Ele não comprova que uma pessoa fez esforço físico.', 'Rules execute on the server; balances persist in the database; replays are controlled. The hash lets you check content. It does not prove a person performed physical effort.')}</p></article>
      </div>
      <div className="system-status-grid"><article><span className="system-state">{choose('DISPONÍVEL NESTA DEMO', 'AVAILABLE IN THIS DEMO')}</span><h3>{choose('Fluxo completo com dados sintéticos', 'End-to-end flow with synthetic input')}</h3><p>{choose('Conta ou visitante, validação pública, persistência, permissões por unidade e exportação de comprovantes. A ancoragem opcional depende da disponibilidade da Devnet.', 'Account or guest access, public validation, persistence, unit permissions and receipt export. Optional anchoring depends on Devnet availability.')}</p></article><article><span className="system-state planned">{choose('PRÓXIMA EVOLUÇÃO · PLANEJADA', 'NEXT EVOLUTION · PLANNED')}</span><h3>{choose('Validar esforço do mundo físico', 'Validate real-world effort')}</h3><p>{choose('Integrar dispositivos confiáveis, testar a qualidade da evidência e definir critérios do piloto. Hardware conectado, token SPL e operação em mainnet não estão implementados aqui.', 'Integrate trusted devices, test evidence quality and define pilot criteria. Connected hardware, an SPL token and mainnet operation are not implemented here.')}</p><a className="text-link" href={`${source}/docs/ROADMAP.md`} target="_blank" rel="noreferrer">Roadmap<ArrowUpRight size={14}/></a></article></div>
    </div>}
    {panel==='architecture'&&<div className="system-panel">
      <div className="system-section-title"><Layers3 size={22}/><h2>{choose('Uma sessão. Quatro responsabilidades.', 'One session. Four responsibilities.')}</h2></div><p className="system-intro">{choose('Fluxo individual implementado. Abra cada arquivo para inspecionar a responsabilidade correspondente.', 'Implemented individual flow. Open each file to inspect the corresponding responsibility.')}</p>
      <ol className="system-flow">{steps.map((step,index)=><li key={step.tag}><span className="system-flow-number">0{index+1}</span><small>{step.tag}</small><h3>{step.title}</h3><p>{step.text}</p><a href={`${source}/${step.file}`} target="_blank" rel="noreferrer">{step.file}<ArrowUpRight size={13}/></a></li>)}</ol>
      <article className="system-unit-flow"><span className="tiny-label">{choose('FLUXO INDEPENDENTE / OPERAÇÃO DA UNIDADE', 'INDEPENDENT FLOW / UNIT OPERATIONS')}</span><h2>{choose('Organizar a turma não gera pontos.', 'Organizing a class does not generate points.')}</h2><p>{choose('Gestor e coach organizam membros e planejam a turma; o atleta consulta sua própria sequência. O planejador respeita as capacidades públicas das estações e evita repetição consecutiva. Não exige que todos passem por todas as estações. O Solver proprietário permanece fora deste repositório.', 'Managers and coaches organize members and plan a class; athletes view their own sequence. The planner respects public station capacities and avoids consecutive repetition. It does not require everyone to visit every station. The proprietary Solver remains outside this repository.')}</p><p>{choose('O cronômetro e o relatório declarado da área privada são outra trilha: não comprovam presença ou esforço e não geram JAB. As turmas compartilhadas já têm relógio; o fechamento de participação ainda é planejado.', 'The private workspace clock and declared report form another track: they do not prove attendance or effort and do not generate JAB. Shared classes already have a clock; participation closeout remains planned.')}</p><button className="text-link" onClick={()=>onNavigate('unit-classes')}>{choose('Explorar turmas da unidade', 'Explore unit classes')}<ArrowRight size={15}/></button></article>
      <div className="system-proof-grid"><article><ShieldCheck size={23}/><h3>{choose('O que vai para a blockchain?', 'What goes on the blockchain?')}</h3><p>{choose('Somente o identificador da sessão, o hash e a marcação de dados sintéticos no Memo. Nome, telemetria detalhada e saldo ficam fora da blockchain. Devnet é uma rede de testes.', 'Only the session identifier, hash and synthetic-data marker in a Memo. Names, detailed telemetry and balances stay off-chain. Devnet is a test network.')}</p></article><article><Code2 size={23}/><h3>{choose('Onde está a autoridade?', 'Where is authority enforced?')}</h3><p>{choose('O servidor resolve a identidade e verifica permissões. O banco aplica unicidade e mutações atômicas. O navegador apresenta resultados. Fora desta hospedagem, é necessário substituir a integração de autenticação confiável.', 'The server resolves identity and checks permissions. The database enforces uniqueness and atomic mutations. The browser presents results. Independent hosting requires replacing the trusted authentication integration.')}</p></article></div>
      <div className="system-doc-links">{[['ARCHITECTURE.md',choose('Mapa de arquitetura','Architecture map')],['PUBLIC-BOUNDARIES.md',choose('Limites da versão pública','Public boundaries')],['IMPLEMENTATION.md',choose('Contratos e implementação','Contracts and implementation')]].map(([file,label])=><a key={file} href={`${source}/docs/${file}`} target="_blank" rel="noreferrer">{label}<ArrowUpRight size={15}/></a>)}</div>
    </div>}
    {panel==='lab'&&<div className="system-panel">
      <section className="system-lab"><div className="system-section-title"><FlaskConical size={22}/><h2>{choose('Veja a regra responder.', 'Watch the rule respond.')}</h2></div><p>{choose('Os dois primeiros testes rodam só no navegador: não salvam sessões nem alteram pontos. O teste de reenvio chama o servidor com uma sessão já salva.', 'The first two tests run only in the browser: they do not save sessions or change points. The replay test calls the server with a previously saved session.')}</p>
        <div className="system-lab-controls"><button disabled={busy} onClick={()=>void run('valid')}><small>LOCAL</small>{choose('Entrada válida', 'Valid input')}</button><button disabled={busy} onClick={()=>void run('invalid')}><small>LOCAL</small>{choose('Evento inválido', 'Invalid event')}</button><button disabled={busy||!ready||!saved} onClick={()=>void run('replay')}><small>{choose('SERVIDOR', 'SERVER')}</small>{choose('Reenviar sessão salva', 'Replay saved session')}</button></div>
        {!saved&&<p className="system-lab-hint">{choose('Para testar o reenvio, conclua uma batalha na Arena.', 'To test replay, complete a battle in the Arena.')}</p>}
        {busy&&<p role="status">{choose('Executando teste…', 'Running test…')}</p>}{error&&<p role="alert">{error}</p>}
        {lab&&<div className="system-lab-result"><div role="status"><span className="system-state">{lab.authority==='local'?'LOCAL':choose('RESPOSTA DO SERVIDOR', 'SERVER RESPONSE')}</span><p>{lab.message}</p><small>{lab.authority==='local'?choose('Sem persistência. Sem alteração de saldo.', 'No persistence. No balance change.'):choose('Saldo anterior: última leitura do navegador. Saldo retornado: resposta desta requisição.', 'Previous balance: last browser snapshot. Returned balance: this request’s response.')}</small></div><details><summary>{choose('Inspecionar resposta JSON', 'Inspect JSON response')}</summary><pre>{JSON.stringify(lab.body,null,2)}</pre></details></div>}
      </section><ReceiptFileVerifier lang={lang}/>
    </div>}
  </section>;
}
