# Entrega 01 — conta do atleta

12/10/2026 · Implementada; aguardando validação visual de Henrique.

## O que testar

Abra https://strikex-proof-of-effort.lemos10.chatgpt.site/?view=account e selecione PT, se necessário.

1. Entre com ChatGPT. O indicador deve mudar de Visitante para Conta conectada.
2. Crie seu perfil com nome e avatar. Editar e salvar não deve iniciar uma batalha.
3. Inicie uma batalha, avance para o resultado e feche. Consulte Atividade.
4. Recarregue e confira nome, avatar, resultado e pontos.
5. Entre com a mesma conta em outro navegador ou dispositivo: o mesmo histórico deve aparecer.
6. Saia. O perfil visitante deve continuar separado; entrar novamente recupera o perfil da conta.
7. No celular, confira menu inferior, conta, formulário e resultado sem cortes ou rolagem horizontal.

O modo visitante continua disponível sem login. Histórico visitante não é importado para a conta. Reiniciar demo apaga somente o perfil, sessões e pontos de demonstração do contexto atual; não encerra login.

## Correção da rotação

Não há exigência de visitar todos os tipos ou de passar duas vezes por estação. O demonstrador aceita uma sequência não uniforme sem repetição consecutiva. Continua sendo uma jornada individual ilustrativa: capacidade da turma e integração do Solver serão tratadas na próxima entrega.

## Evidência técnica

- 24 testes TypeScript: motor, isolamento de identidade, handlers reais com identidade substituída na fronteira de teste, replay histórico e comprovante Solana.
- 11 testes SQLite: isolamento, concorrência, saldo e persistência.
- Typecheck e build de publicação.
- A validação visual e o login completo no provedor ficam para o teste de usuário. Testes automatizados de identidade não equivalem ao login real num navegador.

## Limite e próxima entrega

Sensores, treino, pontos JAB e benefícios continuam demonstrativos. Não foram implementados papéis de coach, reserva, aula operacional, prova física ou financiamento permanente da Devnet.

Após a validação desta entrega: configuração de turma e distribuição por capacidade segundo o Solver, com integração da implementação existente quando seu contrato/código estiver disponível. Não iniciar automaticamente a próxima fase antes da diretriz de Henrique.
