# Documentação do agentic-fy

Bem-vindo. Este é o ponto de partida de tudo sobre o agentic-fy.

O agentic-fy ajuda você e seu assistente de IA a **concordarem sobre o que construir antes de escrever qualquer código.** Você descreve a mudança, a IA rascunha uma spec curta e uma lista de tarefas, vocês dois olham para o mesmo plano, e então o trabalho acontece. Sem descobrir no meio do caminho que a IA construiu a coisa errada.

Se você só for ler duas páginas, leia estas:

1. [Primeiros passos](getting-started.md): instalar, inicializar e entregar sua primeira mudança.
2. [Conceitos essenciais](overview.md): o modelo mental inteiro numa página.

O agentic-fy tem duas metades: uma ferramenta de linha de comando que você roda no terminal, e um servidor MCP que expõe o workflow como ferramentas para o seu assistente de IA. Saber qual é qual evita o ponto de confusão mais comum.

> **O melhor hábito para começar: quando não souber o que construir, comece com `explore`.** É um parceiro de raciocínio sem compromisso, que lê seu código, pesa opções e transforma uma ideia difusa em um plano concreto antes de qualquer código ser escrito.

## Escolha seu caminho

**Sou novo aqui.** Comece por [Primeiros passos](getting-started.md), depois passe os olhos nos [Conceitos essenciais](overview.md).

**Tenho um problema, mas não um plano.** Use `explore` para pensar junto com a IA antes de se comprometer com qualquer coisa.

**Só quero pôr pra funcionar.** [Instale](getting-started.md#instalacao), rode `agentic-fy init`, e conecte o servidor MCP ao seu assistente (veja [Comandos](commands.md#mcp)).

**Aprendo por referência de comandos.** A página de [Comandos](commands.md) documenta cada comando do CLI.

**Quero entender a fundo.** [Conceitos](concepts.md) traz a explicação longa de specs, changes, artefatos e arquivamento.

## O mapa completo

### Comece por aqui

| Doc | O que oferece |
|-----|----------------|
| [Primeiros passos](getting-started.md) | Instalar, inicializar e rodar sua primeira mudança de ponta a ponta |
| [Conceitos essenciais](overview.md) | O modelo mental inteiro numa página: specs, changes, artefatos, archive |
| [Comandos](commands.md) | Referência de cada comando do CLI `agentic-fy` |

### Entenda a fundo

| Doc | O que oferece |
|-----|----------------|
| [Conceitos](concepts.md) | A explicação longa de specs, changes, artefatos e arquivamento |

## A versão de trinta segundos

```text
1. Instalar       npm install -g agentic-fy
2. Inicializar    cd seu-projeto && agentic-fy init
3. Explorar       agentic-fy explore                 ← opcional, mas um ótimo hábito
4. Propor         agentic-fy propose add-dark-mode
5. Aplicar        agentic-fy apply
6. Verificar      agentic-fy verify
7. Arquivar       agentic-fy archive
```

Os comandos rodam no seu terminal. Para deixar o assistente de IA conduzir o fluxo sozinho, conecte o servidor MCP (`agentic-fy mcp`) — veja [Comandos](commands.md#mcp).

## Onde conseguir ajuda

- **npm:** [agentic-fy](https://www.npmjs.com/package/agentic-fy)

Encontrou algo nesta doc que está errado, desatualizado ou confuso? Isso é um bug. Abra uma issue ou um PR.
