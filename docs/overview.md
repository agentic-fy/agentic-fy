# Conceitos essenciais

**O agentic é uma camada leve de acordo entre você e sua IA.** Você escreve o que uma mudança deve fazer, a IA rascunha os detalhes, vocês dois olham para o mesmo plano, e só então o código é escrito. Esta página é o modelo mental inteiro numa tela. Para a versão longa, veja [Conceitos](concepts.md).

A ideia toda em quatro palavras: **concorde primeiro, construa depois.**

## As quatro ideias

Tudo no agentic é construído a partir de quatro conceitos. Aprenda estes e o resto é detalhe.

**1. Uma change é uma unidade de trabalho.** Quando você quer adicionar, modificar ou remover comportamento, cria uma change: uma pasta em `agentic/changes/` que guarda tudo sobre aquele trabalho num só lugar — proposta, design, lista de tarefas e specs. Uma change, uma pasta, uma feature.

**2. Os artefatos se apoiam uns nos outros.** Uma change contém alguns documentos, criados numa ordem natural, cada um alimentando o próximo:

```text
proposal ──► specs ──► design ──► tasks ──► implementar
  por quê     o quê      como      passos      fazer
```

Você pode revisitar qualquer um deles a qualquer momento. Eles são facilitadores, não portões. (Mais sobre isso abaixo.)

**3. O status acompanha o ciclo de vida.** Cada change tem um status que percorre o workflow: `exploring → proposed → applying → verified → archived`. Os comandos avançam esse status conforme você progride.

**4. Arquivar fecha o ciclo.** Quando o trabalho termina, você arquiva a change. A pasta dela vai para `agentic/changes/archive/`, preservando o histórico. Agora você está pronto para a próxima change.

## A estrutura

```text
┌─────────────────────────────────────────────────────────────┐
│                        agentic/                             │
│                                                             │
│   ┌──────────────────┐      ┌──────────────────────────┐   │
│   │      specs/      │      │        changes/          │   │
│   │                  │      │                          │   │
│   │ specs do projeto │      │ uma pasta por change     │   │
│   │                  │      │ proposal · design ·      │   │
│   │                  │      │ tasks · specs · archive/ │   │
│   └──────────────────┘      └──────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Duas pastas. `specs/` guarda specs de projeto; `changes/` é o que você está propondo e construindo. Arquivar move uma change concluída para `changes/archive/`.

## O loop que você vai rodar

No dia a dia, seu fluxo é assim. Opcionalmente pense primeiro; então um comando rascunha o plano, você lê, o próximo acompanha a construção, e o último arquiva.

```text
agentic explore                   →  (opcional) pense junto com a IA primeiro
agentic propose add-dark-mode     →  rascunha proposal, specs, design, tasks
        (você lê e ajusta o plano)
agentic apply                     →  acompanha as tarefas a implementar
agentic verify                    →  confere artefatos e tarefas concluídas
agentic archive                   →  change arquivada
```

**Na dúvida, comece explorando.** `explore` é um parceiro de raciocínio sem compromisso. Já sabe exatamente o que quer? Pule direto para `propose`.

Esses comandos rodam no terminal. Para deixar seu assistente de IA conduzir o fluxo, conecte o servidor MCP (`agentic mcp`) — veja [Comandos](commands.md#mcp).

## "Facilitadores, não portões"

Processos de spec à moda antiga são cascatas: termine o planejamento, *então* você pode implementar, e voltar atrás é doloroso. O agentic recusa isso. A ordem `proposal → specs → design → tasks` mostra o que se torna *possível* em seguida, não o que você é *obrigado* a fazer.

Descobriu durante a implementação que o design estava errado? Edite `design.md` e siga. Percebeu que o escopo deveria diminuir? Atualize a proposta. Nada trava. As dependências existem só para dar à IA o contexto de que ela precisa, não para te prender.

O tradeoff é disciplina: como nada te empurra para frente, cabe a você manter uma change focada em vez de deixá-la crescer sem controle.

## Por que vale o pequeno overhead

Verdade nua: o agentic adiciona um passo. Você escreve um plano curto antes de construir. O que você ganha?

- **Você pega desvios antes que custem caro.** Corrigir um mal-entendido numa proposta de um parágrafo é de graça. Corrigir depois que a IA escreveu 400 linhas, não.
- **O plano e o código ficam no mesmo repositório.** Seis meses depois, a spec conta por que o sistema funciona do jeito que funciona.
- **Mudanças são revisáveis.** Uma pasta de change é um pacote organizado: leia a proposta, veja o design, confira as tarefas.

E o tradeoff honesto: para uma correção de uma linha, a cerimônia pode não compensar, e tudo bem. Use onde o acordo importa.

## Para onde ir agora

- Novo por aqui? [Primeiros passos](getting-started.md) percorre a primeira change por inteiro.
- Quer a versão profunda de tudo acima? [Conceitos](concepts.md).
- Referência de comandos? [Comandos](commands.md).
