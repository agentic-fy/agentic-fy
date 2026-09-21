# Requisitos — CLI wynxx-fy

## Visão geral

Construir o CLI `wynxx-fy` na raiz do workspace, fazendo engenharia reversa do projeto de referência em `base/OpenSpec`. A ideia é extrair só o essencial: um CLI TypeScript performático, simples e com suporte a MCP (Model Context Protocol), reproduzindo o workflow spec-driven (`explore → propose → apply → verify → archive`).

Antes do CLI, serão criados os artefatos de conhecimento: **Skills** e **Agentes**, que orientam como o CLI e o assistente devem se comportar.

## Escopo

Dentro do escopo:
- Definição de 4 Skills e 2 Agentes.
- CLI TypeScript com os 5 comandos de workflow.
- Suporte a MCP (o CLI expõe/consome capacidades via MCP).
- Documentação da engenharia reversa (o que veio do base e o que foi descartado).

Fora do escopo (por ora):
- Reproduzir o sistema completo de stores, telemetria, completions de shell e converters do OpenSpec.
- Publicação em registry (npm).

## Referência (base)

- `base/OpenSpec` é **somente leitura**. Serve de referência.
- Padrões relevantes identificados no base:
  - Entrypoint fino em `bin/*.js` que chama `runCli()`.
  - CLI montado com `commander` (`src/cli/index.ts`).
  - Skills em arquivos `SKILL.md` com front-matter (`name`, `description`, `allowed-tools`, `license`, `metadata`).
  - Workflow spec-driven com artefatos `proposal.md`, `specs/`, `design.md`, `tasks.md`.
  - Dependências enxutas: `commander`, `chalk`, `zod`, `fast-glob`, `yaml`.

## Requisitos

### R1 — Skills
O sistema DEVE definir 4 skills, cada uma em seu próprio arquivo `SKILL.md`:
- **01 - Especialista em SDD** (Spec-Driven Development)
- **02 - Especialista em TypeScript e CLIs performáticos**
- **03 - Especialista em Harness**
- **04 - Engenharia de Software**

Critérios de aceite:
- Cada skill tem front-matter com `name`, `description` e `metadata.version`.
- Cada skill descreve claramente quando ser usada e o que produz.

### R2 — Agentes
O sistema DEVE definir 2 agentes, cada um referenciando o conjunto de skills 01–04:
- **Arquiteto de Soluções** → skills 01, 02, 03, 04
- **Engenheiro de Software** → skills 01, 02, 03, 04

Critérios de aceite:
- Cada agente tem propósito, responsabilidades e lista explícita de skills.
- A diferença de foco entre os dois agentes fica clara (arquitetura/decisão vs. implementação).

### R3 — CLI base
O CLI `wynxx-fy` DEVE:
- Ser TypeScript, ESM, rodar em Node >= 20.
- Ter entrypoint fino em `bin/wynxx-fy.js`.
- Usar `commander` para roteamento de comandos.
- Expor `--version` e `--help`.

### R4 — Comandos de workflow
O CLI DEVE expor os 5 comandos do workflow:
- `wynxx-fy explore` — mapear o problema e entender a codebase.
- `wynxx-fy propose` — rascunhar `proposal.md`, `specs/`, `design.md`, `tasks.md`.
- `wynxx-fy apply` — implementar tarefas da spec.
- `wynxx-fy verify` — verificar implementação contra a spec.
- `wynxx-fy archive` — arquivar mudanças concluídas.

Critérios de aceite:
- Cada comando existe, tem `--help` e uma implementação mínima funcional.
- Os comandos operam sobre uma estrutura de mudança em disco (ex.: `wynxx/changes/<nome>/`).

### R5 — Suporte a MCP
O CLI DEVE suportar MCP:
- Expor um subcomando `wynxx-fy mcp` que inicia um servidor MCP.
- O servidor MCP expõe os comandos de workflow como ferramentas (tools) consumíveis por um agente.

Critérios de aceite:
- `wynxx-fy mcp` inicia sem erro e responde ao handshake do protocolo.
- Pelo menos as ferramentas `explore`, `propose`, `apply`, `verify`, `archive` são registradas.

### R6 — Performance e simplicidade
O CLI DEVE priorizar performance e simplicidade:
- Dependências mínimas.
- Startup rápido (lazy import de comandos pesados quando fizer sentido).
- Sem funcionalidades do base que não sejam necessárias.

### R7 — Documentação da engenharia reversa
O sistema DEVE documentar o mapeamento base → wynxx-fy:
- O que foi trazido (e por quê).
- O que foi descartado (e por quê).
- Local: `docs/` do wynxx-fy.

## Suposições (defaults autônomos)

- Gerenciador de pacotes: `pnpm` (como no base); aceitável `npm` se `pnpm` não estiver disponível.
- SDK de MCP: `@modelcontextprotocol/sdk` (oficial TypeScript).
- Estrutura de mudanças em disco sob `wynxx/changes/`.
- Validação de artefatos com `zod`.
