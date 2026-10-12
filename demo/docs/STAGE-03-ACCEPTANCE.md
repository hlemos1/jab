# Entrega 03 — condução da aula

12/10/2026. Continuação autorizada pelo usuário após a entrega de turmas e distribuição.

## Experiência entregue

Turma → Painel do coach. Prepare uma aula a partir de um plano salvo, escolha a duração dos rounds e dos descansos, inicie, pause, retome ou interrompa. O ensaio padrão usa 12 rounds de 6 segundos e 11 descansos de 2 segundos: 94 segundos. Não existe descanso depois do último round. Durante o descanso, o painel exibe as posições do próximo round.

O servidor guarda a turma, a matriz e os tempos como snapshot. Excluir o plano original não quebra uma aula já preparada. Recarregar ou sair da página não pausa a aula: o relógio é reconstruído a partir do estado persistido. Pausar exige o botão Pausar. Uma aula concluída ou interrompida não pode ser retomada.

## Roteiro de validação visual

1. Abra https://strikex-proof-of-effort.lemos10.chatgpt.site/?view=coach e selecione PT.
2. Se necessário, use Montar turma, gere uma distribuição e volte ao Painel do coach.
3. Mantenha 6 segundos por round e 2 de descanso. Prepare a aula e confira os nomes e as vagas.
4. Inicie. Confira round, contagem regressiva, descanso e posições do próximo round.
5. Pause; aguarde alguns segundos; recarregue. O tempo deve permanecer parado.
6. Retome e recarregue durante a execução. A aula deve continuar, sem reiniciar.
7. Abra o painel em outra janela do mesmo navegador. O estado deve sincronizar; um comando desatualizado não pode sobrescrever um mais recente.
8. Deixe terminar. O histórico deve mostrar Concluída. Prepare outra aula com o mesmo plano; deve ser uma nova execução.
9. Interrompa essa nova aula e confira que ela não oferece Retomar. Exclua um registro encerrado se desejar.
10. Confira a navegação, os nomes e os controles no celular. Sem conexão, a interface deve sinalizar tempo estimado e bloquear comandos até sincronizar.

## Limites desta etapa

Cada conta ou visitante controla apenas as próprias turmas de demonstração. Não existe papel administrativo autoatribuído, acesso entre contas, convite de coach ou unidade compartilhada. Uma aula não encerrada por contexto; até 20 registros. O visitante depende do cookie; a conta depende da identidade autenticada.

O relógio não coleta telemetria e não gera resultado, JAB, recibo ou prova de esforço. Integração de participação, resultados e evidência pertence à próxima etapa, após aceite visual. O Solver proprietário permanece uma integração futura; a matriz preserva o subconjunto de regras demonstrativas entregue na etapa 2.

## Implementação e verificação

API `/api/class-runs`, motor puro `lib/class-run.ts` e migração `0003_noisy_vulture.sql`. O cliente só envia comandos e a revisão observada. O servidor usa seu próprio horário. A atualização usa compare-and-swap e índice único parcial para impedir duas aulas abertas no mesmo contexto. O último comando pode ser repetido com a mesma chave e payload; comandos mais antigos ficam sujeitos ao conflito por revisão. Não há um diário completo de comandos nesta entrega.

53 testes TypeScript e 20 testes SQLite passaram, incluindo handlers com SQLite real, escopo de conta/visitante, snapshots, limites, concorrência, pausa/retomada e término. Typecheck e build também fazem parte do gate de publicação. A revisão visual final é do usuário; o navegador de QA previsto pelo ambiente Sites não está disponível nesta execução.
