# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue, de forma leve, o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto adota versionamento semântico ([SemVer](https://semver.org/lang/pt-BR/)).

## [0.1.2] - 2026-09-21

Consolidação do CLI: além do loop de workflow, o agentic passou a inspecionar,
validar e visualizar o projeto, e a integrar as ferramentas de IA via MCP no
`init`. Tudo reescrito de forma enxuta, sem dependências novas.

### Adicionado

- **Inspeção**
  - `list` — lista as changes ativas (`--specs`, `--long`, `--json`).
  - `show <nome>` — mostra uma change, um artefato (`--artifact`) ou uma spec
    (`--spec`); sugere nomes próximos quando o nome não bate ("você quis dizer?").
  - `status` — panorama das changes por estágio, com progresso e problemas.
  - `context` — reúne config, changes e specs num brief para o agente.
  - `view` — dashboard de specs e changes, interativo no terminal (navegação por
    número via readline nativo) e com modo `--static`/`--json`.
- **Validação e integridade**
  - `validate [nome]` — valida os artefatos de uma change (`--all`, `--strict`,
    `--json`): detecta artefato ausente, template intocado, corpo vazio e
    `tasks.md` sem checkbox real.
  - `doctor` — checagem de integridade do projeto (config, metadata das changes,
    diretórios órfãos, artefatos coerentes).
- **Configuração**
  - `config show` / `config set` — lê e edita o `agentic.config.yaml`, validando
    pelo schema antes de gravar.
- **Integração de ferramentas de IA no `init`**
  - Seleção de ferramenta interativa (com pré-seleção das detectadas) e flag
    `--tools all|none|<lista>` para modo não-interativo.
  - Geração/merge **não-destrutivo e idempotente** do `mcp.json` de cada
    ferramenta (Kiro, Cursor, GitHub Copilot, Claude Code, Windsurf), apontando
    para `agentic mcp`.
- **Autocompletar**
  - `completion [shell]` — imprime um script de autocompletar para PowerShell,
    Bash ou Zsh, sem instalar nada automaticamente.
- **MCP**
  - Novas tools expostas pelo servidor MCP: `list`, `show`, `validate`,
    `status` e `context` (além das de workflow).

### Alterado

- `init` deixou de criar apenas a estrutura base: agora também configura a
  integração MCP das ferramentas escolhidas (mantendo a idempotência).
- Documentação (`docs/commands.md` e `docs/getting-started.md`) atualizada para
  cobrir todos os comandos e a integração via MCP.

### Mantido enxuto (fora de escopo por design)

Recursos do projeto de referência que **não** foram trazidos, para preservar a
proposta minimalista: planejamento multi-repositório (stores/worksets),
profiles, migração/legado, telemetria, geração de skills por ferramenta e o
modelo de deltas estruturados de specs.

## [0.1.1] - 2026-09

- Núcleo do workflow spec-driven: `init`, `explore`, `propose`, `apply`,
  `verify`, `archive`.
- Servidor MCP (`mcp`) expondo as tools de workflow via stdio.
- Estrutura base do projeto (`agentic.config.yaml` + `agentic/`).

[0.1.2]: #012---2026-09-21
[0.1.1]: #011---2026-09
