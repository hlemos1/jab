# JAB$

Connecting real physical effort with measurable progress and useful digital benefits.

JAB$ is the Web3 initiative within the StrikeX ecosystem. StrikeX combines training software, an athlete app, connected equipment and physical fitness experiences. JAB$ extends that foundation toward incentives linked to validated participation, with Solana as the intended network.

This repository contains the public project overview and a standalone interactive demonstrator for Colosseum 2026.

## Try the prototype

**[Open StrikeX · Proof of Effort](https://strikex-proof-of-effort.lemos10.chatgpt.site)** · **[Source and setup](demo/README.md)**

Create a demo profile, replay 12 training rounds, receive demo JAB, inspect server validation and request an optional Solana Devnet receipt. Sensor telemetry and benefits are simulated. There is no token minting or physical-effort proof.

The standalone prototype was built on October 12, 2026 with AI coding assistance. Public Devnet faucet availability prevented a confirmed live receipt during development; the integration does not display confirmation without verifying the exact transaction. See [technical scope](demo/docs/ARCHITECTURE.md) and [Solana details](demo/docs/SOLANA.md).

## Review the submission

| Review path | Evidence |
|---|---|
| [Pitch in English and Portuguese](demo/docs/PITCH.md) | A concise product story tied to implemented behavior |
| [Interactive pitch, architecture and lab](https://strikex-proof-of-effort.lemos10.chatgpt.site/?view=system) | Inspect the flow, run local scenarios and replay a saved session against the server |
| [Public architecture](demo/docs/ARCHITECTURE.md) | Authority boundaries, separate session/class flows and on/off-chain data |
| [Implementation contracts](demo/docs/IMPLEMENTATION.md) | Validation, persistence, authorization and concurrency behavior |
| [MVP roadmap](demo/docs/ROADMAP.md) | Dependencies and measurable acceptance gates |
| [Publication boundaries](demo/docs/PUBLIC-BOUNDARIES.md) | What the public demo includes and what remains proprietary |

For reproducible checks, run `pnpm run check` from `demo/` after installing dependencies (Node 24 and Python 3). This runs type checking, domain/API tests and SQLite invariant suites. A passing suite is not evidence of physical effort or a confirmed live blockchain transaction.

Session receipts can be exported and checked locally in the app. The verifier checks content against the supplied digest; it does not authenticate the issuer. Shared class operations do not feed the demonstration JAB ledger.

## The problem

People struggle to stay consistent when training feels repetitive and progress is difficult to see. Gym operators need engaging experiences they can deliver reliably across locations. Digital rewards can support participation, but the underlying workout must be valuable and the business must support the incentives.

Our starting point is a real training experience, measurable progress and a path to repeat participation.

## The StrikeX foundation

- **Strike OS** — software for running the CombatFit training experience.
- **Athlete app** — personal performance, training history, progression and rankings.
- **STRIKER ONE + SINAPSE** — connected equipment and sensing technology that connect physical activity with the digital experience.
- **CombatFit arenas** — coached sessions combining combat-inspired exercise, structured rounds and game mechanics.
- **JAB$** — the Web3 initiative designed to connect validated participation with useful benefits.

Participants train, receive feedback and build a visible record of progress. Physical arenas, franchise distribution and the digital experience provide routes to customers and recurring activity.

## Why Solana

We selected Solana as the intended network for the incentive layer, with affordable interactions and a straightforward consumer experience as design priorities. The goal is to make digital benefits useful to people who come to train, without requiring them to understand blockchain.

Our Web3 work focuses on linking validated physical participation to those benefits. The Solana integration is in development.

## Current stage

As of October 11, 2026:

- The four-person team has worked full-time on StrikeX since early 2026.
- The operating system, athlete app and sensor hardware have been developed and tested, and the platform is online.
- A first pilot gym has been set up and tested with multiple participants.
- Two franchise opportunities are under negotiation in Portugal.
- Approximately 14 prospects have expressed interest in condominium Pocket units in Brazil.

Franchise discussions and expressions of interest are pipeline, not signed locations or booked revenue.

The core fitness product predates the hackathon. JAB$ is the Web3 extension being developed on that foundation. The new `demo/` directory contains standalone prototype code; it does not include a custom deployed Solana program or pre-existing proprietary implementation code.

## Sustainable incentives and business model

The intended reward model uses capped budgets supported by operating margins and partners. Token price appreciation is not the foundation of the business.

Planned StrikeX revenue combines recurring software licenses, franchise royalties and support fees, connected equipment sales, and memberships or classes at company-operated arenas. Premium digital services and partner-funded campaigns provide additional opportunities. Pilot operations will inform pricing, retention and unit economics.

Applications involving real-world assets remain an area for future exploration; they are not presented here as a live investment product.

## Languages and technology

| Scope | Public information |
|---|---|
| Standalone workout-planning module and browser simulator | JavaScript, Node.js and HTML; developed separately from the main Strike OS |
| Web3 direction | Solana; integration in development |
| This repository | Project documentation and a standalone React/TypeScript + Worker/D1 demonstrator |

The hosted demo requires no installation. To run its source and tests, see [demo/README.md](demo/README.md).

## Team

| Member | Focus | Location |
|---|---|---|
| [Henrique Lemos](https://github.com/hlemos1) | Strategy, business development and franchising; founder of Grupo Rão | Portugal |
| Ricardo Santos | Software development, Strike OS and Web3 development | Portugal |
| Fernando Vieira | Physical implementation, suppliers and operations | Portugal |
| Douglas Miranda | Web3 community and ecosystem development | Brazil |

The team combines business and franchising experience with software development and physical execution. We collaborate remotely across Portugal and Brazil and meet in person as needed.

## Company and publication scope

StrikeX operates through IRON GUARDIAN - LDA, a Portuguese private limited company.

This repository contains public-facing documentation and the newly authored standalone demo. Pre-existing proprietary software, firmware, private architecture, credentials, personal training data and confidential commercial materials are not included.

See [NOTICE.md](NOTICE.md) for the publication scope.
