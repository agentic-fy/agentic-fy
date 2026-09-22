# Conceitos

Esta é a explicação longa das ideias por trás do agentic-fy. Para a versão de uma página, veja [Conceitos essenciais](overview.md).

## O problema que o agentic-fy resolve

Quando você trabalha com um assistente de IA, é fácil pedir algo vago e ver a IA construir, com confiança, a coisa errada. O agentic-fy insere uma camada leve de acordo: você e a IA escrevem e revisam um plano curto antes que o código seja escrito. O plano vive no repositório, ao lado do código, então continua útil meses depois.

## Change

Uma **change** é a unidade central de trabalho. Sempre que você quer adicionar, modificar ou remover comportamento, cria uma change com `agentic-fy propose <nome>`. Cada change é uma pasta em `agentic-fy/changes/<nome>/` que reúne tudo sobre aquele trabalho:

```
agentic-fy/changes/add-dark-mode/
├── proposal.md         # por quê e o quê
├── design.md           # como
├── tasks.md            # passos
├── specs/
│   └── spec.md         # requisitos e critérios de aceite
└── .agentic-fy.yaml       # metadata: nome, status, datas
```

O nome que você passa é normalizado para um slug seguro em disco: `"Add Dark Mode"` vira `add-dark-mode`.

## Artefatos

Cada change contém quatro tipos de artefato, criados numa ordem natural em que cada um alimenta o próximo:

| Artefato | Pergunta que responde |
|----------|-----------------------|
| `proposal.md` | Por que fazer isso e o que muda? |
| `specs/spec.md` | Quais são os requisitos e critérios de aceite? |
| `design.md` | Como isso será construído? |
| `tasks.md` | Quais são os passos concretos de implementação? |

```
proposal ──► specs ──► design ──► tasks ──► implementar
   por quê     o quê      como      passos      fazer
```

O `propose` gera esses arquivos a partir de templates. A partir daí, você (ou a IA) os preenche com o conteúdo real. O `tasks.md` usa checkboxes de Markdown (`- [ ]` / `- [x]`), que o agentic-fy entende para acompanhar o progresso.

### Facilitadores, não portões

A ordem dos artefatos mostra o que se torna *possível* em seguida, não o que você é *obrigado* a fazer. Se durante a implementação você descobre que o design estava errado, edite `design.md` e siga. Nada trava. As dependências existem só para dar contexto — não para prender você num processo em cascata.

## Status e ciclo de vida

Cada change carrega um `status` no seu `.agentic-fy.yaml`, que percorre o workflow:

```
exploring ──► proposed ──► applying ──► verified ──► archived
```

- **exploring** — estado inicial de uma change recém-criada.
- **proposed** — após `propose`, com os artefatos rascunhados.
- **applying** — após `apply`, enquanto você implementa as tarefas.
- **verified** — após `verify` passar (todos os artefatos presentes e todas as tarefas concluídas).
- **archived** — após `archive`, com a change movida para o histórico.

Os comandos avançam esse status conforme você progride. O `verify` só promove para `verified` quando as condições são satisfeitas; caso contrário, ele aponta o que falta e mantém o status atual.

## Arquivamento

Quando o trabalho termina, `agentic-fy archive` move a pasta da change para `agentic-fy/changes/archive/<nome>/` e marca o status como `archived`. O histórico fica preservado ali — Markdown simples que continua legível mesmo sem o agentic-fy. Assim você fecha o ciclo e libera o espaço de trabalho para a próxima change.

## O modelo: CLI + agente

Um ponto importante e honesto: **o agentic-fy não contém um modelo de IA.** Ele não faz chamadas a nenhum provedor de LLM. O CLI é a ferramenta que cria e acompanha os artefatos e o status; a inteligência que lê o design, escreve o código e marca as tarefas vem do **agente de IA** que usa a ferramenta.

Há dois modos de uso:

1. **Manual (terminal).** Você roda os comandos, edita os artefatos à mão e implementa o código você mesmo.
2. **Assistido (MCP).** Você inicia `agentic-fy mcp` e conecta um assistente de IA compatível com MCP (como o Kiro). O agente passa a usar as ferramentas `explore/propose/apply/verify/archive` e conduz o fluxo, escrevendo o código e marcando as tarefas.

Esse desenho — CLI como ferramenta, agente como cérebro — mantém o agentic-fy leve, sem custo de LLM embutido e sem depender de nenhum provedor específico. Veja [Comandos](commands.md#mcp) para conectar o servidor MCP ao seu editor.

## Config do projeto

O `agentic-fy.config.yaml`, criado pelo `init`, guarda a configuração base do projeto:

```yaml
version: 1
schema: spec-driven
workflow:
  - explore
  - propose
  - apply
  - verify
  - archive
```

Ele é lido para resolver a raiz do projeto (o agentic-fy sobe na árvore de diretórios procurando esse arquivo) e para conhecer o workflow ativo.

## Para onde ir agora

- [Primeiros passos](getting-started.md) — a primeira change por inteiro.
- [Conceitos essenciais](overview.md) — o modelo mental numa página.
- [Comandos](commands.md) — referência de todos os comandos.
