# Prompt para o Lovable — Módulo de Modelagem Financeira de Incorporação

> Versão revisada. Copie tudo abaixo da linha e cole no Lovable. Se o projeto for grande,
> envie por etapas usando os blocos marcados como **ETAPA 1**, **ETAPA 2** etc.

---

## Contexto

Estou construindo um sistema para gestão de projetos de incorporação imobiliária nos
Estados Unidos. Preciso adicionar um **módulo de Modelagem Financeira**: uma área onde eu
cadastro as premissas de um empreendimento e o sistema gera a modelagem completa —
fluxo de caixa mês a mês, curva de financiamento, apuração de resultado, rateio entre
sócios e indicadores de retorno.

O módulo precisa ser **determinístico e auditável**: dados os mesmos inputs, sempre o
mesmo output, e cada número precisa ser rastreável até a linha que o originou.

---

## ETAPA 1 — Arquitetura e modelo de dados

### Tabelas

**`projects`**
`id`, `org_id`, `name`, `location`, `use_type`, `currency` (default `USD`),
`start_date` (data do mês 1), `months_approval`, `months_construction`,
`months_post_construction`, `max_horizon` (default 60), `base_date`, `revision`,
`status`, `created_at`, `updated_at`

**`project_units`** — uma linha por unidade
`id`, `project_id`, `sort_order`, `name`, `city`, `area_sf`, `land_cost`,
`construction_cost`, `base_equity` (aporte base da unidade), `sale_price`,
`property_tax_year`, `notes`

**`project_costs`** — custos que não pertencem a uma unidade específica
`id`, `project_id`, `label` (ex.: "Contingência"), `amount`,
`distribution` (`single_month` | `linear_total` | `linear_construction` | `manual`),
`anchor_month` (obrigatório quando `single_month`, ignorado nos demais)

**`project_financing`**
`id`, `project_id`, `annual_rate`, `structuring_fee_pct`, `fee_timing`
(`first_draw` | `contract_month`), `fee_month` (obrigatório quando
`fee_timing = contract_month`), `draw_start_month`, `draw_end_month`,
`draw_mode` (`equity_first` | `cash_demand` | `manual`), `max_ltc_pct` (nullable),
`contracted_amount` (nullable; se nulo usa `max_ltc_pct`; se ambos nulos, sem teto),
`finance_costs_in_demand` (boolean, default false — ver ETAPA 2, modo `cash_demand`),
`amortization_mode` (`at_exit` | `manual`), `capitalize_interest` (boolean, default false),
`min_cash_buffer` (default 0)

**`project_partners`**
`id`, `project_id`, `name`, `share_pct`, `is_available_quota` (boolean),
`notes`
`is_available_quota = true` marca uma cota ainda **não colocada**. Ela continua entrando
no rateio pro-rata normalmente (o sponsor a carrega); a flag serve só para destacar na
interface quanto do capital ainda está por captar. Nunca a exclua do cálculo.

**`project_revenue`**
`id`, `project_id`, `commission_pct`, `closing_costs_pct`,
`sale_mode` (`single_exit` | `per_unit` | `manual`), `exit_month`,
`investor_profit_share`, `sponsor_profit_share`
Constraint: `investor_profit_share + sponsor_profit_share = 1` (tolerância 1e-9).

**`project_unit_sales`** — usada quando `sale_mode = per_unit`
`id`, `project_id`, `unit_id`, `sale_month`

**`project_scenarios`**
`id`, `project_id`, `name`, `is_baseline`, `input_snapshot` (jsonb), `created_at`
Todo projeto nasce com um cenário `is_baseline = true`. Não existe override sem cenário.

**`project_overrides`** — o coração da edição manual
`id`, `project_id`, `scenario_id` (NOT NULL), `month_index` (1..N), `line_key`,
`value` (numeric, **nullable**), `is_cleared` (boolean, default false),
`created_at`, `created_by`
`line_key` ∈ `land`, `construction`, `property_tax`, `other_costs`, `revenue`,
`draw`, `amortization`, `equity_call`, `distribution`
Chave única: (`project_id`, `scenario_id`, `month_index`, `line_key`)

