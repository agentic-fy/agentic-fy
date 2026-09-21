# Design — CLI wynxx-fy

## Objetivo do design

Traduzir os requisitos em uma arquitetura enxuta, extraindo do `base/OpenSpec` apenas os padrões essenciais. O resultado é um CLI TypeScript performático, simples e com suporte a MCP.

## Engenharia reversa: base → wynxx-fy

Mapeamento do que foi analisado em `base/OpenSpec` e a decisão de trazer ou descartar.

| Elemento no base | Decisão | Motivo |
| --- | --- | --- |
| Entrypoint fino `bin/openspec.js` → `runCli()` | Trazer | Padrão simples e testável. Vira `bin/wynxx-fy.js`. |
| CLI com `commander` (`src/cli/index.ts`) | Trazer (simplificado) | Roteamento maduro e leve. Removemos hooks de telemetria. |
| Workflow `explore/propose/apply/verify/archive` | Trazer | É o núcleo do produto. |
| Skills em `SKILL.md` com front-matter | Trazer | Formato claro e portável para skills/agentes. |
| Artefatos `proposal.md`, `specs/`, `design.md`, `tasks.md` | Trazer | Base do fluxo spec-driven. |
| Deps: `commander`, `chalk`, `zod`, `yaml` | Trazer | Enxutas e úteis (CLI, cores, validação, front-matter). |
| `fast-glob` | Trazer (se necessário) | Só se precisar varrer artefatos; senão usar `fs` nativo. |
| Telemetria (`src/telemetry`) | Descartar | Não é necessário; adiciona complexidade e I/O. |
| Stores multi-repo (`--store`, registro global) | Descartar | Excesso de escopo para a versão enxuta. |
| Completions de shell (`completion`, `__complete`) | Descartar | Não essencial ao workflow. |
| `converters`, `github-copilot`, `profiles`, `migration` | Descartar | Específicos do OpenSpec e fora do escopo. |
| `ora` (spinners), `diff`, `cross-spawn`, `inquirer` | Descartar por padrão | Adicionar só se um comando realmente precisar. |
| Suporte a MCP | Adicionar (novo) | Requisito próprio do wynxx-fy; não existe no base. |

## Arquitetura

```
wynxx-fy/ (raiz do workspace)
+-- bin/
|   +-- wynxx-fy.js            # entrypoint fino -> runCli()
+-- src/
|   +-- cli/
|   |   +-- index.ts           # monta o program (commander), registra comandos
|   +-- commands/
|   |   +-- explore.ts
|   |   +-- propose.ts
|   |   +-- apply.ts
|   |   +-- verify.ts
|   |   +-- archive.ts
|   |   +-- mcp.ts             # inicia o servidor MCP
|   +-- core/
|   |   +-- change.ts          # ler/criar mudancas em wynxx/changes/<nome>/
|   |   +-- artifacts.ts       # ler/escrever proposal/specs/design/tasks
|   |   +-- schema.ts          # schemas zod dos artefatos
|   +-- mcp/
|   |   +-- server.ts          # registra as tools de workflow no servidor MCP
|   +-- index.ts               # re-exporta cli/core
+-- skills/
|   +-- 01-sdd/SKILL.md
|   +-- 02-typescript-cli/SKILL.md
|   +-- 03-harness/SKILL.md
|   +-- 04-engenharia-software/SKILL.md
+-- agents/
|   +-- arquiteto-de-solucoes.md
|   +-- engenheiro-de-software.md
+-- docs/
|   +-- reverse-engineering.md # o mapa base -> wynxx-fy
+-- wynxx/
|   +-- changes/               # mudancas em andamento (runtime)
+-- package.json
+-- tsconfig.json
+-- build.js (ou tsc)
```

## Superfície de comandos

Conjunto base do CLI. Cada comando de workflow tem sua lógica em `commands/*` como função pura, reutilizada tanto pelo handler do commander quanto pela tool MCP.

### Setup / infra

| Comando | O que faz |
| --- | --- |
| `wynxx-fy init [path]` | Cria **apenas a estrutura base** (espelhando o `/base`): os diretórios do projeto + arquivo de config. Não semeia skills, agentes nem conteúdo de artefatos. |
| `wynxx-fy mcp` | Sobe o servidor MCP expondo as tools de workflow via stdio. |

### Workflow (núcleo)

