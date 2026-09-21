# Tarefas — CLI wynxx-fy

Plano de implementação incremental. A ordem respeita o pedido: **primeiro Skills e Agentes, depois o CLI**. Cada bloco é entregável e verificável.

## Fase 0 — Documentação da engenharia reversa

- [ ] 0.1 Criar `docs/reverse-engineering.md` com a tabela base → wynxx-fy (trazido/descartado + motivo), a partir do `design.md`.
- [ ] 0.2 Atualizar `docs/wynxx-fy.md` (mini doc do workflow) com link para a spec e para a doc de engenharia reversa.

_Verificação:_ docs abrem e refletem as decisões do design.

## Fase 1 — Skills

- [ ] 1.1 Criar `skills/01-sdd/SKILL.md` — Especialista em SDD (Spec-Driven Development).
- [ ] 1.2 Criar `skills/02-typescript-cli/SKILL.md` — Especialista em TypeScript e CLIs performáticos.
- [ ] 1.3 Criar `skills/03-harness/SKILL.md` — Especialista em Harness.
- [ ] 1.4 Criar `skills/04-engenharia-software/SKILL.md` — Engenharia de Software.
- [ ] 1.5 Cada `SKILL.md` com front-matter (`name`, `description`, `metadata.version`) + corpo (quando usar / o que faz / diretrizes).

_Verificação:_ front-matter YAML válido em todas; descrições claras e sem sobreposição excessiva.

## Fase 2 — Agentes

- [ ] 2.1 Criar `agents/arquiteto-de-solucoes.md` — propósito (decisões/arquitetura/trade-offs), responsabilidades, skills 01–04.
- [ ] 2.2 Criar `agents/engenheiro-de-software.md` — propósito (implementação/testes/qualidade), responsabilidades, skills 01–04.

_Verificação:_ cada agente lista explicitamente as 4 skills e deixa claro o foco distinto.

## Fase 3 — Scaffolding do projeto CLI

- [ ] 3.1 Criar `package.json` (ESM, `type: module`, `bin.wynxx-fy`, scripts build/dev/test, engines node >=20).
- [ ] 3.2 Criar `tsconfig.json` (target/module modernos, `outDir: dist`, strict).
- [ ] 3.3 Adicionar deps enxutas: `commander`, `chalk`, `zod`, `yaml` (+ `@modelcontextprotocol/sdk`).
- [ ] 3.4 Criar `bin/wynxx-fy.js` (entrypoint fino → `runCli()`).
- [ ] 3.5 Criar `src/cli/index.ts` com `program` base (`--version`, `--help`) e `runCli()`.

_Verificação:_ `pnpm build` compila; `node bin/wynxx-fy.js --help` lista o CLI.

## Fase 4 — Núcleo de mudanças e artefatos

- [ ] 4.1 Criar `src/core/schema.ts` — schemas zod de `.wynxx.yaml` e artefatos.
- [ ] 4.2 Criar `src/core/change.ts` — criar/ler mudanças em `wynxx/changes/<nome>/`.
- [ ] 4.3 Criar `src/core/artifacts.ts` — ler/escrever `proposal.md`, `specs/`, `design.md`, `tasks.md`.

_Verificação:_ criar uma mudança de teste gera a estrutura esperada com metadata válida.

## Fase 4.5 — Comando `init` (estrutura base)

- [ ] 4.5.1 `src/commands/init.ts` — cria **apenas a estrutura base** (espelha `createDirectoryStructure` + `createConfig` do base): diretórios `wynxx/specs/`, `wynxx/changes/`, `wynxx/changes/archive/` (com `.gitkeep`) e `wynxx.config.yaml` (só se não existir). Idempotente. NÃO gera skills/agentes.
- [ ] 4.5.2 Aceitar `[path]` opcional (default `.`) e registrar em `src/cli/index.ts`.

_Verificação:_ `wynxx-fy init` em pasta vazia cria a estrutura; rodar de novo não sobrescreve o config.

## Fase 5 — Comandos de workflow

- [ ] 5.1 `src/commands/explore.ts` — modo pensamento (read-only por padrão).
- [ ] 5.2 `src/commands/propose.ts` — cria a mudança e rascunha os 4 artefatos.
- [ ] 5.3 `src/commands/apply.ts` — percorre `tasks.md` e orienta a implementação.
- [ ] 5.4 `src/commands/verify.ts` — compara implementação vs. spec; roda checagens.
- [ ] 5.5 `src/commands/archive.ts` — move a mudança concluída para `wynxx/changes/archive/`.
- [ ] 5.6 Registrar todos em `src/cli/index.ts`; cada comando com `--help`.

_Verificação:_ `wynxx-fy propose demo` cria a mudança; os demais comandos operam sobre ela sem erro.

## Fase 6 — Suporte a MCP

- [ ] 6.1 Criar `src/mcp/server.ts` — registra uma tool por comando de workflow, delegando às funções de `commands/*`.
- [ ] 6.2 Criar `src/commands/mcp.ts` — `wynxx-fy mcp` sobe o servidor via stdio (lazy import do SDK).
- [ ] 6.3 Registrar `mcp` no `program`.

_Verificação:_ `wynxx-fy mcp` inicia e responde ao handshake; ferramentas explore/propose/apply/verify/archive aparecem listadas.

## Fase 7 — Qualidade e fechamento

- [ ] 7.1 Testes das funções puras de `core/*` e dos handlers de comando.
- [ ] 7.2 `README.md` do wynxx-fy com instalação e uso dos 5 comandos + MCP.
- [ ] 7.3 Rodar build + testes; corrigir pendências.
- [ ] 7.4 Revisar a tabela de engenharia reversa: nada fora do escopo entrou sem justificativa.

_Verificação:_ build verde, testes passando, docs coerentes com o implementado.

## Dependências entre fases

```
Fase 0 (docs) ----+
Fase 1 (skills) --+--> Fase 2 (agentes)
                            |
Fase 3 (scaffold) ----------+--> Fase 4 (core) --> Fase 5 (comandos) --> Fase 6 (MCP) --> Fase 7 (qualidade)
```

As fases 1 e 2 (skills/agentes) são independentes do CLI e vêm primeiro, conforme pedido. O CLI (3→7) segue depois.
