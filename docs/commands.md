# Comandos

Referência de cada comando do CLI `agentic-fy`. Todos rodam no seu terminal.

Flags globais:
- `-v, --version` — mostra o logo, a versão e a lista de comandos.
- `--help` — ajuda do comando.
- `--no-color` — desabilita a saída colorida.

A maioria dos comandos (exceto `init` e `mcp`) precisa de um projeto já inicializado — ou seja, um `agentic-fy.config.yaml` no diretório atual ou em um diretório acima.

## init

```bash
agentic-fy init [path] [--tools <lista>]
```

Cria a estrutura base do projeto em `path` (padrão: diretório atual):

```
agentic-fy.config.yaml
agentic-fy/
├── specs/              (com .gitkeep)
├── changes/
│   └── archive/        (com .gitkeep)
```

Idempotente: rodar de novo garante que os diretórios existem e **não** sobrescreve o `agentic-fy.config.yaml`.

### Integração com ferramentas de IA

Além da estrutura, o `init` configura a integração MCP das ferramentas de IA que você usa, escrevendo (ou mesclando) o `mcp.json` de cada uma apontando para `agentic-fy mcp`. Assim o agente da sua IDE já enxerga as ferramentas do agentic-fy.

Como as ferramentas são escolhidas:

- **Interativo** (terminal com TTY): o `init` mostra a lista e deixa você escolher pelos números. As ferramentas já detectadas no projeto vêm pré-selecionadas (marcadas com `*`); pressionar Enter aceita a pré-seleção.
- **Não-interativo** (`--tools`): pula o prompt.
  - `--tools all` — configura todas as suportadas.
  - `--tools none` — não configura nenhuma (só a estrutura base).
  - `--tools kiro,cursor` — configura só as informadas.
- **Sem TTY e sem `--tools`** (CI, pipes): não configura nenhuma ferramenta e segue normalmente.

Ferramentas suportadas: `kiro`, `cursor`, `github-copilot`, `claude`, `windsurf`.

O merge é **não-destrutivo e idempotente**: outros servidores MCP e chaves já presentes no arquivo são preservados; rodar de novo não duplica nem sobrescreve uma configuração que você editou à mão. Cada ferramenta é reportada como `configurada`, `atualizada` ou `sem alteração`.

Exemplos:

```bash
agentic-fy init --tools kiro,cursor    # configura Kiro e Cursor
agentic-fy init --tools none           # só a estrutura base
agentic-fy init                        # pergunta (ou nada, se sem TTY)
```

## explore

```bash
agentic-fy explore
```

Modo pensamento. Confirma que existe um projeto agentic-fy e lista as changes ativas com seus status. Não cria nem altera nada — é um ponto de partida para mapear o problema antes de propor.

## propose

```bash
agentic-fy propose <nome>
```

Cria uma change e rascunha os artefatos a partir de templates:
- `proposal.md`, `design.md`, `tasks.md`
- `specs/spec.md`

O `<nome>` é normalizado para um slug (ex.: `"add login"` vira `add-login`). Não sobrescreve arquivos já existentes. Ao final, marca o status da change como `proposed`.

## apply

```bash
agentic-fy apply [nome]
```

Lê o `tasks.md` da change, faz o parse das checkboxes e reporta quantas tarefas estão concluídas e pendentes, listando as pendentes. Marca o status como `applying`.

Se `nome` for omitido e houver exatamente uma change ativa, ela é usada; se houver várias, o comando pede que você especifique o nome.

## verify

```bash
agentic-fy verify [nome]
```

Confere se os três artefatos (`proposal`, `design`, `tasks`) existem e se todas as tarefas do `tasks.md` estão marcadas. Só marca a change como `verified` quando tudo está presente e sem tarefas pendentes; caso contrário, aponta o que falta.

## archive

```bash
agentic-fy archive [nome]
```

Move a change para `agentic-fy/changes/archive/<nome>/` e marca o status como `archived`.

## list

```bash
agentic-fy list [--specs] [--long] [--json]
```

Lista as changes ativas (fora do archive). Por padrão imprime só os nomes.

- `--long` — mostra também o status, o título (extraído do `proposal.md`) e o progresso de tarefas, ex.: `add-login (proposed): Login com OAuth [tarefas 1/3]`.
- `--specs` — lista as specs do projeto (`agentic-fy/specs/*.md`) em vez das changes.
- `--json` — saída estruturada, útil para scripts e agentes.

## show

```bash
agentic-fy show <nome> [--artifact <id>] [--spec <id>] [--json]
```

Mostra uma change. Sem flags, exibe um resumo: status, título, progresso de tarefas e quais artefatos existem.

- `--artifact <proposal|design|tasks>` — imprime o conteúdo cru daquele artefato.
- `--spec <id>` — imprime o conteúdo de uma spec do projeto (`agentic-fy/specs/<id>.md`); independe da change.
- `--json` — resumo estruturado da change.

Se o nome não bater com nenhuma change, o comando sugere os nomes mais próximos ("você quis dizer?").

## validate

```bash
agentic-fy validate [nome] [--all] [--strict] [--json]
```

Valida os artefatos de uma change e reporta problemas com nível `ERROR`, `WARNING` ou `INFO`. Diferente do `verify` (que só confere presença e checkboxes), o `validate` detecta artefatos que *parecem* prontos mas não estão:

