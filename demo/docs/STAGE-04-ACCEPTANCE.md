# Entrega 04 — participação e fechamento demo

12/10/2026. Henrique autorizou seguir após a entrega 03. Esta entrega acrescenta uma revisão manual de participação e um comprovante persistente; não habilita operação física ou saldo real.

## Experiência entregue

No Painel do coach, quando a aula termina ou é interrompida, aparece Quem participou?. Cada atleta começa sem revisão. Marque Completo (12 rounds), Parcial (0–11 rounds, limitado aos rounds inteiros que transcorreram; zero exige algum tempo de aula transcorrido) ou Ausente (zero). Atalhos permitem marcar todos completos numa aula integral ou todos ausentes; continuam exigindo ação explícita e confirmação final.

O formulário só é salvo ao confirmar Fechar e gerar comprovante. O servidor fecha uma vez por aula, gera um SHA-256 do conteúdo canônico e guarda o snapshot de turma, distribuição, relógio e declarações. O histórico permite abrir, conferir a integridade e exportar o JSON completo. O comprovante permanece disponível após a exclusão da aula ou do plano original.

## Roteiro de validação visual

1. Abra https://strikex-proof-of-effort.lemos10.chatgpt.site/?view=coach e selecione PT.
2. Prepare e conclua uma aula rápida, ou escolha uma aula já encerrada no Histórico das suas aulas.
3. Em Quem participou?, confira o nome da turma e os atletas; ninguém deve aparecer automaticamente confirmado.
4. Marque um atleta Completo, outro Parcial com 6 rounds e outro Ausente. Revise os demais. Confira que o botão exige todas as revisões e a confirmação final.
5. Feche e gere o comprovante. Confira os totais e os rounds por pessoa; clique Verificar integridade e exporte o JSON.
6. Recarregue. O comprovante deve reaparecer com os mesmos dados e hash, sem formulário editável para aquela aula.
7. Exclua a aula encerrada. O comprovante deve continuar em Histórico de fechamentos.
8. Prepare outra aula, interrompa após alguns rounds e confira o limite da participação parcial. Não pode marcar Completo se o relógio não completou os 12 rounds. Se interromper durante o primeiro round, pode marcar Parcial com zero rounds inteiros. Uma aula interrompida antes de iniciar só permite Ausente.
9. Confira controles, tabela e histórico no celular.

## Regras e limites

- Participação declarada de demonstração (`demo_declared`), sem sensores, prova de esforço físico, score, JAB ou transação blockchain.
- Um nome no elenco não vincula uma conta real de atleta; a revisão pertence ao dono da turma demo. Não existe autorização compartilhada de unidade ou identificação profissional de coach nesta etapa.
- Nenhum campo de score, saldo, proprietário, hash ou horário é aceito do navegador no fechamento.
- Reenviar a mesma declaração retorna o registro original, inclusive após apagar a aula. Alterar a declaração de uma aula já fechada retorna conflito. O comprovante não é editável.
- O ID original de requisição é reservado por contexto. IDs adicionais usados só em replay não criam reservas nem registros.
- O hash cobre o conteúdo canônico completo. Confere integridade quando comparado ao digest salvo; não é assinatura digital ou autenticação de uma pessoa. Um arquivo e um hash ambos substituídos não constituem prova de origem.
- Até 100 comprovantes por contexto. Não há exclusão/retificação de comprovantes nesta etapa; exportação disponível. Exclusão da aula original libera espaço entre as 20 execuções salvas sem apagar o comprovante. Reset demo mantém turmas, execuções e comprovantes.
- Visitante depende do cookie; a conta usa a identidade autenticada. Dados de contextos diferentes ficam separados.

## Verificação técnica

71 testes TypeScript e 25 testes SQLite passaram. Novos casos incluem validação de elenco e rounds, adulteração de hash/conteúdo, concorrência no fechamento, limite atômico, conflitos, isolamento, retomada de um replay e exclusão concorrente do registro de origem. O typecheck passou. O build é o gate final de publicação. A validação visual continua com Henrique; este ambiente não disponibiliza o navegador de QA previsto pelo Sites.

## Próximo corte proposto

Após aceite e diretriz: resolver identidade de atleta/participação e papéis de unidade antes de transformar declarações demo em atestes operacionais; desenhar o ledger separado para pontos e resgates. Não promover dados `demo_declared` ou sintéticos a esforço medido ou saldo de piloto.
