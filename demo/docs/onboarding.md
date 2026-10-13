# Guia de entrada na plataforma

O guia abre na primeira entrada na Arena, pode ser dispensado e fica acessível pelo botão **Guia** no topo. `?guide=1` permite abrir diretamente. Fechar remove esse parâmetro. Navegar para uma tela pelo guia não executa comandos nessa tela.

- Atleta: 8 lições; coach: 11; gestor: 12.
- Português e inglês acompanham o idioma escolhido na plataforma.
- A seleção da trilha é apenas editorial: não muda a conta ou suas permissões.
- Etapas lidas, trilha e posição ficam neste navegador, na chave `strikex-guide-v1`. O progresso do guia não sincroniza com a conta e não indica tarefas concluídas.
- Se o armazenamento estiver indisponível, o guia funciona durante a sessão e informa essa limitação.
- O botão “Entendi. Próximo” marca a etapa como lida; navegar pelo índice não marca etapas. Ir direto à última não conclui conteúdo ainda não lido.
- Fechar com Escape ou pelo botão preserva a posição. O foco fica no diálogo enquanto aberto; o conteúdo atrás fica inativo. No celular, o índice vira seletor e os controles permanecem acessíveis no rodapé.

Conteúdo distingue demo individual, laboratório privado e aulas compartilhadas. Explica conta/visitante, JAB fictício, Solana Devnet opcional, convites, restrições, relógio persistente, fechamento privado imutável e limites de privacidade.

## Aceite visual

1. Abra a Arena em um navegador sem preferência anterior: deve aparecer a escolha de trilha.
2. Escolha uma trilha, avance, feche e reabra pelo Guia: deve retomar a posição.
3. Use o índice para pular etapas e depois concluir a última: as não lidas ainda devem ser oferecidas.
4. Abra uma tela pelo guia e retome; nenhuma aula, convite, ponto ou conta deve ser criado automaticamente.
5. Confira PT/EN, largura mobile, teclado (Tab/Shift+Tab/Escape), rolagem de passos e leitura dos avisos.
6. Conclua uma trilha e experimente outra; progresso de leitura não deve ser confundido com papel na unidade.

Validação automatizada: TypeScript, build e testes de recuperação de estado, progresso, trilhas e destinos. A validação visual no navegador permanece com o usuário.
