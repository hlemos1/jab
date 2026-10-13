# StrikeX pitch · English / Português

Suggested spoken script: approximately 90 seconds, depending on delivery. Pair it with the [demo walkthrough](DEMO-WALKTHROUGH.md). This is a product and engineering story, not a claim of production deployment.

## English

What if every round of training came with a record you could inspect?

StrikeX is building CombatFit: an experience that connects the arena, training technology and athlete progression. Our Proof of Effort direction asks a practical question: how do we move from a training event to a result someone can trust?

This prototype makes that path visible. Enter the arena, follow twelve accelerated rounds and inspect synthetic events as they arrive. The server validates their structure, sequence and timing, calculates an illustrative score, and saves the result with its input and digest. Replaying the same session does not credit it twice. Demo JAB lets you explore fictional benefits.

Solana has a specific role: an optional Devnet Memo can publish a commitment to that saved declaration. The raw telemetry and athlete profile stay off-chain. The interface only reports confirmation after checking the transaction and its exact memo. The points are not an on-chain token.

We also demonstrate account-linked units, coach permissions and shared class clocks. Those operational records are separate from the rewards demo.

What is simulated is explicit: the sensors, performance and rewards. A blockchain receipt cannot establish that a physical workout happened. The next step is authorized participation, then authenticated equipment evidence and a validated reward policy.

We are making the experience tangible and the trust boundaries inspectable, before connecting real-world effort to real rewards.

## Português

E se cada round de treino tivesse um registro que você pudesse conferir?

A StrikeX está construindo o CombatFit: uma experiência que conecta arena, tecnologia de treino e evolução do atleta. A proposta do Proof of Effort parte de uma pergunta prática: como transformar um evento de treino em um resultado confiável?

Este protótipo deixa esse caminho visível. Você entra na arena, acompanha doze rounds acelerados e vê os eventos sintéticos. O servidor valida estrutura, sequência e tempo, calcula uma pontuação ilustrativa e salva resultado, dados de origem e hash. Reenviar a mesma sessão não gera pontos outra vez. Os JAB de demonstração permitem experimentar benefícios fictícios.

A Solana tem uma função específica: um Memo opcional na Devnet pode publicar um compromisso com essa declaração salva. Os dados brutos e o perfil ficam fora da blockchain. A interface só mostra confirmação depois de conferir a transação e o conteúdo exato do Memo. Os pontos não são um token emitido na rede.

Também demonstramos unidades vinculadas a contas, permissões de coach e relógios compartilhados de aula. Esses registros operacionais ficam separados da demonstração de recompensas.

A simulação está identificada: sensores, desempenho e benefícios. Um comprovante na blockchain não estabelece que alguém treinou. O próximo passo é a participação autorizada; depois, evidências autenticadas dos equipamentos e uma política de recompensas validada.

Estamos tornando a experiência concreta e as regras de confiança verificáveis, antes de conectar esforço real a recompensas reais.

## Questions to answer precisely

| Question | Answer supported by this code |
|---|---|
| Why use Solana here? | To explore publication of a small, independently inspectable session commitment while keeping raw telemetry off-chain. This demo does not benchmark cost or throughput. |
| Does blockchain validate the workout? | No. It can record the submitted statement; authenticating physical effort is an upstream evidence problem. |
| What prevents double rewards? | A scoped session key and atomic database write prevent a second credit for the same session ID in the same account/guest scope. They do not prevent one person creating multiple guest scopes. |
| Is JAB live? | Only fictional database points are implemented. No SPL mint, monetary balance or real benefit fulfilment exists here. |
| Is this the production Solver? | No. A public independent planner demonstrates capacity, exclusions and no consecutive repetition. The proprietary Solver is not integrated. |
| Has a Devnet receipt been confirmed in development? | The recorded development attempt was unavailable. Integration and verification code exist, but successful on-chain execution must be evidenced separately. |
| What was built for this demonstrator? | The web experience, bounded backend workflows, demo validation/ledger and receipt integration described in this repository. The brand, business and hardware concept predate it. |

Do not add adoption, revenue, hardware accuracy, partnerships, performance benchmarks or hackathon eligibility claims without independently verified evidence. Keep the current screen, pitch and repository consistent.