Sobre `value` e `is_cleared`: `value = 0` significa "forcei este mês a zero", que é
diferente de "este mês está vazio". `is_cleared = true` força a célula a **vazio**,
ignorando `value`. Sem essa distinção o princípio "vazio ≠ zero" não é representável no
banco.

RLS: tudo filtrado por `org_id` via join em `projects`.

---

## ETAPA 2 — Motor de cálculo

Esta é a parte mais importante. Implemente exatamente nesta ordem.

### Convenções que valem para o motor inteiro

- **Ponto flutuante pleno, sempre.** Nada de centavos inteiros, nada de arredondamento
  intermediário. Arredonde só na exibição e na exportação.
- **`data(m) = start_date + (m − 1) meses`**, com soma segura de fim de mês (31/01 + 1 mês
  = 28 ou 29/02, nunca 03/03) e datas tratadas em UTC, sem fuso local.
- **Juros de mês cheio.** Não há pró-rata por dias: o saque do mês rende juros o mês
  inteiro, e o mês da amortização paga juros sobre o saldo *antes* de amortizar.
- **`saldo_abertura(m) = saldo_final(m − 1)`**, com `saldo_final(0) = 0`.
- **`caixa_abertura(m) = caixa_acumulado(m − 1)`**, com `caixa_acumulado(0) = 0`.

### Derivações de cronograma
```
prazo_total       = months_approval + months_construction + months_post_construction
mes_inicio_obra   = months_approval + 1
mes_fim_obra      = months_approval + months_construction
mes_saida         = exit_month ?? prazo_total
```
Todos os quadros mensais têm capacidade de `max_horizon` meses; meses acima de
`prazo_total` ficam vazios, não zerados.

### Agregados das unidades
```
terrenos_total      = Σ land_cost
obra_total          = Σ construction_cost
aporte_base         = Σ base_equity
vgv                 = Σ sale_price
tax_ano_total       = Σ property_tax_year
property_tax_total  = tax_ano_total / 12 × prazo_total
equity_disponivel_obra = max(0, aporte_base − terrenos_total)
```
O `max(0, …)` importa: se os aportes base não cobrirem nem os terrenos, o valor tem de
ficar em zero, senão a dívida do modo `equity_first` começa maior que a obra acumulada.

Deixe explícito na interface que **`aporte_base` não é o aporte real**. Ele só dimensiona
a curva do modo `equity_first`. O aporte efetivo é `equity_call`, calculado no loop, e
costuma ser bem diferente.

### Distribuição mensal dos pagamentos (linhas 1 a 4)
Se existir override para (mês, linha), o override vence sempre. Caso contrário:
```
land(m)         = m == 1 ? terrenos_total : 0
construction(m) = mes_inicio_obra ≤ m ≤ mes_fim_obra ? obra_total / months_construction : 0
property_tax(m) = m ≤ prazo_total ? tax_ano_total / 12 : 0
other_costs(m)  = soma dos project_costs conforme sua distribution
                  linear_construction → amount / months_construction nos meses de obra
                  linear_total        → amount / prazo_total
                  single_month        → amount no anchor_month
                  manual              → apenas overrides
```

### Receita
```
sale_mode = single_exit → revenue(mes_saida) = vgv × (1 − commission_pct − closing_costs_pct)
sale_mode = per_unit    → para cada unidade, no seu sale_month,
                          sale_price × (1 − commission_pct − closing_costs_pct)
sale_mode = manual      → apenas overrides
```

### Estrutura de passes

O fee de estruturação depende do total sacado, que só é conhecido no fim do loop. E no
modo `cash_demand` o saque depende do caixa, que depende do custo financeiro, que depende
do saque. Resolva assim:

