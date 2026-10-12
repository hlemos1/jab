# Entrega 02 — turma e distribuição

12/10/2026. A entrega 01 foi testada e aprovada pelo usuário antes do início desta etapa.

## Experiência entregue

Aba Turma: monte uma turma de 1 a 11 atletas, edite nomes e exclua manualmente estações para um atleta. A capacidade standard é fixa nesta entrega: Volume 3, Técnica 3, Força 2, Velocidade 1, Imersão/VR 1 e Reflexo 1. O servidor gera e salva a matriz inteira dos 12 rounds. Navegue round a round, consulte a grade completa ou acompanhe um atleta. Recarregar recupera o plano salvo; conta e visitante permanecem separados.

Não há obrigação de passar por todos os tipos nem duas vezes por estação. Capacidade, exclusões e ausência de repetição consecutiva são restrições rígidas.

O motor é uma implementação demonstrativa independente desse subconjunto de regras. Não é o código do Solver de produção, que ainda não foi localizado/integrado. Não inclui categorias, histórico semanal, regras de proteção, prescrição clínica ou equivalência de exposição. As exclusões são escolhas manuais, sem coleta de informações médicas.

## Roteiro de teste de usuário

1. Abra https://strikex-proof-of-effort.lemos10.chatgpt.site/?view=classes e selecione PT.
2. Edite o nome da turma e alguns nomes de atletas. Gere a distribuição padrão com 11 pessoas.
3. Passe pelos rounds e confira as ocupações:3/3/2/1/1/1, sem exceder nenhuma vaga.
4. Abra Grade completa. Selecione um atleta em Acompanhe um atleta e confira que a estação nunca se repete consecutivamente.
5. Bloqueie uma estação para um atleta, gere outro plano e confira sua sequência. Excluir uma estação não exige redistribuir todos por todos os tipos.
6. Reduza a turma, gere um plano e confira as vagas livres.
7. Recarregue e abra uma turma salva. Exporte o JSON e exclua um plano que não queira manter.
8. Confira celular, controles e rolagem horizontal confinada à grade.

Para testar configuração inviável: deixe três atletas com apenas Velocidade e VR disponíveis. Essas duas estações têm duas vagas simultâneas no total; o servidor deve rejeitar o plano, sem salvar uma grade parcial. Cada atleta precisa de pelo menos duas estações disponíveis para alternar.

## Persistência e limites

GET /api/classes lista até 20 planos do contexto autenticado/visitante atual. POST generate recebe um requestId e a configuração; o servidor escolhe a semente e calcula a matriz. Reenviar a mesma configuração com a mesma chave devolve o plano original; outra configuração com a mesma chave retorna conflito. O limite 20 é imposto numa inserção atômica. Excluir exige propriedade do plano. Reiniciar a demo de treino não apaga os planos: use Excluir na aba Turma.

Não há lista pública de turmas, painel compartilhado de coach, reserva, check-in ou aula em andamento. A navegação dos rounds é uma prévia; não é cronômetro oficial e não gera sessão concluída ou saldo JAB.

## Próxima entrega

Depois do aceite visual: definir o acesso de coach e a operação da aula com estado e relógio no servidor. Reutilizar o contrato/código do Solver original quando disponível; não alegar paridade completa com o motor proprietário.

## Verificação técnica

38 testes TypeScript e 15 testes SQLite passaram, além do typecheck. O motor foi comparado com um verificador exaustivo independente em 125 configurações pequenas, e testado com todos os tamanhos de turma, de 1 a 11. Testes de API cobrem acesso cruzado, replay, conflito, limites e exclusão. A validação visual dos novos fluxos fica para Henrique; o ambiente desta execução não disponibiliza o navegador de QA previsto pelo fluxo de publicação.
