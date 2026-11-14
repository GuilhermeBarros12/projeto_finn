---
name: registrar-commit
description: Gera o registro de uma entrega em docs/commits/<slug>.txt a partir das alterações pendentes, no formato usado pelo Finn. Use quando o usuário pedir para preparar, documentar ou registrar um commit.
---

# Registrar commit

Esta skill só cria o arquivo de registro. Não faça `git add`, commit nem push sem pedido explícito.

## Passos

1. Leia `git status --short` e `git diff --stat`. Abra apenas os diffs necessários para entender a
   entrega, sem lockfiles nem arquivos gerados.
2. Se as alterações misturam assuntos sem relação, proponha dividi-las antes de escrever.
3. Defina o slug no formato `<tipo>-<area>-<descricao-curta>`, em minúsculas e sem acentos. Tipos em
   uso: `feat`, `fix`, `chore`.
4. Confirme que `docs/commits/<slug>.txt` não existe e crie o arquivo.

## Formato

Texto simples, sem Markdown além dos hífens. Omita as seções que não se aplicam.

```text
Título do commit
<slug>

Resumo
<uma ou duas frases sobre o que muda e por quê>

Dependências adicionadas
- <pacote>: <para que serve>

Arquivos criados
- <caminho>: <o que faz>

Arquivos alterados
- <caminho>: <o que mudou>

Arquivos removidos
- <caminho>: <por que saiu>

Regras preservadas
- <regra de negócio que continua valendo>

Validação executada
- <comando>: <resultado>
```

Em "Validação executada", liste somente comandos que rodaram de fato. Se a skill
`verificar-alteracao` ainda não rodou, execute-a antes ou registre o que ficou sem verificação.

Ao terminar, mostre o caminho do arquivo e o slug para ser usado como mensagem do commit.