- **Passe 1 — saques.** Roda o loop mensal calculando `draw(m)`, juros e caixa com o fee
  ainda em zero. No modo `equity_first` um passe basta e ele já converge.
- **Passe 2 — fee e fechamento.** Com `divida_total_sacada` conhecida, lança o fee no mês
  devido e recalcula juros, custo financeiro, aportes, distribuição e caixa.
- **Iteração (só em `cash_demand`, ou quando `capitalize_interest = true`).** Repita os
  passes usando o custo financeiro do passe anterior como estimativa, até a variação de
  `divida_total_sacada` e do saldo final ficar abaixo de 0,01. Máximo 50 iterações; se não
  convergir, devolva o último resultado e acenda a conferência de convergência em âmbar.
  Nunca lance exceção.

Documente essa estrutura de passes no código, com o motivo de cada uma.

### Loop mensal — do mês 1 ao prazo_total

Para cada mês `m`, nesta sequência exata:

**1. Pagamentos operacionais**
`pagamentos_op(m) = land + construction + property_tax + other_costs`

**2. Saque do financiamento** — conforme `draw_mode`

O saque vem **antes** da amortização, porque no modo `at_exit` a amortização precisa
conhecer o saque do próprio mês. Para quebrar a dependência circular no modo
`cash_demand`, use dentro do cálculo do saque a estimativa
`amortizacao_prevista(m) = (amortization_mode == 'at_exit' && m == mes_saida) ? saldo_abertura(m) : 0`.

Em todos os modos, o saque é limitado pelo teto de dívida:
```
teto_divida  = contracted_amount ?? (max_ltc_pct × (terrenos_total + obra_total)) ?? +∞
capacidade(m) = max(0, teto_divida − Σ draw(1..m−1))
dentro_janela = draw_start_month ≤ m ≤ draw_end_month
```

- **`equity_first`** (regra clássica: o capital próprio entra primeiro na obra)
```
obra_acumulada(m) = Σ construction(1..m)
draw(m) = dentro_janela
          ? clamp(obra_acumulada(m) − equity_disponivel_obra, 0,
                  min(construction(m), capacidade(m)))
          : 0
```

- **`cash_demand`** (dimensiona a dívida pela necessidade real de caixa)
```
custo_fin_estimado(m) = finance_costs_in_demand ? custo_fin(m) do passe anterior : 0
demanda_bruta(m)      = pagamentos_op(m) + custo_fin_estimado(m) + amortizacao_prevista(m)
                        + min_cash_buffer − revenue(m) − caixa_abertura(m)
draw(m) = dentro_janela ? clamp(demanda_bruta(m), 0, capacidade(m)) : 0
```
`finance_costs_in_demand = false` (o default) dimensiona a dívida só pelos custos
operacionais e deixa juros e fee por conta do equity. `true` faz a dívida financiar também
o próprio custo financeiro — mais realista, um pouco mais caro, e é o caso que exige a
iteração descrita acima.

- **`manual`** → apenas overrides.

Override de `draw` sempre vence, em qualquer modo, inclusive acima do teto — nesse caso a
conferência de teto acende vermelho, mas o cálculo segue.

**3. Amortização**
```
amortization_mode = at_exit → alvo(m) = m == mes_saida ? saldo_abertura(m) + draw(m) : 0
amortization_mode = manual  → alvo(m) = override
amortization(m) = clamp(alvo(m), 0, saldo_abertura(m) + draw(m))
```
A trava do `clamp` impede saldo devedor negativo mesmo com override abusivo.

**4. Juros e taxas**
```
saldo_antes(m)  = saldo_abertura(m) + draw(m)
juros(m)        = saldo_antes(m) × (annual_rate / 12)
fee(m)          = fee_timing == 'first_draw'
                  ? (primeiro mês com draw > 0 ? divida_total_sacada × structuring_fee_pct : 0)
                  : (m == fee_month ? divida_total_sacada × structuring_fee_pct : 0)
custo_fin(m)    = juros(m) + fee(m)
saldo_final(m)  = saldo_antes(m) − amortization(m)
```
`divida_total_sacada` é a soma de todos os `draw` do projeto, conhecida a partir do passe 2.

