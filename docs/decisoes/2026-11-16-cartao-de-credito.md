# Cartão de crédito: faturas, parcelamento e recorrência

Data: 2026-11-16. Decidido em sabatina com o dono do produto. O passo a passo de implementação está
em [`docs/planos/cartao-de-credito.md`](../planos/cartao-de-credito.md).

## Problema

Hoje cartão de crédito é só um valor de `paymentMethod` (`CREDIT_CARD`). Não existe cartão,
fechamento, vencimento, fatura nem parcela, e tudo é agregado pela data da compra. A pessoa não
consegue ver quanto vai pagar na fatura do mês que vem.

## Decisões

| #   | Decisão                   | Escolha                                                                                                                                                                  | Motivo                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Cartões                   | Vários por usuário, cada um com nome, dia de fechamento e dia de vencimento                                                                                              | Fechamento e vencimento são de cada cartão                        |
| 1b  | Cartão padrão             | Um por usuário, pré-selecionado ao lançar no crédito. O primeiro cartão vira padrão. Um botão troca o padrão. Ao desativar o padrão, o cartão ativo mais antigo assume   | A pessoa costuma lançar sempre no mesmo cartão                    |
| 2   | Dia do fechamento         | Compra feita no próprio dia do fechamento entra na fatura seguinte                                                                                                       | Regra comum dos bancos                                            |
| 3   | Dashboard                 | Continua agregando pela data de cada lançamento                                                                                                                          | Não quebra totais, metas nem exportação                           |
| 4   | Parcelamento              | Uma compra em N vezes vira N transações reais, criadas na hora, ligadas por `installmentGroupId`                                                                         | Dashboard, filtros, exportação e assistente já usam `Transaction` |
| 5   | Recorrência               | Vale para qualquer lançamento (receita, conta ou cartão). Só mensal                                                                                                      | É propriedade do lançamento, não do cartão                        |
| 6   | Dados antigos             | A migration cria um "Cartão principal" (fecha dia 1, vence dia 10, padrão) para cada usuário com lançamentos `CREDIT_CARD` e liga esses lançamentos a ele                | Preserva o histórico                                              |
| 7   | Ajuste das datas          | A página Cartões permite editar nome, fechamento e vencimento. Cartões migrados mostram um aviso até a pessoa confirmar as datas                                         | As datas padrão do item 6 são um chute                            |
| 8   | Valor do parcelamento     | Dois modos no formulário: valor total dividido em parcelas iguais, ou valor da parcela e quantidade. No modo total, o centavo que sobra vai para a primeira parcela      | A soma das parcelas fecha exatamente no total                     |
| 9   | Dashboard e parcelas      | Cada mês mostra só a parcela daquele mês                                                                                                                                 | Consequência do item 4                                            |
| 10  | Data das parcelas         | A parcela K cai no mesmo dia da compra, K meses depois. Meses sem aquele dia usam o último dia do mês (31/01 → 28/02 → 31/03)                                            | Cada parcela cai na fatura certa pelas regras do item 2           |
| 11  | Fatura                    | Calculada na hora a partir dos lançamentos e das datas do cartão. Não existe tabela de faturas                                                                           | Sem estado para dessincronizar, e funciona para meses futuros     |
| 12  | Pagamento da fatura       | Fora desta versão: só se vê valor, período e vencimento                                                                                                                  | Marcar como paga exige resolver dupla contagem                    |
| 13  | Geração da recorrência    | Na criação, gera até 12 meses (ou até a data final opcional). O app avisa quando faltam 2 meses para acabar uma recorrência sem data final e oferece renovar por mais 12 | O Cloud Run não tem cron confiável                                |
| 14  | Editar ou apagar em grupo | "Só este" ou "este e os seguintes". Não existe "todos"                                                                                                                   | "Todos" mexeria em parcelas já pagas                              |
| 15  | Parcelado e recorrente    | Um exclui o outro. O formulário oferece à vista, parcelado ou recorrente                                                                                                 | São lógicas diferentes                                            |
| 16  | Calendário                | Componente próprio, com navegação por mês e ano e dias da semana, sem dependência nova. Substitui o `type="date"` dos lançamentos e das metas                            | O seletor nativo muda em cada navegador                           |
| 17  | Tela                      | Página nova "Cartões": lista com a fatura atual e a próxima de cada cartão, e um detalhe navegável por mês com os lançamentos da fatura                                  | Responde "quanto vai ser a fatura do mês que vem"                 |
| 18  | Limite do cartão          | Fora desta versão                                                                                                                                                        | Pede definir o que conta como usado                               |
| 19  | Assistente                | Ganha ferramentas de leitura de cartões e faturas, reaproveitando o serviço de faturas                                                                                   | O assistente passa a responder sobre o cartão                     |
| 20  | Formulário de lançamento  | Um só. Ao escolher cartão aparecem o cartão (padrão marcado) e o modo. Lançamentos fora do cartão continuam iguais, com a opção de recorrência                           | A pessoa não precisa escolher onde lançar                         |
| 21  | Metas de limite de gasto  | Passam a contar cada parcela no mês dela                                                                                                                                 | Coerência com o dashboard                                         |

## Regras de calendário

- **Vencimento:** é a primeira data com o dia de vencimento depois da data de fechamento. Fecha dia
  25 e vence dia 5: a fatura que fecha em 25/03 vence em 05/04. Fecha dia 20 e vence dia 28: a que
  fecha em 20/03 vence em 28/03.
- **Meses curtos:** um dia que não existe no mês vira o último dia do mês. Fechamento no dia 31
  fecha em 28/02 (ou 29/02 em ano bissexto).

## Decisões tomadas no plano

Estas foram escolhidas ao escrever o plano, fora da sabatina, e confirmadas pelo dono do produto
em 2026-11-16:

- **Nome da fatura:** é o mês do vencimento. "Fatura de abril" é a que vence em abril.
- **Fechamento e vencimento no mesmo dia** são recusados no cadastro.
- **Parcelamento:** de 2 a 48 parcelas, e só para despesa no cartão de crédito.
- **Lançamento no crédito sem `cardId`:** a API usa o cartão padrão, e responde 422 se não houver
  cartão ativo.
- **Data em "este e os seguintes":** não pode ser alterada. Para mudar a data, edite só uma
  parcela.
- **Converter lançamento:** um lançamento à vista não vira parcelado ou recorrente na edição. Apague
  e lance de novo.

## Fora desta versão

Limite do cartão, pagamento ou status de "paga" da fatura, recorrência semanal ou anual, reativar
cartão desativado, mostrar a fatura de cada parcela no preview do formulário e colunas de cartão na
exportação.
