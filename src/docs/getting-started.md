# Primeiros passos

Este guia explica como o agentic-fy funciona, da instalação à sua primeira mudança. Novo em toda a documentação? O [índice](README.md) mapeia tudo.

O agentic-fy é um CLI Node.js. Você precisa da versão 20.19.0 ou mais nova.

## Instalação

No seu terminal, confira o Node:

```bash
node --version
```

Se imprimir `v20.19.0` ou superior, você está pronto. Se não, instale um Node mais novo em nodejs.org ou por um gerenciador de versões (nvm, fnm, asdf, volta).

Instale o CLI globalmente:

```bash
npm install -g agentic-fy
```

Se você não puder instalar global (erro de permissão em `/usr/local`), rode direto sem instalar:

```bash
npx agentic-fy --version
```

### Confirme que funcionou

```bash
agentic-fy --version
```

Se imprimir o logo e um número de versão, o CLI está no seu PATH.

## Seus primeiros cinco minutos

O loop inteiro:

```text
$ npm install -g agentic-fy
$ cd seu-projeto && agentic-fy init
$ agentic-fy explore                    (opcional: pense primeiro)
$ agentic-fy propose add-dark-mode      (rascunha o plano; você revisa)
$ agentic-fy apply                      (acompanha as tarefas)
$ agentic-fy verify                     (confere se está pronto)
$ agentic-fy archive                    (change arquivada)
```

> **Não sabe ainda o que construir? Comece com `agentic-fy explore`.** É um parceiro de raciocínio sem compromisso: mostra o estado do projeto e as changes ativas, e ajuda a transformar uma ideia difusa num plano concreto antes de qualquer código.

## O que o agentic-fy cria

Depois de rodar `agentic-fy init`, seu projeto ganha esta estrutura:

```
agentic-fy.config.yaml     # configuração do projeto
agentic-fy/
├── specs/              # specs do projeto
├── changes/            # mudanças propostas (uma pasta por change)
│   └── archive/        # changes concluídas
```

O `init` cria a estrutura base de forma idempotente (rodar de novo não sobrescreve o `agentic-fy.config.yaml`) e também **configura a integração MCP da sua IDE**. No terminal ele pergunta para qual ferramenta configurar (Kiro, Cursor, GitHub Copilot, Claude Code, Windsurf) e escreve o `mcp.json` correspondente apontando para `agentic-fy mcp`. Para pular o prompt, use `--tools`:

```bash
agentic-fy init --tools kiro,cursor   # configura as ferramentas escolhidas
agentic-fy init --tools none          # só a estrutura base
```

O merge é não-destrutivo: se você já tem um `mcp.json`, o agentic-fy só adiciona o próprio servidor sem apagar o resto. Veja [Comandos](commands.md#init) para os detalhes.

Quando você cria uma change com `propose`, ela fica assim:

```
agentic-fy/changes/<nome-da-change>/
├── proposal.md
├── design.md
├── tasks.md
├── specs/
│   └── spec.md
└── .agentic-fy.yaml       # metadata (nome, status, datas)
```

## Entendendo os artefatos

Cada pasta de change contém artefatos que guiam o trabalho:

| Artefato | Propósito |
|----------|-----------|
| `proposal.md` | O "por quê" e o "o quê" — intenção, escopo e abordagem |
| `specs/spec.md` | Requisitos e critérios de aceite |
| `design.md` | O "como" — abordagem técnica e decisões de arquitetura |
| `tasks.md` | Checklist de implementação com checkboxes |

Os artefatos se apoiam uns nos outros:

```
proposal ──► specs ──► design ──► tasks ──► implementar
   ▲           ▲          ▲                    │
   └───────────┴──────────┴────────────────────┘
              atualize conforme aprende
```

Você sempre pode voltar e refinar artefatos anteriores à medida que aprende durante a implementação.

## Exemplo: sua primeira change

Vamos adicionar dark mode a uma aplicação.

### 1. Inicialize o projeto

```bash
cd seu-projeto
agentic-fy init
```

### 2. Crie a change

```text
$ agentic-fy propose add-dark-mode

[propose] add-dark-mode
Criado: proposal.md
Criado: design.md
Criado: tasks.md
Criado: specs/spec.md
```

### 3. Preencha os artefatos

Edite os arquivos em `agentic-fy/changes/add-dark-mode/`:
- `proposal.md` — por que e o que muda.
- `design.md` — como fazer.
- `tasks.md` — marque as tarefas reais, por exemplo:

```markdown
# Tarefas — add-dark-mode

- [ ] 1. Criar ThemeContext com estado light/dark
- [ ] 2. Adicionar toggle de tema nas configurações
- [ ] 3. Persistir a preferência no localStorage
```

### 4. Acompanhe a implementação

```text
$ agentic-fy apply

[apply] add-dark-mode
Aplicando a change "add-dark-mode".
Tarefas: 0 concluídas, 3 pendentes.
  [ ] 1. Criar ThemeContext com estado light/dark
  [ ] 2. Adicionar toggle de tema nas configurações
  [ ] 3. Persistir a preferência no localStorage
```

Implemente as tarefas e marque-as como `[x]` no `tasks.md` conforme conclui.

### 5. Verifique

```text
$ agentic-fy verify

[verify] add-dark-mode
Todos os artefatos presentes (proposal, design, tasks).
Todas as tarefas marcadas como concluídas.
Status atualizado para "verified".
```

O `verify` só marca como concluído quando todos os artefatos existem e todas as tarefas estão marcadas.

### 6. Arquive

```text
$ agentic-fy archive

[archive] add-dark-mode
Change "add-dark-mode" arquivada em agentic-fy/changes/archive/add-dark-mode.
```

## Deixando a IA conduzir (MCP)

Os comandos acima rodam no terminal. Para o seu assistente de IA conduzir o workflow, use o servidor MCP.

Se você escolheu uma ferramenta no `agentic-fy init` (ou passou `--tools`), o `mcp.json` da sua IDE já foi configurado — é só reiniciar/recarregar a IDE. Para configurar manualmente ou subir o servidor à mão:

```bash
agentic-fy mcp
```

Ele expõe as ferramentas `explore`, `propose`, `apply`, `verify`, `archive`, `list`, `show` e `validate` para qualquer agente compatível com MCP. Veja [Comandos](commands.md#mcp) para a configuração em editores como o Kiro.

## Próximos passos

- [Conceitos essenciais](overview.md) — o modelo mental numa página
- [Comandos](commands.md) — referência de todos os comandos
- [Conceitos](concepts.md) — entendimento profundo de specs, changes e archive