Se `capitalize_interest = true`, some `juros(m)` ao `saldo_final(m)` em vez de pagá-lo em
caixa (`custo_fin(m)` passa a conter só o fee, e os juros viram principal) e itere até a
variação do saldo final ficar abaixo de 0,01.

**5. Pagamentos totais**
`pagamentos(m) = pagamentos_op(m) + custo_fin(m)`

**6. Aporte de equity**
```
equity_call(m) = max(0, pagamentos(m) + amortization(m) + min_cash_buffer
                        − draw(m) − revenue(m) − caixa_abertura(m))
```
A receita do mês **cobre** os custos do próprio mês. No mês da venda isso significa que
não há chamada de capital para pagar o property tax e os juros daquele mês — o dinheiro da
venda já está em caixa. Essa é a regra correta e é o que faz o modelo continuar coerente
quando a venda acontece no meio do cronograma.

Se houver override de `equity_call`, ele vence e o caixa absorve a diferença — inclusive
ficando negativo, o que deve disparar um alerta.

**7. Distribuição**
```
Automático → distribution(mes_saida) = equity_total + lucro_investidores
Manual     → override
```
`equity_total` é a soma de **todos** os `equity_call` do projeto, inclusive de meses
posteriores a `mes_saida`. Por isso a distribuição automática é lançada num passe final,
depois de o loop inteiro fechar. Se existir aporte depois do mês de saída, a conferência
de distribuição acende âmbar avisando que há capital aportado após a devolução.

O **lucro do sponsor não é distribuído**: ele permanece como caixa residual do projeto.
É isso que a conferência "caixa final = lucro do sponsor" verifica.

**8. Caixa**
```
caixa_mes(m)       = equity_call(m) + draw(m) + revenue(m)
                     − pagamentos(m) − amortization(m) − distribution(m)
caixa_acumulado(m) = caixa_acumulado(m−1) + caixa_mes(m)
```

### Apuração do resultado
```
receita_bruta      = vgv
comissoes          = vgv × commission_pct
cartorio           = vgv × closing_costs_pct
receita_liquida    = receita_bruta − comissoes − cartorio
custo_empreend     = Σ land + Σ construction + Σ property_tax + Σ other_costs
custo_financeiro   = Σ custo_fin
lucro_projeto      = receita_liquida − custo_empreend − custo_financeiro
lucro_investidores = lucro_projeto × investor_profit_share
lucro_sponsor      = lucro_projeto × sponsor_profit_share
equity_total       = Σ equity_call
divida_sacada      = Σ draw
divida_amortizada  = Σ amortization
total_distribuido  = equity_total + lucro_investidores
```

**Não** calcule o lucro como "receita líquida menos quitação da dívida menos devolução do
equity". Essa forma só funciona quando fontes e usos fecham exatamente e quebra no modo
manual. Use sempre a apuração acima.

### Indicadores
```
moic         = equity_total > 0 ? total_distribuido / equity_total : null
roi          = equity_total > 0 ? lucro_investidores / equity_total : null
margem_vgv   = vgv > 0 ? lucro_projeto / vgv : null
ltc          = divida_sacada / (terrenos_total + obra_total)
alavancagem  = divida_sacada / total_pagamentos
custo_total_divida_pct = divida_sacada > 0 ? custo_financeiro / divida_sacada : null
```
`custo_total_divida_pct` é o custo **acumulado ao longo de toda a operação** dividido pelo
principal sacado — não é uma taxa anual. Rotule na interface como "custo total da dívida
sobre o valor sacado", nunca como "taxa efetiva", senão será lido como se fosse a.a.