- artefato ausente (`ERROR`);
- artefato ainda idêntico ao template, ou seja, não preenchido (`WARNING`);
- artefato praticamente vazio (`WARNING`);
- `tasks.md` com itens de lista mas nenhum checkbox de verdade (`ERROR`);
- tarefas ainda pendentes (`INFO`).

Opções:
- `--all` — valida todas as changes ativas.
- `--strict` — trata `WARNING` como falha (afeta o código de saída).
- `--json` — saída estruturada (um relatório, ou um array com `--all`).

Se `nome` for omitido e houver exatamente uma change ativa, ela é usada. O código de saída é `1` quando alguma change é inválida.

## status

```bash
agentic-fy status [--json]
```

Panorama das changes ativas: quantas existem, em que estágio estão e quanto falta. Para cada change mostra o status, o progresso de tarefas e um resumo de problemas (`ok`, `N aviso(s)` ou `N erro(s)`, vindos da mesma checagem do `validate`). Útil como visão geral antes de decidir no que trabalhar.

## config

```bash
agentic-fy config show [--json]
agentic-fy config set <chave> <valor>
```

Lê ou edita o `agentic-fy.config.yaml`.

- `config show` — mostra `version`, `schema` e o `workflow`.
- `config set <chave> <valor>` — altera um valor. Chaves editáveis: `version` (inteiro positivo) e `schema`. O valor é validado pelo schema antes de gravar, então nunca se escreve uma config inválida.

## doctor

```bash
agentic-fy doctor [--json]
```

Verifica a integridade do projeto (somente leitura, não repara nada):

- `agentic-fy.config.yaml` existe e é válido;
- diretórios em `changes/` sem `.agentic-fy.yaml` (não são changes válidas) — `WARNING`;
- changes com metadata ilegível — `ERROR`;
- erros estruturais dos artefatos (ex.: `tasks.md` sem checkbox) — `ERROR`.

O código de saída é `1` quando há algum `ERROR`. Diferente do `validate` (focado no preenchimento de uma change), o `doctor` olha a consistência do projeto inteiro.

## context

```bash
agentic-fy context [--json]
```

Reúne num só lugar o contexto do projeto: config (schema e workflow), as changes ativas com estágio e progresso, e as specs do projeto. Pensado para alimentar um agente de IA com o estado inteiro de uma vez. Em texto sai como um brief legível; com `--json`, estruturado.

## completion

```bash
agentic-fy completion [shell]
```

Imprime no stdout um script de autocompletar para o shell (`powershell`, `bash` ou `zsh`). Se o shell não for informado, tenta detectar pelo ambiente. Não instala nada automaticamente — você redireciona para onde preferir:

```bash
agentic-fy completion bash >> ~/.bashrc     # Bash
agentic-fy completion zsh  >> ~/.zshrc      # Zsh
agentic-fy completion powershell            # PowerShell: cole no seu $PROFILE
```

## view

```bash
agentic-fy view [--static] [--json]
```

Dashboard de specs e changes. Mostra um resumo (contagem de changes/specs e progresso total de tarefas) e agrupa as changes por estágio: rascunhos (`exploring`/`proposed`), em andamento (`applying`, com barra de progresso) e prontas (`verified`).

Modos:
- **Interativo** (padrão, quando há terminal): além do painel, lista os itens numerados; digite o número para abrir o detalhe de uma change ou o conteúdo de uma spec, `r` para atualizar e `q` para sair.
- `--static` — imprime o painel uma vez e sai (sem navegação). É o modo usado automaticamente quando não há terminal interativo (ex.: pipes, CI).
- `--json` — devolve os dados do dashboard estruturados.

## mcp

```bash
agentic-fy mcp
```

Inicia o servidor MCP (Model Context Protocol) via stdio, expondo os comandos como ferramentas consumíveis por um agente de IA. Ferramentas registradas: `explore`, `propose`, `apply`, `verify`, `archive`, `list`, `show`, `validate`, `status`, `context`.

### Conectar ao Kiro

Crie (ou edite) o arquivo de configuração MCP do Kiro:
- Workspace (só este projeto): `.kiro/settings/mcp.json`
- Usuário (todos os projetos): `~/.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "agentic-fy": {
      "command": "npx",
      "args": ["-y", "agentic-fy", "mcp"],
      "disabled": false,
      "autoApprove": ["explore"]
    }
  }
}
```

Se o `agentic-fy` estiver instalado globalmente, você pode usar o binário direto:

```json
{
  "mcpServers": {
    "agentic-fy": {
      "command": "agentic-fy",
      "args": ["mcp"],
      "disabled": false,
      "autoApprove": ["explore"]
    }
  }
}
```

`autoApprove: ["explore"]` deixa a ferramenta de leitura rodar sem confirmação; as demais de leitura (`list`, `show`, `validate`, `status`, `context`) também podem ser incluídas. As que escrevem (`propose`, `apply`, `archive`) continuam pedindo aprovação.

### Conectar a outros editores

Editores baseados em VS Code com suporte a MCP usam o mesmo formato, mudando o arquivo:
- **Cursor**: `.cursor/mcp.json`
- **GitHub Copilot (VS Code)**: `.vscode/mcp.json` (usa a chave `servers` em vez de `mcpServers`)
