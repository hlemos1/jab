import type { View } from './types';

export type GuideRole = 'athlete' | 'coach' | 'manager';

export type GuideLesson = {
  id: string;
  roles: GuideRole[];
  title: { pt: string; en: string };
  kicker: { pt: string; en: string };
  intro: { pt: string; en: string };
  steps: { pt: string[]; en: string[] };
  note: { pt: string; en: string };
  view: View;
  actionLabel: { pt: string; en: string };
  visual: 'loop' | 'account' | 'session' | 'receipt' | 'rewards' | 'units' | 'planner' | 'clock' | 'report' | 'privacy';
};

// A learning track selects content only; it never grants a unit role or permission.
// Filter with lesson.roles.includes(role): athlete = 8, coach = 11, manager = 12.
export const guideLessons: GuideLesson[] = [
  {
    id: 'overview', roles: ['athlete', 'coach', 'manager'], visual: 'loop', view: 'arena',
    kicker: { pt: 'O mapa da plataforma', en: 'Your platform map' },
    title: { pt: 'Entre na StrikeX.', en: 'Step into StrikeX.' },
    intro: {
      pt: 'A StrikeX combina CombatFit, rounds e acompanhamento de evolução. Aqui você experimenta essa jornada e ensaia a organização de uma aula, com os limites de cada área identificados.',
      en: 'StrikeX brings CombatFit, rounds and progress tracking together. Here you can experience that journey and rehearse class organization, with each area’s limits clearly identified.',
    },
    steps: {
      pt: ['A arena abre a experiência individual: uma batalha acelerada, resultado, histórico e recompensas de demonstração.', 'Minha conta reúne seu perfil e o acesso com ChatGPT. Atividade guarda suas batalhas; Recompensas usa apenas pontos fictícios.', 'Turma é o laboratório privado de planejamento. Por essa tela, você também chega ao Painel do coach, a Unidade e equipe e a Aulas da unidade.', 'Unidade e equipe conecta contas por convite. Aulas da unidade permite ensaiar uma aula compartilhada, com visão própria para cada atleta.', 'Como funciona mostra o caminho dos dados e permite testar as regras. Neste guia, escolher uma trilha só muda a explicação; não concede permissões.'],
      en: ['The arena opens the individual experience: an accelerated battle, a result, history and demonstration rewards.', 'My account contains your profile and ChatGPT sign-in. Activity stores your battles; Rewards uses fictional points only.', 'Class is the private planning lab. From that screen you can also reach Coach panel, Unit & team and Unit classes.', 'Unit & team connects accounts by invitation. Unit classes lets you rehearse a shared class, with a personal view for each athlete.', 'How it works explains the data flow and lets you test the rules. Choosing a track in this guide changes the explanation only; it does not grant permissions.'],
    },
    note: { pt: 'Você está em um protótipo: o treino individual usa dados sintéticos; as aulas de unidade são ensaios com contas reais.', en: 'This is a prototype: individual workouts use synthetic data; unit classes are rehearsals linked to real accounts.' },
    actionLabel: { pt: 'Conhecer a arena', en: 'Explore the arena' },
  },
  {
    id: 'access', roles: ['athlete', 'coach', 'manager'], visual: 'account', view: 'account',
    kicker: { pt: 'Acesso e perfil', en: 'Access and profile' },
    title: { pt: 'Comece com sua identidade.', en: 'Start with your identity.' },
    intro: { pt: 'Você pode conhecer a demo como visitante. Para recuperar seu histórico em outro dispositivo ou participar de uma unidade, entre com sua conta.', en: 'You can explore the demo as a guest. To recover your history on another device or join a unit, sign in with your account.' },
    steps: {
      pt: ['Abra Minha conta e confira o indicador Visitante ou Conta conectada.', 'Para usar uma conta, toque em Entrar com ChatGPT e conclua o acesso. A plataforma usa esse login; você não cria uma senha StrikeX nesta versão.', 'Escolha Criar meu perfil, informe seu nome na arena e selecione uma marca. Salvar o perfil não inicia uma batalha.', 'Se continuar como visitante, seu histórico depende da identificação deste navegador. Limpar cookies ou mudar de navegador pode fazer você perder esse acesso.', 'Ao entrar com a mesma conta em outro dispositivo, recupere os dados daquela conta. O progresso de visitante fica separado e não é importado.'],
      en: ['Open My account and check whether the indicator says Guest or Account connected.', 'To use an account, select Sign in with ChatGPT and complete sign-in. The platform uses that login; you do not create a StrikeX password in this version.', 'Choose Create my profile, enter your arena name and select a mark. Saving your profile does not start a battle.', 'If you stay as a guest, your history depends on this browser’s identifier. Clearing cookies or switching browsers may remove your access to it.', 'Sign in with the same account on another device to recover that account’s data. Guest progress stays separate and is not imported.'],
    },
    note: { pt: 'O nome do perfil é escolhido por você. Ele não verifica identidade física nem define seu papel em uma unidade.', en: 'You choose your profile name. It does not verify physical identity or determine your role in a unit.' },
    actionLabel: { pt: 'Abrir minha conta', en: 'Open my account' },
  },
  {
    id: 'session', roles: ['athlete', 'coach', 'manager'], visual: 'session', view: 'arena',
    kicker: { pt: 'Experiência individual', en: 'Individual experience' },
    title: { pt: 'Uma batalha em 72 segundos.', en: 'A battle in 72 seconds.' },
    intro: { pt: 'A batalha demonstra a jornada do atleta em 12 rounds de 6 segundos. As estações representam Volume, Técnica, Força, Velocidade, Imersão e Reflexo.', en: 'A battle demonstrates the athlete journey through twelve six-second rounds. The stations represent Volume, Technique, Power, Speed, Immersion and Reflex.' },
    steps: {
      pt: ['Na arena, use o botão para começar uma batalha. Se ainda não houver perfil, escolha seu nome e sua marca para continuar.', 'Acompanhe o round atual, a estação e os indicadores de eventos, precisão e intensidade. Todos esses indicadores vêm de uma simulação.', 'Use Pausar e Continuar para controlar essa experiência. Avançar para o resultado permite conhecer o fechamento sem esperar os 72 segundos.', 'Ao terminar, aguarde a validação. O servidor confere a sequência e os dados recebidos, calcula a pontuação de 0 a 100 e registra os JAB fictícios da sessão.'],
      en: ['In the arena, use the button to start a battle. If you do not have a profile yet, choose your name and mark to continue.', 'Follow the current round, station, event count, accuracy and intensity. All these indicators come from a simulation.', 'Use Pause and Continue to control this experience. Fast-forward to results lets you explore the result without waiting for all 72 seconds.', 'At the end, wait for validation. The server checks the sequence and submitted data, calculates a score from 0 to 100 and records the session’s fictional JAB.'],
    },
    note: { pt: 'Não é necessário treinar diante da câmera nem conectar luvas ou sensores. A sequência pode usar parte das estações; não há obrigação de passar por todas.', en: 'You do not need to exercise on camera or connect gloves or sensors. A sequence can use a subset of stations; visiting every station is not required.' },
    actionLabel: { pt: 'Ir para a batalha demo', en: 'Go to the demo battle' },
  },
  {
    id: 'receipt', roles: ['athlete', 'coach', 'manager'], visual: 'receipt', view: 'activity',
    kicker: { pt: 'Resultado e rastreabilidade', en: 'Results and traceability' },
    title: { pt: 'Entenda seu comprovante.', en: 'Understand your receipt.' },
    intro: { pt: 'Cada batalha validada aparece em Atividade. Você pode abrir o resultado novamente e consultar o registro dos dados usados naquela demonstração.', en: 'Each validated battle appears in Activity. You can reopen its result and inspect the record of the data used in that demonstration.' },
    steps: {
      pt: ['Abra Atividade e selecione uma batalha. Confira data, pontuação e JAB atribuídos àquela sessão.', 'No comprovante, consulte o ID da sessão e o hash: uma impressão digital do conteúdo registrado, útil para conferir se os dados correspondem ao registro.', 'Use Verificar integridade para conferir o conteúdo contra o hash. Baixar comprovante salva o JSON; em Como funciona → Laboratório, você pode conferi-lo novamente, sem enviar o arquivo ao servidor. Essa conferência não autentica o emissor nem o esforço físico.', 'Se quiser testar a blockchain, escolha Registrar na Solana Devnet. Aguarde o status: apenas Confirmado na Devnet indica confirmação; nesse caso, abra o Solana Explorer.', 'Se a Devnet estiver indisponível, seu resultado validado continua salvo. Você pode tentar o registro novamente mais tarde.'],
      en: ['Open Activity and select a battle. Check its date, score and the JAB assigned to that session.', 'In the receipt, inspect the session ID and hash: a fingerprint of the recorded content, useful for checking whether the data matches the record.', 'Use Verify integrity to check content against its hash. Download receipt saves the JSON; in How it works → Lab, you can check it again without uploading it. This check does not authenticate the issuer or physical effort.', 'To test the blockchain, choose Record on Solana Devnet. Wait for the status: only Confirmed on Devnet means confirmation; then you can open Solana Explorer.', 'If Devnet is unavailable, your validated result remains saved. You can try recording it again later.'],
    },
    note: { pt: 'A Devnet é uma rede de testes. Registrar dados simulados na blockchain não comprova que houve exercício físico e não transforma JAB demo em token.', en: 'Devnet is a test network. Recording simulated data on a blockchain does not prove a physical workout happened or turn demo JAB into a token.' },
    actionLabel: { pt: 'Ver minha atividade', en: 'View my activity' },
  },
  {
    id: 'rewards', roles: ['athlete', 'coach', 'manager'], visual: 'rewards', view: 'rewards',
    kicker: { pt: 'JAB de demonstração', en: 'Demonstration JAB' },
    title: { pt: 'Explore a troca de pontos.', en: 'Explore point redemption.' },
    intro: { pt: 'O saldo JAB permite testar como o progresso poderia desbloquear benefícios. Nesta versão, tanto os pontos quanto os benefícios são fictícios.', en: 'Your JAB balance lets you test how progress could unlock benefits. In this version, both the points and benefits are fictional.' },
    steps: {
      pt: ['Conclua uma batalha individual e confira os pontos registrados. O saldo aparece na arena e em Recompensas.', 'Em Recompensas, compare o custo de cada opção: passe de convidado por 10 JAB e crédito de equipamento por 25 JAB.', 'Com saldo suficiente, selecione Desbloquear recompensa. O custo é descontado do saldo demo e o benefício passa a aparecer como desbloqueado.', 'Se faltar saldo, complete outra batalha. Cada benefício pode ser desbloqueado uma vez no histórico demo atual.'],
      en: ['Complete an individual battle and check the recorded points. Your balance appears in the arena and in Rewards.', 'In Rewards, compare the available options: a guest pass for 10 JAB and a gear credit for 25 JAB.', 'With enough points, select Unlock reward. Its cost is deducted from your demo balance and the benefit is shown as unlocked.', 'If you need more points, complete another battle. Each benefit can be unlocked once in the current demo history.'],
    },
    note: { pt: 'Desbloquear não faz compra, reserva nem entrega de produto. JAB desta versão não tem valor monetário e não pode ser sacado.', en: 'Unlocking does not make a purchase or reservation or deliver a product. JAB in this version has no monetary value and cannot be withdrawn.' },
    actionLabel: { pt: 'Explorar recompensas', en: 'Explore rewards' },
  },
  {
    id: 'membership', roles: ['athlete', 'coach', 'manager'], visual: 'units', view: 'units',
    kicker: { pt: 'Contas conectadas', en: 'Connected accounts' },
    title: { pt: 'Entre para uma equipe.', en: 'Join a team.' },
    intro: { pt: 'Unidade e equipe reúne os vínculos de pessoas reais dentro de uma unidade de teste. Cada pessoa entra pela própria conta; o convite define seu papel.', en: 'Unit & team brings real account memberships together in a test unit. Each person signs in with their own account; the invitation defines their role.' },
    steps: {
      pt: ['Entre com ChatGPT e abra Unidade e equipe pelo botão em Minha conta ou em Turma.', 'Se recebeu um convite, cole o código em Código do convite, informe seu nome nessa unidade e selecione Aceitar convite.', 'Confira o papel indicado: Atleta acompanha suas aulas; Coach vê a equipe e conduz aulas compartilhadas; Gestor também administra membros e convites.', 'Um código funciona uma única vez e expira em sete dias. Se já foi usado, revogado ou expirou, peça outro ao gestor.', 'Para testar pessoas diferentes, use contas ChatGPT diferentes. Duas janelas com a mesma conta continuam sendo a mesma pessoa.'],
      en: ['Sign in with ChatGPT and open Unit & team from My account or Class.', 'If you received an invitation, paste it into Invitation code, enter your name for that unit and select Accept invitation.', 'Check your displayed role: Athlete follows their own classes; Coach sees the team and operates shared classes; Manager also manages members and invitations.', 'A code works once and expires after seven days. If it has been used, revoked or expired, ask the manager for another.', 'To test different people, use different ChatGPT accounts. Two windows signed into the same account are still the same person.'],
    },
    note: { pt: 'A unidade é um ambiente de teste. Criá-la não certifica uma unidade oficial StrikeX. Seu nome nela fica visível para gestor e coaches.', en: 'A unit is a test environment. Creating one does not certify an official StrikeX location. Its manager and coaches can see your name in that unit.' },
    actionLabel: { pt: 'Abrir unidade e equipe', en: 'Open unit & team' },
  },
  {
    id: 'team', roles: ['manager'], visual: 'units', view: 'units',
    kicker: { pt: 'Trilha do gestor', en: 'Manager track' },
    title: { pt: 'Monte sua equipe de teste.', en: 'Build your test team.' },
    intro: { pt: 'O criador da unidade assume o papel de gestor. Ele controla quem entra, com qual papel e quem permanece com acesso.', en: 'The unit creator becomes its manager. They control who joins, their role and who retains access.' },
    steps: {
      pt: ['Em Unidade e equipe, preencha Nome da unidade e Seu nome nesta unidade. Selecione Criar unidade de teste. Cada conta pode criar uma unidade.', 'Escolha Atleta ou Coach em Papel do convite e clique em Gerar convite. Convide atletas para compor a aula e coaches para conduzi-la.', 'Copie o código assim que ele aparecer e envie à pessoa escolhida pelo canal de sua preferência. A plataforma não envia o convite; o código não reaparece após recarregar.', 'Depois que a pessoa aceitar, atualize a equipe. Você pode alterar seu papel ou remover o acesso. Coaches não administram os demais membros.', 'Revogue convites que não serão usados. Se perder um código antes de entregá-lo, revogue aquele convite e gere outro.'],
      en: ['In Unit & team, enter Unit name and Your name in this unit. Select Create test unit. Each account can create one unit.', 'Choose Athlete or Coach under Invitation role and click Generate invitation. Invite athletes to participate in classes and coaches to operate them.', 'Copy the code as soon as it appears and send it to the intended person using your preferred channel. The platform does not send invitations; the code cannot be recovered after reloading.', 'After they accept, refresh the team. You can change their role or remove access. Coaches cannot manage other members.', 'Revoke invitations you will not use. If you lose a code before delivering it, revoke that invitation and generate another.'],
    },
    note: { pt: 'Qualquer pessoa com um código válido pode aceitar o papel oferecido. Há limite de 50 pessoas por unidade, incluindo o gestor, e 10 convites pendentes.', en: 'Anyone holding a valid code can accept its assigned role. Each unit supports up to 50 people including the manager, and 10 pending invitations.' },
    actionLabel: { pt: 'Gerenciar minha equipe', en: 'Manage my team' },
  },
  {
    id: 'shared', roles: ['athlete', 'coach', 'manager'], visual: 'clock', view: 'unit-classes',
    kicker: { pt: 'Aulas da unidade', en: 'Unit classes' },
    title: { pt: 'Uma aula. Cada um na sua conta.', en: 'One class. Everyone on their own account.' },
    intro: { pt: 'Esta área compartilha a mesma aula entre gestor, coaches e atletas vinculados à unidade. Os controles e os dados visíveis dependem do papel de cada pessoa.', en: 'This area shares one class among the unit’s manager, coaches and athlete members. Controls and visible data depend on each person’s role.' },
    steps: {
      pt: ['Abra Aulas da unidade pelo botão em Turma e escolha a unidade. É preciso ter uma conta conectada e um vínculo ativo.', 'Como gestor ou coach, selecione de 1 a 11 membros com papel Atleta, dê um nome à aula e configure rounds e descansos. Marque restrições de estação antes de Preparar aula.', 'Como atleta, aguarde o coach incluir você. Abra a aula para consultar seus 12 rounds e a estação atual; você não vê a escala dos outros atletas nem controla o relógio.', 'Gestor e coaches usam Iniciar aula, Pausar, Retomar ou Interromper. O ensaio padrão dura 94 segundos: 12 rounds de 6 segundos e 11 descansos de 2 segundos.', 'Recarregar recupera o estado do servidor e não pausa a aula. Se aparecer Aguardando sincronização, use Atualizar e espere a conexão voltar antes de comandar.'],
      en: ['Open Unit classes using the button in Class and choose your unit. You need a signed-in account and an active membership.', 'As manager or coach, select 1–11 members with the Athlete role, name the class and configure work and rest durations. Set any station restrictions before choosing Prepare class.', 'As an athlete, wait for your coach to include you. Open the class to view your 12 rounds and current station; you cannot see other athletes’ sequences or control the clock.', 'Managers and coaches use Start class, Pause, Resume or Interrupt. The default rehearsal lasts 94 seconds: twelve six-second rounds and eleven two-second rests.', 'Reloading recovers server state and does not pause the class. If Waiting for sync appears, use Refresh and wait for the connection before issuing commands.'],
    },
    note: { pt: 'Uma aula aberta por unidade. Depois de preparar, elenco e tempos ficam fixos; encerre e crie outra para mudar. O histórico registra planejamento e tempo, sem confirmar presença, gerar JAB ou fazer fechamento de participação.', en: 'One open class per unit. Once prepared, the roster and timing are fixed; end it and create another to make changes. History records the plan and elapsed time, without confirming attendance, awarding JAB or closing out participation.' },
    actionLabel: { pt: 'Abrir aulas da unidade', en: 'Open unit classes' },
  },
  {
    id: 'planner', roles: ['coach', 'manager'], visual: 'planner', view: 'classes',
    kicker: { pt: 'Laboratório privado · planejamento', en: 'Private lab · planning' },
    title: { pt: 'Teste a distribuição da turma.', en: 'Test your class distribution.' },
    intro: { pt: 'A tela Turma permite experimentar uma distribuição sem convidar pessoas. Os nomes digitados são um elenco de demonstração privado; não representam vínculos com contas.', en: 'The Class screen lets you experiment with a distribution without inviting anyone. Typed names form a private demonstration roster; they are not linked to accounts.' },
    steps: {
      pt: ['Em Turma, defina um nome para o plano e mantenha de 1 a 11 atletas. Edite os nomes ou use Adicionar atleta.', 'Em Bloqueios de estações, marque o que deve ficar fora da sequência de cada pessoa. Deixe pelo menos duas estações disponíveis para permitir alternância.', 'Selecione Gerar distribuição. A capacidade simultânea é Volume 3, Técnica 3, Força 2, Velocidade 1, Imersão 1 e Reflexo 1.', 'Confira os 12 rounds, abra Grade completa ou use Acompanhe um atleta. Ninguém repete a mesma estação em rounds consecutivos e não é obrigatório visitar todas.', 'O plano aparece em Turmas salvas. Você pode reabrir, exportar ou excluir; para testar a condução, siga para Painel do coach.'],
      en: ['In Class, name the plan and keep between 1 and 11 athletes. Edit names or use Add athlete.', 'Under Station restrictions, select stations to exclude from each person’s sequence. Leave at least two stations available so they can alternate.', 'Select Generate distribution. Simultaneous capacity is Volume 3, Technique 3, Power 2, Speed 1, Immersion 1 and Reflex 1.', 'Check the 12 rounds, open the full schedule or follow one athlete. No one repeats the same station in consecutive rounds, and visiting every station is not required.', 'Your plan appears in Saved classes. Reopen, export or delete it; to rehearse class operation, continue to Coach panel.'],
    },
    note: { pt: 'Este motor demonstra um subconjunto das regras de distribuição, sem integrar o Solver proprietário. Se os bloqueios tornarem a turma inviável, ajuste a configuração: nenhuma grade parcial é salva.', en: 'This engine demonstrates a subset of distribution rules without integrating the proprietary Solver. If restrictions make the class impossible to place, adjust the configuration: no partial schedule is saved.' },
    actionLabel: { pt: 'Abrir planejador privado', en: 'Open private planner' },
  },
  {
    id: 'clock', roles: ['coach', 'manager'], visual: 'clock', view: 'coach',
    kicker: { pt: 'Laboratório privado · condução', en: 'Private lab · class operation' },
    title: { pt: 'Comande os rounds.', en: 'Run the rounds.' },
    intro: { pt: 'O Painel do coach ensaia a condução dos seus planos privados. O nome da tela não concede papel de coach em uma unidade e essa aula não é compartilhada com outras contas.', en: 'Coach panel rehearses the operation of your private plans. The screen’s name does not grant a coach role in a unit, and this class is not shared with other accounts.' },
    steps: {
      pt: ['Depois de salvar um plano em Turma, abra Painel do coach e selecione a turma salva.', 'Escolha a duração do round e do descanso. O padrão de 6 e 2 segundos soma 94 segundos; não há descanso depois do último round.', 'Use Preparar aula e depois Iniciar aula. Durante o round, veja as posições atuais; durante o descanso, o painel mostra as posições do próximo round.', 'Para parar o tempo, use Pausar. Fechar a aba ou recarregar não pausa: o estado é guardado no servidor. Use Retomar para continuar.', 'Deixe os 12 rounds terminarem ou use Interromper. Uma aula encerrada não pode ser retomada; prepare outra execução quando quiser repetir.'],
      en: ['After saving a plan in Class, open Coach panel and select the saved class.', 'Choose work and rest durations. The default of 6 and 2 seconds totals 94 seconds; there is no rest after the last round.', 'Use Prepare class and then Start class. During work, see current positions; during rest, the panel shows positions for the next round.', 'To stop time, use Pause. Closing the tab or reloading does not pause it: state is stored on the server. Use Resume to continue.', 'Let all 12 rounds finish or use Interrupt. An ended class cannot resume; prepare another run whenever you want to repeat it.'],
    },
    note: { pt: 'Cada contexto tem uma aula privada aberta por vez e até 20 execuções salvas. Esse relógio não mede esforço nem credita pontos. Para trabalhar com outra conta, use Aulas da unidade.', en: 'Each context allows one open private class at a time and up to 20 saved runs. This clock does not measure effort or award points. To work with another account, use Unit classes.' },
    actionLabel: { pt: 'Abrir painel do coach', en: 'Open coach panel' },
  },
  {
    id: 'report', roles: ['coach', 'manager'], visual: 'report', view: 'coach',
    kicker: { pt: 'Laboratório privado · fechamento', en: 'Private lab · closeout' },
    title: { pt: 'Revise antes de fechar.', en: 'Review before closing out.' },
    intro: { pt: 'Depois que uma aula privada termina ou é interrompida, você pode declarar manualmente a participação do elenco de teste e gerar um comprovante permanente daquela revisão.', en: 'After a private class finishes or is interrupted, you can manually declare participation for the test roster and generate a permanent record of that review.' },
    steps: {
      pt: ['No Painel do coach, abra a execução encerrada e localize Quem participou?. Todos começam sem revisão; o relógio não confirma ninguém sozinho.', 'Marque cada pessoa como Completo, Parcial ou Ausente. Completo exige os 12 rounds encerrados; Parcial respeita o limite de rounds inteiros transcorridos.', 'Confira toda a lista e faça a confirmação final antes de Fechar e gerar comprovante. Depois de fechado, o registro não pode ser editado.', 'No Histórico de fechamentos, reabra o comprovante, use Verificar integridade e exporte o JSON se quiser guardar uma cópia.', 'Excluir a execução ou o plano de origem não apaga esse comprovante. Não há exclusão ou retificação de fechamentos nesta versão.'],
      en: ['In Coach panel, open the ended run and locate the participation review. Everyone starts unreviewed; the clock never confirms anyone automatically.', 'Mark each person Complete, Partial or Absent. Complete requires all 12 rounds to have elapsed; Partial is limited by the number of whole rounds elapsed.', 'Review the entire list and make the final confirmation before closing out and generating the receipt. Once closed, the record cannot be edited.', 'In closeout history, reopen the receipt, verify its integrity and export the JSON if you want to keep a copy.', 'Deleting the original run or plan does not delete this receipt. Deletion and correction of closeouts are not available in this version.'],
    },
    note: { pt: 'Esse fechamento existe apenas no laboratório privado. É uma declaração manual sobre nomes de teste: não atesta esforço por sensor, não vincula atletas reais, não gera saldo e não fecha aulas compartilhadas.', en: 'This closeout exists only in the private lab. It is a manual declaration about test names: it does not attest sensor-measured effort, link real athletes, create a balance or close out shared classes.' },
    actionLabel: { pt: 'Revisar aula privada', en: 'Review a private class' },
  },
  {
    id: 'boundaries', roles: ['athlete', 'coach', 'manager'], visual: 'privacy', view: 'system',
    kicker: { pt: 'Antes de seguir', en: 'Before you continue' },
    title: { pt: 'Saiba o que cada registro prova.', en: 'Know what each record proves.' },
    intro: { pt: 'A plataforma já guarda dados e controla acessos, mas cada fluxo tem uma finalidade diferente. Essa separação evita confundir um ensaio com um treino validado no mundo físico.', en: 'The platform already stores data and controls access, but each flow serves a different purpose. Keeping them separate avoids mistaking a rehearsal for a verified physical workout.' },
    steps: {
      pt: ['Batalha individual: simula desempenho, calcula pontos fictícios e gera um comprovante de dados. Aulas: guardam distribuição e relógio; não alimentam esse saldo.', 'Privacidade: conta e visitante têm históricos separados. Planos e fechamentos privados pertencem ao contexto que os criou. Na unidade, o atleta vê sua própria participação planejada; gestor e coaches veem a equipe.', 'Em Como funciona, explore Pitch, Arquitetura e Laboratório. Entrada válida e Evento inválido são testes locais sem persistência; Reenviar sessão salva chama o servidor e verifica a resposta de duplicidade. Você precisa de uma batalha anterior.', 'Use Reiniciar demo apenas quando quiser apagar perfil, sessões, pontos e resgates demo do contexto atual. Isso mantém o login e não apaga turmas, execuções, fechamentos ou unidades.', 'Não encontrou seu histórico? Confira se está na mesma conta ou no visitante original. Não apareceu uma aula? Confirme o vínculo ativo e peça ao coach para incluir você; depois use Atualizar.'],
      en: ['Individual battle: simulates performance, calculates fictional points and produces a data receipt. Classes: save distribution and clock state; they do not feed that balance.', 'Privacy: account and guest histories stay separate. Private plans and closeouts belong to the context that created them. In a unit, athletes see their own planned participation; managers and coaches see the team.', 'In How it works, explore Pitch, Architecture and Lab. Valid input and Invalid event are local tests without persistence; Replay saved session calls the server and inspects its duplicate response. You need a previous battle.', 'Use Reset demo only when you want to delete the current context’s demo profile, sessions, points and redemptions. It preserves sign-in and does not delete class plans, runs, closeouts or units.', 'Cannot find your history? Check that you are using the same account or original guest context. No class appears? Confirm your active membership and ask your coach to include you, then use Refresh.'],
    },
    note: { pt: 'Não há reserva de vaga, agenda futura, presença física certificada, sensores conectados ou recompensa financeira. Os estados exibidos na plataforma mostram o que foi registrado em cada fluxo.', en: 'There is no seat booking, future schedule, certified physical attendance, connected sensor feed or financial reward. The states shown in the platform reflect what each flow has recorded.' },
    actionLabel: { pt: 'Explorar como funciona', en: 'Explore how it works' },
  },
];