**TIR** — sobre o fluxo do investidor: `fluxo(m) = distribution(m) − equity_call(m)`.
Use bisseção sobre a taxa mensal no intervalo [−0,99 ; 1,0], 200 iterações; converta com
`(1 + i_mensal)^12 − 1`. Antes de iterar, verifique **duas** condições e retorne `null` se
qualquer uma falhar:
1. o fluxo tem pelo menos uma mudança de sinal;
2. `VPL(−0,99)` e `VPL(1,0)` têm sinais opostos.

A condição 2 é a que realmente garante a bisseção. Sem ela, um projeto com TIR acima de
100% ao mês devolve um número inventado em vez de `null`. Quando o retorno for `null`,
mostre "n/d" na interface — nunca `NaN` nem `0`.

Ofereça também **XIRR** com as datas reais como indicador secundário, em base actual/365.

### Rateio por sócio
Todos os sócios são pro-rata:
```
capital(s)   = share_pct(s) × equity_total
lucro(s)     = share_pct(s) × lucro_investidores
total(s)     = capital(s) + lucro(s)
chamada(s,m) = share_pct(s) × equity_call(m)
```
MOIC, ROI e TIR são idênticos para todos os sócios — exiba isso explicitamente, com uma
nota de que o que varia é apenas a escala.

### Resultado por unidade
A apuração por unidade exige uma regra de rateio dos custos que não pertencem a nenhuma
unidade (`project_costs`, juros e fee). Use **pro-rata pelo custo direto da unidade**
(`land_cost + construction_cost` sobre `terrenos_total + obra_total`) e deixe a regra
visível num rodapé da tela, para o número não parecer mágico. Um seletor permitindo trocar
para rateio por `sale_price` ou por `area_sf` é desejável.

### Conferências (exibir sempre num painel de validação)
| Conferência | Regra |
|---|---|
| Caixa mínimo acumulado | `min(caixa_acumulado)` — vermelho se < 0; âmbar se < `min_cash_buffer` |
| Saldo devedor final | `saldo_final(prazo_total)` deve ser 0 |
| Soma das participações | deve ser 100% com tolerância de 0,01 p.p. |
| Divisão do lucro | `investor_profit_share + sponsor_profit_share` deve ser 1 |
| Prazo dentro do horizonte | `prazo_total ≤ max_horizon` |
| Janela de financiamento | `draw_start_month ≤ draw_end_month` |
| Saque ≤ teto de dívida | `divida_sacada ≤ teto_divida` |
| Caixa final | deve corresponder ao lucro do sponsor quando tudo está automático |
| Distribuição lançada − total a distribuir | deve ser 0 |
| Aporte após a saída | âmbar se houver `equity_call(m) > 0` com `m > mes_saida` |
| Overrides órfãos | âmbar se houver override em `month_index > prazo_total` |
| Convergência | âmbar se a iteração de `cash_demand`/capitalização estourou 50 passes |

Compare igualdades com tolerância de 0,01 — nunca com `==` sobre float. "Exatamente 100%"
não existe quando alguém divide participação em três.

Cada conferência é um card com semáforo (verde / âmbar / vermelho) e um texto curto
explicando o que fazer quando falha. Elas nunca bloqueiam o cálculo — apenas sinalizam.
Bloquear o **salvamento** é outra coisa, e vale para dois casos: soma das participações
fora de 100% e divisão do lucro fora de 100%.

### Overrides quando o cronograma muda
Overrides são guardados por `month_index`. Se o prazo encurtar, os overrides em meses
acima de `prazo_total` **não são apagados**: ficam inativos, acendem a conferência de
órfãos e voltam a valer se o prazo aumentar de novo. Nunca faça delete silencioso de
input do usuário.

---

## ETAPA 3 — Interface

### Navegação
Menu lateral → **Modelagens**. Lista com nome do projeto, cidade, VGV, lucro projetado,
MOIC, TIR, status e data da última alteração. Botões: nova modelagem, duplicar, arquivar.

### Editor de modelagem — abas

**1 · Premissas** — nome, localização, uso, data do mês 1, meses de aprovação /
construção / pós-obra, horizonte, data-base, revisão. Mostrar em tempo real as datas
derivadas (início da obra, fim da obra, saída) para o usuário conferir.

