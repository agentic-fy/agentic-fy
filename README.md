# agentic

CLI TypeScript performático e enxuto para workflow **spec-driven**, com suporte a **MCP**.

O agentic estrutura o ciclo de desenvolvimento guiado por specs — do rascunho ao arquivamento — e expõe esse fluxo tanto no terminal quanto como servidor MCP, para que um agente de IA possa conduzir o trabalho na sua IDE.

## Por que agentic

- **Enxuto.** Poucas dependências, sem cerimônia. Fácil de entender e estender.
- **MCP-first.** Integra com a IDE via Model Context Protocol, não via arquivos de skill por ferramenta.
- **Spec-driven.** Cada mudança nasce de artefatos claros: proposta, design, tarefas e spec.

## Requisitos

- Node.js `>= 20.19.0`

## Instalação

```bash
npm install -g @agentic-fy/agentic
```

Ou rode sem instalar:

```bash
npx @agentic-fy/agentic --version
```

## Início rápido

```bash
cd seu-projeto
agentic init                    # cria a estrutura e integra sua IDE (MCP)
agentic explore                 # (opcional) pense antes de codar
agentic propose "dark mode"     # rascunha proposal, design, tasks e spec
agentic apply                   # acompanha as tarefas
agentic verify                  # confere se está pronto
agentic archive                 # arquiva a change concluída
```

## O que o `init` cria

```
agentic.config.yaml     # configuração do projeto
agentic/
├── specs/              # specs do projeto
├── changes/            # mudanças propostas (uma pasta por change)
│   └── archive/        # changes concluídas
```

O `init` é idempotente e também configura a integração MCP da sua IDE. No terminal ele pergunta qual ferramenta configurar; para pular o prompt use `--tools`:

```bash
agentic init --tools kiro,cursor   # configura as ferramentas escolhidas
agentic init --tools none          # só a estrutura base
```

O merge do `mcp.json` é não-destrutivo: se você já tem um, o agentic só adiciona o próprio servidor sem apagar o resto.

## Comandos

| Comando | O que faz |
|---|---|
| `init [path] [--tools <lista>]` | Cria a estrutura base e integra as ferramentas de IA (MCP) |
| `explore` | Modo pensamento: mapeia o problema e lista as changes ativas |
| `propose <nome>` | Cria a change e rascunha `proposal`, `design`, `tasks`, `specs/` |
| `apply [nome]` | Lê o `tasks.md` e reporta o progresso das tarefas |
| `verify [nome]` | Confere artefatos e tarefas; marca como `verified` |
| `archive [nome]` | Arquiva a change concluída |
| `list [--specs] [--long] [--json]` | Lista changes (ou specs) |
| `show <nome> [--artifact\|--spec] [--json]` | Mostra uma change, um artefato ou uma spec |
| `validate [nome] [--all] [--strict] [--json]` | Valida os artefatos de uma change |
| `status [--json]` | Panorama das changes por estágio, progresso e problemas |
| `config show \| set <chave> <valor>` | Lê e edita o `agentic.config.yaml` |
| `doctor [--json]` | Verifica a integridade do projeto |
| `context [--json]` | Reúne config, changes e specs num brief para o agente |
| `view [--static] [--json]` | Dashboard de specs e changes (interativo no terminal) |
| `completion [shell]` | Imprime um script de autocompletar (powershell/bash/zsh) |
| `mcp` | Inicia o servidor MCP (stdio) |

Referência completa em [`docs/commands.md`](docs/commands.md).

## Os artefatos de uma change

Ao rodar `propose`, a change ganha:

| Artefato | Propósito |
|----------|-----------|
| `proposal.md` | O "por quê" e o "o quê" — intenção, escopo e abordagem |
| `specs/spec.md` | Requisitos e critérios de aceite |
| `design.md` | O "como" — abordagem técnica e decisões |
| `tasks.md` | Checklist de implementação |

## Deixando a IA conduzir (MCP)

Se você escolheu uma ferramenta no `init`, o `mcp.json` da sua IDE já foi configurado — basta recarregar a IDE. Para subir o servidor manualmente:

```bash
agentic mcp
```

Ele expõe as tools `explore`, `propose`, `apply`, `verify`, `archive`, `list`, `show`, `validate`, `status` e `context` para qualquer agente compatível com MCP. Detalhes de configuração por editor em [`docs/commands.md`](docs/commands.md#mcp).

## Desenvolvimento

```bash
npm install
npm run build       # compila TypeScript para dist/
npm run dev         # tsc em watch
npm test            # roda a suíte (vitest)
node bin/agentic.js --version
```

## Documentação

- [Primeiros passos](docs/getting-started.md)
- [Conceitos essenciais](docs/overview.md)
- [Comandos](docs/commands.md)
- [Changelog](CHANGELOG.md)

## Licença

MIT