| Comando | O que faz |
| --- | --- |
| `wynxx-fy explore` | Modo pensamento; mapeia problema e codebase (read-only por padrão). |
| `wynxx-fy propose <nome>` | Cria a change e rascunha `proposal.md`, `specs/`, `design.md`, `tasks.md`. |
| `wynxx-fy apply [nome]` | Implementa as tarefas de `tasks.md`. |
| `wynxx-fy verify [nome]` | Verifica a implementação contra a spec. |
| `wynxx-fy archive [nome]` | Move a change concluída para `wynxx/changes/archive/`. |

### Detalhe do `init`

Espelha `createDirectoryStructure` + `createConfig` do base (`src/core/init.ts`): cria diretórios idempotentemente e o config apenas se não existir. **Sem** tool selection, profiles, delivery, legacy cleanup ou geração de skills/comandos.

Estrutura criada:

```
<path>/
+-- wynxx.config.yaml          # config base (schema/workflow padrao, versao)
+-- wynxx/
|   +-- specs/                 # (com .gitkeep)
|   +-- changes/
|   |   +-- archive/           # (com .gitkeep)
```

Comportamento:
- Idempotente: rodar de novo (modo extend) só garante que os diretórios existem; não sobrescreve config existente.
- `wynxx.config.yaml` criado só se ainda não existir.
- Skills (`skills/`) e agentes (`agents/`) NÃO são criados aqui — são passos separados (fases 1 e 2).

## Decisões técnicas

- **Módulos**: ESM (`"type": "module"`), como o base. Node >= 20.
- **CLI**: `commander` v14. Um `program` central; cada comando é um módulo que exporta uma função `register(program)` ou um handler.
- **Lazy imports**: comandos pesados (ex.: `mcp`) usam `await import()` dentro do handler para não penalizar o startup dos comandos comuns.
- **Validação**: `zod` para validar metadados de mudança e artefatos.
- **Front-matter**: `yaml` para ler/escrever front-matter de `SKILL.md` e artefatos quando necessário.
- **MCP**: usar `@modelcontextprotocol/sdk`. `src/mcp/server.ts` registra uma tool por comando de workflow, cada uma delegando à mesma função de `commands/*`. `wynxx-fy mcp` sobe o servidor via stdio.
- **Reuso comando ↔ MCP**: a lógica de cada comando fica em `commands/*` como função pura testável; tanto o handler do commander quanto a tool MCP a chamam. Evita duplicação.

## Modelo de dados (mudança)

Uma "mudança" (change) vive em `wynxx/changes/<nome>/`:

```
wynxx/changes/<nome>/
+-- proposal.md    # resumo/justificativa
+-- design.md      # decisoes de design
+-- specs/         # requisitos detalhados
+-- tasks.md       # tarefas de implementacao
+-- .wynxx.yaml    # metadata (nome, status, criado em)
```

Metadata (`.wynxx.yaml`) validada por zod:

```
name: string
status: "exploring" | "proposed" | "applying" | "verified" | "archived"
createdAt: string (ISO)
```

## Fluxo dos comandos

- `explore`: modo de pensamento. Lê codebase e artefatos existentes; NÃO implementa. Pode criar/atualizar artefatos de uma mudança confirmada.
- `propose`: cria a mudança (se não existir) e rascunha `proposal.md`, `specs/`, `design.md`, `tasks.md`.
- `apply`: lê `tasks.md` e orienta/implementa as tarefas na ordem, mantendo alinhamento com `design.md` e `specs/`.
- `verify`: compara implementação com `specs/` e `design.md`; roda build/testes relevantes.
- `archive`: consolida artefatos e move a mudança para histórico (`wynxx/changes/archive/<nome>/`).

## Skills e Agentes

- **Skills** (`skills/NN-*/SKILL.md`): front-matter (`name`, `description`, `metadata.version`) + corpo com "quando usar", "o que faz" e diretrizes.
  - 01 SDD, 02 TypeScript e CLIs performáticos, 03 Harness, 04 Engenharia de Software.
- **Agentes** (`agents/*.md`): propósito, responsabilidades e a lista de skills que o agente carrega.
  - Arquiteto de Soluções: foco em decisões, arquitetura e trade-offs. Skills 01–04.
  - Engenheiro de Software: foco em implementação, testes e qualidade. Skills 01–04.

## Riscos e mitigações

- **Versões de deps do base são futuristas** (ex.: TypeScript ^6, eslint ^10). Mitigar: fixar versões estáveis/atuais conhecidas ao implementar, não copiar cegamente do base.
- **MCP SDK evolui rápido**. Mitigar: encapsular o uso do SDK em `src/mcp/server.ts` para trocar com baixo impacto.
- **Escopo crescer para o tamanho do base**. Mitigar: seguir a tabela de engenharia reversa; qualquer inclusão nova precisa de justificativa.