**2 · Unidades** — tabela editável inline, adicionar/remover linhas, com colunas nome,
cidade, área sf, terreno, obra, aporte base, preço de venda, property tax anual. Rodapé
com totais. Colunas calculadas ao lado: custo total, financiamento implícito, margem
por unidade. Deixar claro no cabeçalho que "aporte base" é premissa de dimensionamento,
não o aporte efetivo.

**3 · Custos adicionais** — linhas livres tipo "Contingência", com valor e regra de
distribuição.

**4 · Financiamento** — taxa, fee, mês do fee, janela de saque, modo de saque (com
explicação de cada modo em uma frase), teto por LTC ou valor contratado, modo de
amortização, colchão mínimo de caixa, flag de capitalização de juros, flag de financiar o
custo financeiro na demanda.

**5 · Sócios** — nome, %, marcação de "cota disponível". Validação em tempo real da soma
das participações. Percentuais de lucro investidores × sponsor, também validados.

**6 · Receita** — comissão %, cartório %, modo de venda, mês de saída ou mês por unidade.

**7 · Fluxo de caixa** — **a tela principal**
- Grade com os meses nas colunas e as linhas na ordem: terrenos, obra, property taxes,
  outros custos, juros e taxas, **total de pagamentos**, receita, saque, amortização,
  **aporte de equity**, distribuição, saldo devedor, equity acumulado, caixa do mês,
  caixa acumulado.
- Linhas de totais em destaque; coluna de total à direita, fixa.
- Primeira coluna e cabeçalho de meses congelados; rolagem horizontal.
- **Qualquer célula editável recebe um override**: fundo âmbar, ícone de lápis e tooltip
  com o valor automático original. Botão "reverter" por célula, por linha e por
  modelagem inteira. Um segundo estado, "forçar vazio", distinto de "forçar zero".
- Contador no topo: "12 células em modo manual" com link para revisá-las.
- Ao editar, tudo recalcula na hora, inclusive KPIs e conferências.

**8 · Resultado** — cascata de apuração, quadro de usos e origens, indicadores em
cartões, resultado por unidade (com a regra de rateio visível), rateio por sócio,
chamadas de capital por sócio.

**9 · Demanda de caixa** — tela separada
- Gráfico de barras: demanda bruta de caixa por mês (pagamentos + amortização − receita).
- Sobreposto: quanto foi coberto por dívida e quanto por equity, empilhado.
- Linha: saldo devedor e teto de dívida.
- Tabela: mês, demanda bruta, caixa de abertura, saque, aporte, caixa de fechamento,
  folga em relação ao colchão mínimo.
- Destaque nos meses em que a dívida bateu no teto ou em que o caixa ficou abaixo do
  colchão.
- Botão **"Dimensionar financiamento pela demanda"**: roda o modo `cash_demand`,
  mostra um diff lado a lado com o cenário atual (saques, juros totais, equity total,
  MOIC, TIR) e só aplica se eu confirmar.

**10 · Sensibilidade**
- Grade de duas entradas: variação no preço de venda (linhas, de −15% a +10% em passos de
  5%) × variação no custo de obra (colunas, de −5% a +15% em passos de 5%), com o lucro do
  projeto em cada célula e escala de cor.
- Segunda grade com o MOIC.
- Cenários nomeados (base, conservador, estresse, otimista) editáveis.
- Pontos de equilíbrio: VGV mínimo para lucro zero, queda máxima admissível no preço,
  custo de obra máximo, alta máxima admissível.
- Sensibilidade ao prazo: efeito de 3, 6 e 12 meses de atraso na venda sobre TIR e MOIC.

### Comparação de cenários
Duplicar uma modelagem como cenário e comparar dois ou três lado a lado numa tabela de
indicadores, com destaque nas diferenças.

### Exportação
- XLSX com uma aba por seção, fórmulas preservadas onde possível
- PDF do relatório (capa, premissas, unidades, resultado, fluxo, sócios, sensibilidade)
- CSV do fluxo de caixa

---

## ETAPA 4 — Critérios de aceite

Crie testes automatizados (Vitest) do motor com este caso. Ele reproduz um projeto real
e os números precisam bater com tolerância de US$ 1,00 (e de 0,0001 nos indicadores
adimensionais).

### Entrada
- Início: 01/12/2025 · aprovação 10 meses · construção 8 · pós-obra 5 · **prazo 23**
- Unidades:
  - 2 × terreno 25.000 · obra 210.000 · aporte base 100.250 · venda 320.000 · tax/ano 850
  - 2 × terreno 95.000 · obra 460.000 · aporte base 266.139 · venda 825.000 · tax/ano 1.800
- Custo adicional: Contingência 56.000, distribuição `linear_construction`
- Financiamento: taxa 9,5% a.a. · fee 1,5% com `fee_timing = first_draw` ·
  janela do mês 13 ao 23 · modo `equity_first` · sem teto (`max_ltc_pct` e
  `contracted_amount` nulos) · amortização `at_exit` · juros **não** capitalizados ·
  `min_cash_buffer = 0` · `finance_costs_in_demand = false`
- Receita: comissão 6% · cartório 2% · `single_exit` com `exit_month = 23`
- Divisão do lucro: investidores 80% · sponsor 20%
- Sócios: 2 sócios de 50% cada (só para o teste de rateio)
- Distribuição: automática

### Saída esperada
| Indicador | Valor |
|---|---|
| Terrenos | 240.000,00 |
| Obra | 1.340.000,00 |
| Property taxes | 10.158,33 |
| Contingência | 56.000,00 |
| Juros | 53.888,29 |
| Fee de estruturação | 12.708,33 |
| Juros e taxas de financiamento | 66.596,62 |
| **Total de pagamentos** | **1.712.754,95** |
| Dívida sacada | 847.222,00 |
| Dívida amortizada | 847.222,00 |
| Saldo devedor no mês 23 | 0,00 |
| Equity total aportado | 858.384,11 |
| Receita líquida de vendas | 2.106.800,00 |
| **Lucro do projeto** | **394.045,05** |
| Lucro dos investidores (80%) | 315.236,04 |
| Lucro do sponsor (20%) | 78.809,01 |
| Total distribuído | 1.173.620,15 |
| MOIC | 1,3672x |
| ROI | 36,72% |
| Margem sobre VGV | 17,21% |
| LTC | 53,62% |
| TIR mensal | 2,2752% |
| **TIR anual** | **30,99%** |
| Caixa mínimo acumulado | 0,00 |
| Caixa final | 78.809,01 (= lucro do sponsor) |

Como o caso base não define teto de dívida, a conferência "Saque ≤ teto" acende **âmbar**
avisando que não há limite configurado — é o comportamento correto, não uma falha. Todas
as demais ficam verdes.

### Saques esperados (equity_first)
Mês 13: 9.722,00 · meses 14 a 18: 167.500,00 cada · demais meses: 0

### Aportes de equity esperados (todos os 23 meses)
```
m1  240.441,67    m9      441,67    m17  12.822,80
m2      441,67    m10     441,67    m18  14.148,84
m3      441,67    m11 174.941,67    m19   7.148,84
m4      441,67    m12 174.941,67    m20   7.148,84
m5      441,67    m13 178.004,96    m21   7.148,84
m6      441,67    m14   8.844,67    m22   7.148,84
m7      441,67    m15  10.170,72    m23       0,00
m8      441,67    m16  11.496,76
```
O mês 23 é zero porque a receita da venda entra no mesmo mês e cobre os 7.148,84 de
property tax e juros daquele mês. Se o seu motor devolver 7.148,84 no mês 23 e um equity
total de 865.532,95, ele está deixando a receita de fora da fórmula do aporte — corrija a
fórmula, não o teste.

### Saldo devedor esperado
Mês 13: 9.722,00 · m14: 177.222,00 · m15: 344.722,00 · m16: 512.222,00 ·
m17: 679.722,00 · m18 a m22: 847.222,00 · m23: 0,00

### Testes adicionais obrigatórios
1. **Override**: fixar `equity_call` do mês 1 em 500.000 e verificar que o caixa
   acumulado do mês 1 sobe para 259.558,33, que o lucro do projeto **não** muda — a
   apuração não depende de como o caixa foi financiado — e que o **equity total também
   não muda**: continua 858.384,11. Aportar mais cedo só adianta capital; os meses
   seguintes consomem a sobra de caixa e chamam menos na mesma medida. O que muda é o
   calendário, e por isso a TIR mensal cai de 2,2752% para 1,8551% com o MOIC intacto.
   Se o seu motor mostrar equity total maior, o aporte não está descontando o caixa de
   abertura.
2. **Caixa negativo**: forçar override de `equity_call = 0` nos meses 1 e 2 e verificar
   que o caixa mínimo fica negativo e a conferência acusa vermelho, sem exceção.
3. **Modo `cash_demand`**: rodar com `max_ltc_pct = 55%` e verificar que
   `divida_sacada = 869.000,00` exatamente (o teto binda), que `saldo_final(23) = 0`,
   que o equity total cai para 844.878,72 e que o caixa nunca fica abaixo do colchão. Repetir com `min_cash_buffer = 50.000` e verificar que o caixa mínimo passa a
   ser exatamente 50.000,00.
   Atenção: com a fórmula 6 o aporte de equity é um plugue que mantém o caixa no colchão
   por construção, então a asserção de colchão só tem valor de verdade quando combinada
   com overrides de `equity_call`. Faça as duas versões.
4. **Prazo alterado**: mudar construção de 8 para 12 meses e verificar que a obra se
   redistribui em 12 parcelas, o prazo vai a 27, a curva de juros se estende e as datas
   acompanham.
5. **Overrides órfãos**: com o prazo em 27, gravar um override no mês 26, voltar a
   construção para 8 (prazo 23) e verificar que o override some do cálculo, acende a
   conferência âmbar e **continua no banco**; ao voltar para 12 meses, volta a valer.
6. **Sócios**: soma de 99% deve bloquear o salvamento com mensagem clara, mas o cálculo
   tem de continuar rodando e devolvendo a conferência vermelha.
7. **TIR sem sinal**: fluxo só negativo deve retornar `null`, não `NaN`.
8. **TIR fora do intervalo**: um fluxo cuja TIR mensal passe de 100% deve retornar `null`,
   não o extremo do intervalo de bisseção.
9. **Determinismo**: rodar o mesmo input duas vezes e comparar o `ModelOutput` inteiro
   campo a campo.

---

## Princípios de implementação

1. **Nenhum número mágico na interface.** Todo valor exibido vem do `ModelOutput`.
2. **Nada de dado calculado no banco.** Só inputs e overrides.
3. **Arredondamento apenas na exibição.** O motor trabalha em ponto flutuante pleno, sem
   conversão para centavos inteiros em nenhum ponto.
4. **Cada linha do fluxo tem um `line_key` estável**, para o override amarrar corretamente
   mesmo depois de o prazo mudar.
5. **Vazio ≠ zero.** Meses além do prazo ficam vazios; zero é um valor legítimo; e o
   override sabe expressar os dois.
6. **O motor nunca lança exceção** por input inconsistente: retorna o resultado possível
   mais as conferências que falharam.
7. **Nenhuma comparação de float com `==`.** Sempre tolerância explícita.
8. Comente no código a origem de cada regra de negócio, principalmente o `equity_first`,
   a estrutura de passes e a ordem do loop mensal.

## Fora do escopo desta primeira versão
Integração bancária, conciliação de extratos, controle de obra físico, contratos,
assinatura digital, tributação. Deixe ganchos previstos mas não implemente.
