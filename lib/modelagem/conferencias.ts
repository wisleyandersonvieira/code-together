/**
 * Painel de validação da modelagem.
 *
 * Conferências NUNCA bloqueiam o cálculo — só sinalizam. Bloquear o SALVAMENTO é
 * outra coisa, e vale para QUATRO casos: soma das participações, soma dos
 * percentuais de capital, divisão do lucro fora de 100% e distribuição de
 * unidades por fase que não fecha. A lista canônica, com o critério de cada uma,
 * está em `bloqueiaSalvamento` no fim do arquivo — é lá que se mexe, não aqui.
 *
 * Nenhuma igualdade é comparada com `==`: tudo por tolerância. "Exatamente 100%"
 * não existe quando alguém divide participação em três.
 */
import type {
  Agregados,
  Apuracao,
  Conferencia,
  Cronograma,
  MesFluxo,
  ModelInput,
  Override,
  RateioSocio,
  Semaforo,
} from './tipos';
import type { BasesDeCalculo, ResolucaoCustos } from './motor';
import { ROTULO_CATEGORIA, ROTULO_GATILHO } from './tipos';
import { TOLERANCIA } from './indicadores';

/** Tolerância de participação: 0,01 ponto percentual. */
const TOL_PARTICIPACAO = 0.0001;

const dinheiro = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface Contexto {
  input: ModelInput;
  cronograma: Cronograma;
  agregados: Agregados;
  meses: MesFluxo[];
  apuracao: Apuracao;
  convergiu: boolean;
  orfaos: Override[];
  compartilhado: number;
  /**
   * Denominadores das bases de cálculo de custo, já resolvidos pelo motor.
   *
   * Vêm prontos em vez de serem recalculados aqui: a conferência tem de cobrar
   * exatamente o número que o cálculo usou, e recomputar abriria espaço para as
   * duas contas divergirem.
   */
  bases: BasesDeCalculo;
  /** Orçamento já resolvido: valores efetivos, itens em ciclo e base dos grupos. */
  resolucao: ResolucaoCustos;
  /** Quanto de cada custo o gatilho conseguiu de fato lançar no fluxo. */
  lancadoPorCusto: number[];
  /** Unidades que fecham em cada mês, já derivadas do modo de venda. */
  vendasPorMes: Map<number, number>;
  /** Release PRETENDIDO no projeto inteiro, antes do clamp pelo saldo devedor. */
  releaseTotal: number;
  /**
   * Rateio por sócio já apurado pelo motor.
   *
   * Vem pronto em vez de ser recalculado aqui pelo mesmo motivo de `bases` e
   * `resolucao`: a conferência tem de cobrar exatamente a fração que o cálculo
   * usou, e recomputar abriria espaço para as duas contas divergirem.
   */
  rateioSocios: RateioSocio[];
  /**
   * Meses em que a demanda de caixa existia e o TETO de dívida foi o limite do
   * saque. Contado pelo motor dentro do passe (só no modo
   * 'equity_first_demanda') em vez de recomputado aqui: a conferência tem de
   * cobrar exatamente o número que dimensionou o saque.
   */
  mesesNoTeto: number;
  /** Σ (demanda − saque) nesses meses: o que ficou sem cobertura nenhuma. */
  descobertoPorTeto: number;
  /**
   * Σ do release que o teto do saldo de abertura cortou. Vem do passe pelo mesmo
   * motivo dos dois acima: é o número que a amortização de fato usou.
   */
  releaseCortadoTotal: number;
}

export function montarConferencias(ctx: Contexto): Conferencia[] {
  const { input, cronograma, agregados, meses, apuracao, convergiu, orfaos } = ctx;
  const fin = input.financiamento;
  const rec = input.receita;
  const socios = input.socios ?? [];
  const colchao = fin.colchaoMinimoCaixa || 0;
  const lista: Conferencia[] = [];

  const add = (
    chave: string,
    titulo: string,
    semaforo: Semaforo,
    valor: string,
    detalhe: string,
    comoResolver: string,
  ) => lista.push({ chave, titulo, semaforo, valor, detalhe, comoResolver });

  // ─── Rateio do capital entre os sócios ─────────────────────────────────────
  // Lido aqui em cima porque `caixa_minimo` já precisa dele: com cronograma por
  // sócio, um caixa negativo tem outra causa e outra saída.
  const regraCapital = input.aportes?.regraRateioCapital ?? 'participacao';
  const porCronogramaDeSocio = regraCapital === 'cronograma_socio';

  // ─── Caixa mínimo acumulado ────────────────────────────────────────────────
  const caixaMinimo = meses.length ? Math.min(...meses.map((m) => m.caixaAcumulado)) : 0;
  const mesDoMinimo = meses.find((m) => m.caixaAcumulado === caixaMinimo)?.mes ?? 0;
  add(
    'caixa_minimo',
    'Caixa mínimo acumulado',
    caixaMinimo < -TOLERANCIA ? 'vermelho' : caixaMinimo < colchao - TOLERANCIA ? 'ambar' : 'verde',
    dinheiro(caixaMinimo),
    caixaMinimo < -TOLERANCIA
      ? // Com cronograma por sócio o aporte do mês deixa de ser resíduo de caixa:
        // é a soma do que os sócios declararam. Um caixa negativo aqui significa
        // que o cronograma dos sócios não cobre a demanda — que é exatamente o
        // que `aportes_socio_vs_demanda` diria. Estender esta em vez de criar uma
        // segunda evita o painel dizer duas vezes a mesma coisa.
        porCronogramaDeSocio
        ? `O caixa fica negativo no mês ${mesDoMinimo}: faltam ${dinheiro(Math.abs(caixaMinimo))}. Com o cronograma por sócio, o aporte do mês é a soma do que os sócios declararam — o motor não completa a diferença.`
        : `O caixa fica negativo no mês ${mesDoMinimo}.`
      : caixaMinimo < colchao - TOLERANCIA
        ? `O caixa cai abaixo do colchão de ${dinheiro(colchao)} no mês ${mesDoMinimo}.`
        : 'O caixa nunca fica descoberto.',
    porCronogramaDeSocio
      ? 'Acrescente ou antecipe aportes na aba Sócios, antecipe saque do financiamento ou reduza o colchão mínimo.'
      : 'Aumente o aporte do mês, antecipe saque do financiamento ou reduza o colchão mínimo.',
  );

  // ─── Saldo devedor final ───────────────────────────────────────────────────
  // Com juros capitalizados a dívida amortizada é MAIOR que a sacada (os juros
  // viraram principal), então a conferência certa é o saldo final, não a diferença.
  const saldoFinal = meses.length ? meses[meses.length - 1].saldoDevedor : 0;
  add(
    'saldo_devedor_final',
    'Saldo devedor no fim do projeto',
    Math.abs(saldoFinal) <= TOLERANCIA ? 'verde' : 'vermelho',
    dinheiro(saldoFinal),
    Math.abs(saldoFinal) <= TOLERANCIA
      ? 'A dívida é integralmente quitada.'
      : 'Sobra saldo devedor no último mês do projeto.',
    'Revise o modo de amortização, o mês de saída ou os overrides da linha de amortização.',
  );

  // ─── Soma das participações ────────────────────────────────────────────────
  const somaPart = socios.reduce((a, s) => a + (s.participacaoPct || 0), 0);
  add(
    'soma_participacoes',
    'Soma das participações',
    socios.length === 0
      ? 'ambar'
      : Math.abs(somaPart - 1) <= TOL_PARTICIPACAO
        ? 'verde'
        : 'vermelho',
    socios.length === 0 ? 'sem sócios' : pct(somaPart),
    socios.length === 0
      ? 'Nenhum sócio cadastrado — o rateio fica vazio.'
      : `As participações somam ${pct(somaPart)}.`,
    'Ajuste os percentuais até somar 100%. Enquanto não somar, o salvamento fica bloqueado.',
  );

  // ─── Rateio do capital (migration 1763100000) ──────────────────────────────
  // Restritas às regras NOVAS de propósito: com 'participacao' — o default e o
  // estado de toda modelagem já gravada — `soma_pct_capital` e
  // `socio_sem_aporte` são inalcançáveis, então nenhuma delas ganha item novo no
  // painel. `capital_vs_participacao` fica verde ali por construção, já que as
  // duas frações são a mesma.
  const rateio = ctx.rateioSocios;

  if (regraCapital === 'pct_capital') {
    // Capital que não soma 100% reparte dinheiro que não existe — ou deixa parte
    // do capital sem dono. É o mesmo critério de `soma_participacoes`, e por isso
    // também bloqueia o salvamento.
    const somaCapital = socios.reduce((a, s) => a + (s.pctCapital ?? s.participacaoPct ?? 0), 0);
    add(
      'soma_pct_capital',
      'Soma dos percentuais de capital',
      socios.length === 0
        ? 'ambar'
        : Math.abs(somaCapital - 1) <= TOL_PARTICIPACAO
          ? 'verde'
          : 'vermelho',
      socios.length === 0 ? 'sem sócios' : pct(somaCapital),
      socios.length === 0
        ? 'Nenhum sócio cadastrado — não há como repartir o capital.'
        : `Os percentuais de capital somam ${pct(somaCapital)}. Sócio sem percentual próprio entra com a participação dele.`,
      'Ajuste os percentuais de capital até somar 100%. Enquanto não somarem, o salvamento fica bloqueado.',
    );
  }

  // Divergência entre capital e participação NÃO é erro: é a negociação. Só
  // precisa estar visível, porque é ela que faz a TIR de um sócio diferir da do
  // outro — e ninguém deveria descobrir isso lendo a tabela de indicadores.
  //
  // Restrita às regras NOVAS pelo mesmo motivo das demais: em 'participacao' a
  // fração de capital É a participação, então a conferência seria verde por
  // construção — e ainda assim apareceria como item novo no painel de toda
  // modelagem já salva, que é justamente o que este módulo não faz.
  const TOL_DIVERGENCIA = 0.01; // 1 ponto percentual
  const divergentes = rateio.filter(
    (r) => Math.abs(r.pctCapital - r.participacaoPct) > TOL_DIVERGENCIA,
  );
  if (regraCapital !== 'participacao') {
  add(
    'capital_vs_participacao',
    'Capital diferente da participação',
    divergentes.length > 0 ? 'ambar' : 'verde',
    `${divergentes.length}`,
    divergentes.length > 0
      ? `${divergentes
          .map(
            (r, i) =>
              `${r.nome || `Sócio ${i + 1}`}: ${pct(r.pctCapital)} do capital contra ${pct(
                r.participacaoPct,
              )} de participação`,
          )
          .join('; ')}. Não é erro — é a negociação. Só saiba que quem põe mais capital e recebe o mesmo lucro tem retorno menor.`
      : 'Cada sócio entra com a mesma fração que tem na sociedade.',
    'Se a divergência não é intencional, iguale o percentual de capital à participação na aba Sócios.',
  );
  }

  if (porCronogramaDeSocio) {
    // Sócio sem aporte nenhum: ou a negociação é essa, ou faltou lançar. O motor
    // não decide — e o capital dele fica zero, com MOIC e TIR nulos.
    const semAporte = socios.filter((s) => (s.aportes ?? []).length === 0);
    add(
      'socio_sem_aporte',
      'Sócio sem aporte lançado',
      semAporte.length > 0 ? 'ambar' : 'verde',
      `${semAporte.length}`,
      semAporte.length > 0
        ? `${semAporte
            .map((s, i) => s.nome || `Sócio ${i + 1}`)
            .join('; ')} — nenhum aporte lançado. O capital deles fica zerado, e MOIC, ROI e TIR ficam sem denominador.`
        : 'Todos os sócios têm aporte lançado.',
      'Lance os aportes na aba Sócios, ou troque a regra de rateio do capital se a intenção é repartir por percentual.',
    );

    // Aporte além do prazo não é lançado em mês nenhum — o dinheiro não some do
    // cadastro, mas não entra no fluxo. Mesma leitura de
    // `aporte_parcela_fora_prazo` e `custo_parcelas_fora_do_prazo`.
    const foraDoPrazo = socios.flatMap((s) =>
      (s.aportes ?? [])
        .filter((a) => !Number.isInteger(a.mes) || a.mes < 1 || a.mes > cronograma.prazoTotal)
        .map((a) => ({ s, a })),
    );
    const valorFora = foraDoPrazo.reduce((acc, x) => acc + (x.a.valor || 0), 0);
    add(
      'aportes_socio_fora_do_prazo',
      'Aportes de sócio fora do prazo',
      foraDoPrazo.length > 0 ? 'ambar' : 'verde',
      `${foraDoPrazo.length}`,
      foraDoPrazo.length > 0
        ? `${foraDoPrazo.length} aporte(s) somando ${dinheiro(valorFora)} caem fora dos ${cronograma.prazoTotal} meses do cronograma: ficam guardados, inativos, e não entram no fluxo.`
        : 'Todos os aportes caem dentro do cronograma.',
      'Mova os aportes para meses dentro do prazo ou aumente o cronograma. O sistema não apaga aporte nenhum sozinho.',
    );
  }

  // ─── Divisão do lucro ──────────────────────────────────────────────────────
  const somaLucro = (rec.lucroInvestidoresPct || 0) + (rec.lucroSponsorPct || 0);
  add(
    'divisao_lucro',
    'Divisão do lucro',
    Math.abs(somaLucro - 1) <= TOL_PARTICIPACAO ? 'verde' : 'vermelho',
    pct(somaLucro),
    `Investidores + sponsor somam ${pct(somaLucro)}.`,
    'Investidores e sponsor têm de somar 100% do lucro do projeto.',
  );

  // ─── Prazo dentro do horizonte ─────────────────────────────────────────────
  add(
    'prazo_horizonte',
    'Prazo dentro do horizonte',
    cronograma.prazoTotal <= cronograma.horizonteMaximo ? 'verde' : 'vermelho',
    `${cronograma.prazoTotal} de ${cronograma.horizonteMaximo} meses`,
    cronograma.prazoTotal <= cronograma.horizonteMaximo
      ? 'O cronograma cabe no horizonte configurado.'
      : 'O prazo do projeto ultrapassa o horizonte máximo.',
    'Aumente o horizonte máximo nas premissas ou encurte o cronograma.',
  );

  // ─── Janela de financiamento ───────────────────────────────────────────────
  const janelaOk = fin.mesInicioSaque <= fin.mesFimSaque;
  add(
    'janela_financiamento',
    'Janela de financiamento',
    janelaOk ? 'verde' : 'vermelho',
    `mês ${fin.mesInicioSaque} ao ${fin.mesFimSaque}`,
    janelaOk ? 'A janela de saque é válida.' : 'O mês inicial de saque é posterior ao final.',
    'Corrija a janela na aba Financiamento — enquanto ela estiver invertida, não há saque nenhum.',
  );

  // ─── Saque ≤ teto de dívida ────────────────────────────────────────────────
  //
  // Duas leituras opostas do mesmo teto, e as duas são vermelhas:
  //   sacado ACIMA do teto — só com override manual de saque;
  //   sacado NO teto com demanda sobrando — o teto foi o limite e o caixa ficou
  //     descoberto. É o caso que o modo 'equity_first_demanda' expõe, porque nele
  //     o saque é dimensionado pela demanda: o que a capacidade cortou é
  //     exatamente o buraco de caixa do projeto, e o motor já o contou
  //     (`mesesNoTeto`/`descobertoPorTeto`, zerados em todos os outros modos).
  //
  // E duas grandezas diferentes contra o mesmo teto, conforme o tipo de linha:
  //   NÃO ROTATIVA (default) — o teto vale para o TOTAL desembolsado na vida do
  //     empréstimo. É `dividaSacada`, e é o que sempre foi cobrado aqui.
  //   ROTATIVA — amortizar devolve limite, então o que o contrato limita é o
  //     PICO do saldo devedor. Um projeto que saca $30M e amortiza a cada venda
  //     pode nunca passar de $15M em aberto: reprovar isso contra o total
  //     desembolsado seria cobrar um limite que o contrato não tem.
  // O detalhe DIZ qual das duas está valendo — sem isso ninguém entende por que
  // o mesmo projeto passa num modo e reprova no outro.
  const temTeto = Number.isFinite(apuracao.tetoDivida);
  const rotativa = !!fin.linhaRotativa;
  const medida = rotativa ? apuracao.saldoDevedorMaximo : apuracao.dividaSacada;
  const leitura = rotativa
    ? 'linha rotativa: o teto é cobrado contra o PICO do saldo devedor, porque amortizar devolve limite'
    : 'linha não rotativa: o teto é cobrado contra o TOTAL desembolsado na vida do empréstimo';
  const cortadoPeloTeto = ctx.mesesNoTeto > 0 && ctx.descobertoPorTeto > TOLERANCIA;
  // Quanto o teto precisaria valer, em LTC, para caber a demanda que ficou de
  // fora. Custo direto zero devolve null e a frase simplesmente não menciona LTC
  // — nunca NaN nem Infinity na tela.
  const custoDireto = agregados.terrenosTotal + agregados.obraTotal;
  const ltcNecessario =
    custoDireto > 0 ? (medida + ctx.descobertoPorTeto) / custoDireto : null;
  add(
    'teto_divida',
    rotativa ? 'Saldo devedor dentro do teto (linha rotativa)' : 'Saque dentro do teto de dívida',
    cortadoPeloTeto
      ? 'vermelho'
      : !temTeto
        ? 'ambar'
        : medida <= apuracao.tetoDivida + TOLERANCIA
          ? 'verde'
          : 'vermelho',
    temTeto ? `${dinheiro(medida)} de ${dinheiro(apuracao.tetoDivida)}` : dinheiro(medida),
    cortadoPeloTeto
      ? `O saque bateu no teto em ${ctx.mesesNoTeto} ${ctx.mesesNoTeto === 1 ? 'mês' : 'meses'}. ` +
        `Faltaram ${dinheiro(ctx.descobertoPorTeto)} de cobertura — seria preciso esse valor a mais de aporte` +
        (ltcNecessario == null
          ? '.'
          : `, ou elevar o teto de dívida para ${pct(ltcNecessario)} do custo direto.`) +
        ` Leitura em uso — ${leitura}.`
      : !temTeto
        ? 'Nenhum teto definido: nem LTC máximo, nem valor contratado.'
        : medida <= apuracao.tetoDivida + TOLERANCIA
          ? rotativa
            ? `O pico do saldo devedor respeita o teto (${leitura}). O total desembolsado no projeto foi ${dinheiro(apuracao.dividaSacada)}.`
            : 'O total sacado respeita o teto.'
          : rotativa
            ? `O pico do saldo devedor ultrapassa o teto (${leitura}).`
            : 'O total sacado ultrapassa o teto — só acontece com override manual de saque.',
    cortadoPeloTeto
      ? 'Aumente o aporte, eleve o LTC máximo ou o valor contratado na aba Financiamento, ou reduza o colchão mínimo de caixa.'
      : 'Defina LTC máximo ou valor contratado na aba Financiamento, ou reverta os overrides de saque.',
  );

  // ─── Custo financeiro fora do dimensionamento do saque ─────────────────────
  // Só existe no modo 'equity_first_demanda' e só com a flag desligada. Nos
  // demais casos a conferência NÃO é acrescentada à lista — nem verde: o painel
  // de toda modelagem já gravada continua com exatamente as conferências que
  // sempre teve.
  //
  // Com a flag desligada o saque é dimensionado sem os juros do mês, mas os juros
  // saem do caixa assim mesmo. O caixa fecha ABAIXO do colchão em toda a janela
  // de saque, exatamente no valor dos juros — que é justamente o problema que
  // este modo existe para resolver.
  if (fin.modoSaque === 'equity_first_demanda' && !fin.custoFinanceiroNaDemanda) {
    add(
      'custo_financeiro_fora_da_demanda',
      'Custo financeiro no dimensionamento do saque',
      'ambar',
      'desligado',
      'Os juros não entram no dimensionamento do saque, então o caixa não fecha no colchão.',
      'Ligue "custo financeiro na demanda" na aba Financiamento.',
    );
  }

  // ─── Caixa final = lucro do sponsor ────────────────────────────────────────
  // O lucro do sponsor não é distribuído: fica como caixa residual do projeto.
  // Essa igualdade é a prova de que fontes e usos fecham.
  const caixaFinal = meses.length ? meses[meses.length - 1].caixaAcumulado : 0;
  const difCaixa = caixaFinal - apuracao.lucroSponsor;
  add(
    'caixa_final_sponsor',
    'Caixa final = lucro do sponsor',
    Math.abs(difCaixa) <= TOLERANCIA ? 'verde' : 'ambar',
    dinheiro(caixaFinal),
    Math.abs(difCaixa) <= TOLERANCIA
      ? 'Fontes e usos fecham: o caixa residual é exatamente o lucro do sponsor.'
      : `O caixa final difere do lucro do sponsor em ${dinheiro(difCaixa)}.`,
    'Diferença esperada quando há overrides de aporte, receita ou distribuição. Revise as células em modo manual.',
  );

  // ─── Distribuição lançada vs total a distribuir ────────────────────────────
  const distLancada = meses.reduce((a, m) => a + m.distribution, 0);
  const difDist = distLancada - apuracao.totalDistribuido;
  add(
    'distribuicao',
    'Distribuição lançada vs a distribuir',
    Math.abs(difDist) <= TOLERANCIA ? 'verde' : 'ambar',
    dinheiro(difDist),
    Math.abs(difDist) <= TOLERANCIA
      ? 'O lançado bate com o capital devolvido mais o lucro dos investidores.'
      : `Foram lançados ${dinheiro(distLancada)} contra ${dinheiro(apuracao.totalDistribuido)} a distribuir.`,
    'Ajuste os overrides da linha de distribuição ou volte a linha para automático.',
  );

  // ─── Receita lançada vs receita apurada ────────────────────────────────────
  // A apuração parte do VGV das unidades. Se a linha de receita foi lançada à
  // mão, os dois podem divergir — e aí o lucro apurado não corresponde ao que
  // efetivamente entra em caixa.
  const receitaLancada = meses.reduce((a, m) => a + m.revenue, 0);
  const difReceita = receitaLancada - apuracao.receitaLiquida;
  add(
    'receita_lancada',
    'Receita lançada vs apurada',
    Math.abs(difReceita) <= TOLERANCIA ? 'verde' : 'ambar',
    dinheiro(difReceita),
    Math.abs(difReceita) <= TOLERANCIA
      ? 'A receita do fluxo bate com a receita líquida da apuração.'
      : `O fluxo lança ${dinheiro(receitaLancada)} contra ${dinheiro(apuracao.receitaLiquida)} apurados a partir do VGV.`,
    'A apuração sempre parte do VGV das unidades. Se a receita foi lançada à mão, alinhe os preços de venda das unidades.',
  );

  // ─── Aporte depois do mês de saída ─────────────────────────────────────────
  const aporteDepois = meses
    .filter((m) => m.mes > cronograma.mesSaida)
    .reduce((a, m) => a + m.equityCall, 0);
  add(
    'aporte_apos_saida',
    'Aporte após a saída',
    aporteDepois > TOLERANCIA ? 'ambar' : 'verde',
    dinheiro(aporteDepois),
    aporteDepois > TOLERANCIA
      ? 'Há chamada de capital depois do mês em que o capital já foi devolvido.'
      : 'Nenhum aporte depois da saída.',
    'Antecipe o mês de saída ou verifique custos lançados no pós-obra.',
  );

  // ─── Overrides órfãos ──────────────────────────────────────────────────────
  add(
    'overrides_orfaos',
    'Overrides fora do prazo',
    orfaos.length > 0 ? 'ambar' : 'verde',
    `${orfaos.length}`,
    orfaos.length > 0
      ? `${orfaos.length} override(s) em meses acima do prazo atual. Ficam guardados e inativos.`
      : 'Nenhum override fora do prazo.',
    'Aumente o prazo para reativá-los ou apague-os manualmente. O sistema nunca apaga sozinho.',
  );

  // ─── Convergência ──────────────────────────────────────────────────────────
  add(
    'convergencia',
    'Convergência do cálculo',
    convergiu ? 'verde' : 'ambar',
    convergiu ? 'convergiu' : 'não convergiu',
    convergiu
      ? 'O ponto fixo estabilizou dentro do limite de passadas.'
      : 'O cálculo esgotou as 50 passadas sem estabilizar. O resultado exibido é o da última.',
    'Costuma indicar taxa muito alta com juros capitalizados. Reduza a taxa ou desligue a capitalização.',
  );

  // ─── Plano de aportes ──────────────────────────────────────────────────────
  // Só faz sentido no modo 'plano': no modo 'demanda' as parcelas ficam guardadas
  // mas não são lançadas em mês nenhum, então divergência ali não significa nada.
  const aportes = input.aportes;
  if (aportes?.modoAporte === 'plano') {
    const parcelas = aportes.parcelas ?? [];
    const planejado = parcelas.reduce((a, p) => a + (p.valor || 0), 0);
    const alvo = aportes.valorTotalAlvo || 0;
    const difAlvo = planejado - alvo;
    add(
      'aporte_plano_vs_alvo',
      'Parcelas do plano vs alvo declarado',
      alvo === 0 || Math.abs(difAlvo) <= TOLERANCIA ? 'verde' : 'ambar',
      dinheiro(difAlvo),
      alvo === 0
        ? 'Nenhum alvo declarado — as parcelas valem por si.'
        : Math.abs(difAlvo) <= TOLERANCIA
          ? `As parcelas somam o alvo de ${dinheiro(alvo)}.`
          : `As parcelas somam ${dinheiro(planejado)} contra um alvo de ${dinheiro(alvo)}.`,
      'O alvo nunca é imposto: quem manda no fluxo são as parcelas. Ajuste as parcelas ou corrija o alvo na aba Aportes.',
    );

    // Parcela além do prazo não é lançada em mês nenhum — o dinheiro não some do
    // plano, mas não entra no fluxo. É diferente de override órfão só no nome.
    const foraDoPrazo = parcelas.filter((p) => Math.trunc(p.mes) < 1 || Math.trunc(p.mes) > cronograma.prazoTotal);
    const valorFora = foraDoPrazo.reduce((a, p) => a + (p.valor || 0), 0);
    add(
      'aporte_parcela_fora_prazo',
      'Parcelas fora do prazo',
      foraDoPrazo.length > 0 ? 'ambar' : 'verde',
      `${foraDoPrazo.length}`,
      foraDoPrazo.length > 0
        ? `${foraDoPrazo.length} parcela(s) somando ${dinheiro(valorFora)} caem fora dos ${cronograma.prazoTotal} meses do cronograma e não entram no fluxo.`
        : 'Todas as parcelas caem dentro do cronograma.',
      'Mova as parcelas para meses dentro do prazo ou aumente o cronograma. O sistema não apaga parcela nenhuma sozinho.',
    );

    // Override em equity_call vence o plano — é a invariante do módulo. Onde há
    // override, o mês do fluxo NÃO é a parcela, e isso precisa ficar visível.
    const overridesAporte = (input.overrides ?? []).filter(
      (o) => o.linha === 'equity_call' && o.mes >= 1 && o.mes <= cronograma.prazoTotal,
    );
    add(
      'aporte_override_no_plano',
      'Override de aporte com plano ligado',
      overridesAporte.length > 0 ? 'ambar' : 'verde',
      `${overridesAporte.length}`,
      overridesAporte.length > 0
        ? `${overridesAporte.length} mês(es) com override manual na linha de aporte. Nesses meses vale o override, não a parcela do plano.`
        : 'Nenhum override manual disputando com o plano.',
      'Reverta a célula no fluxo para o plano voltar a mandar, ou aceite o override — ele é a invariante do módulo e vence sempre.',
    );
  }

  // ─── Fases ─────────────────────────────────────────────────────────────────
  if (input.usaFases) {
    const fases = cronograma.fases;

    // Alocação de unidades por fase. Mesma regra de quantidade do motor, para a
    // conferência cobrar exatamente o que o cálculo usa.
    const alocado = new Map<number, number>();
    for (const a of input.alocacoes ?? []) {
      if (!input.unidades[a.unidadeIndex] || !fases[a.faseIndex]) continue;
      alocado.set(
        a.unidadeIndex,
        (alocado.get(a.unidadeIndex) ?? 0) + Math.max(0, Math.trunc(a.quantidade || 0)),
      );
    }
    const abertas = input.unidades
      .map((u, i) => ({
        nome: u.nome || `Tipologia ${i + 1}`,
        esperado: Math.max(1, Math.trunc(u.quantidade || 1)),
        alocado: alocado.get(i) ?? 0,
      }))
      .filter((x) => x.alocado !== x.esperado);
    const fechadas = input.unidades.length - abertas.length;
    add(
      'alocacao_fases',
      'Distribuição das unidades por fase',
      abertas.length > 0 ? 'vermelho' : 'verde',
      `${fechadas} de ${input.unidades.length} tipologias alocadas`,
      abertas.length === 0
        ? 'Cada tipologia tem todas as suas unidades distribuídas entre as fases.'
        : fases.length === 0
          ? 'Não há fase nenhuma cadastrada, então não há onde alocar as unidades — e o que não está alocado não entra no fluxo.'
          : `Não fecham: ${abertas
              .map(
                (x) =>
                  `${x.nome} (${x.alocado} de ${x.esperado}, ${x.alocado > x.esperado ? '+' : ''}${x.alocado - x.esperado})`,
              )
              .join('; ')}. O que não está alocado não é lançado em mês nenhum.`,
      'Ajuste a distribuição por fase na aba Tipologias até cada linha fechar.',
    );

    if (fases.length === 0) {
      add(
        'fases_sem_linha',
        'Fases cadastradas',
        'ambar',
        '0',
        'O projeto está marcado como faseado mas não tem fase nenhuma cadastrada. O cálculo segue como frente única.',
        'Cadastre as fases na aba Premissas ou desligue a divisão em fases.',
      );
    } else {
      // Fase invertida tem intervalo degenerado; para sobreposição e buraco ela é
      // lida como um único mês, que é o mesmo que o cálculo faz.
      const invertidas = fases.filter((f) => f.mesFim < f.mesInicio);
      add(
        'fase_invertida',
        'Fase com fim antes do início',
        invertidas.length > 0 ? 'vermelho' : 'verde',
        `${invertidas.length}`,
        invertidas.length > 0
          ? `Fase(s) ${invertidas.map((f) => f.nome).join(', ')} terminam antes de começar.`
          : 'Todas as fases têm fim depois do início.',
        'Corrija as datas da fase na aba Premissas.',
      );

      const estouram = fases.filter((f) => f.mesFim > cronograma.prazoTotal);
      add(
        'fases_dentro_prazo',
        'Fases dentro do prazo do projeto',
        estouram.length > 0 ? 'vermelho' : 'verde',
        `${estouram.length}`,
        estouram.length > 0
          ? `Fase(s) ${estouram.map((f) => f.nome).join(', ')} terminam depois do mês ${cronograma.prazoTotal}. O custo delas é comprimido até o último mês em vez de sumir.`
          : 'Todas as fases terminam dentro do cronograma.',
        'Aumente o prazo nas premissas ou antecipe o fim da fase.',
      );

      const ordenadas = fases
        .map((f) => ({ nome: f.nome, inicio: f.mesInicio, fim: Math.max(f.mesFim, f.mesInicio) }))
        .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
      const sobrepostas: string[] = [];
      for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i].inicio <= ordenadas[i - 1].fim) {
          sobrepostas.push(`${ordenadas[i - 1].nome} × ${ordenadas[i].nome}`);
        }
      }
      add(
        'fases_sobrepostas',
        'Fases sobrepostas',
        sobrepostas.length > 0 ? 'ambar' : 'verde',
        `${sobrepostas.length}`,
        sobrepostas.length > 0
          ? `Há sobreposição entre ${sobrepostas.join('; ')}. Não é erro — só significa duas frentes de obra no mesmo mês.`
          : 'Nenhuma fase se sobrepõe a outra.',
        'Se a sobreposição não é intencional, ajuste as datas na aba Premissas.',
      );

      // Buraco: mês entre a primeira e a última fase que não pertence a fase nenhuma.
      const primeiro = ordenadas[0].inicio;
      const ultimo = Math.max(...ordenadas.map((f) => f.fim));
      const buracos: number[] = [];
      for (let m = primeiro; m <= ultimo; m++) {
        if (!ordenadas.some((f) => m >= f.inicio && m <= f.fim)) buracos.push(m);
      }
      add(
        'fases_com_buraco',
        'Meses sem fase',
        buracos.length > 0 ? 'ambar' : 'verde',
        `${buracos.length}`,
        buracos.length > 0
          ? `Os meses ${buracos.join(', ')} ficam entre a primeira e a última fase sem pertencer a nenhuma — não recebem obra.`
          : 'As fases cobrem todo o período entre a primeira e a última sem buraco.',
        'Estenda uma fase vizinha ou crie a fase que falta na aba Premissas.',
      );
    }
  }

  // ─── Custo com base de cálculo sem denominador ─────────────────────────────
  // Um custo em 'por_unidade' sem tipologia nenhuma, ou em 'por_sf' com área
  // total zerada, é multiplicado por zero e desaparece do fluxo sem deixar
  // rastro. O motor não pode lançar exceção por isso — a invariante do módulo é
  // que input inconsistente vira conferência —, mas sumir em silêncio seria pior
  // que qualquer erro: o usuário digitou $214/sf e o orçamento não mexeu.
  const custos = input.custosAdicionais ?? [];
  const emCiclo = new Set(ctx.resolucao.circulares);
  const nomeDoCusto = (c: (typeof custos)[number], i: number) => c.label || `Custo ${i + 1}`;

  /**
   * As parcelas de um custo (migration 1763000000). Só o gatilho 'mes_fixo' as
   * usa; nos demais a lista é ignorada, e por isso nem é lida aqui.
   */
  const parcelasDe = (c: (typeof custos)[number]) =>
    c.gatilho === 'mes_fixo' ? (c.parcelas ?? []) : [];

  /**
   * O que se ESPERAVA lançar de um custo.
   *
   * Regra geral: o valor efetivo da base de cálculo. Com parcelas, porém, quem
   * manda no total lançado são elas — cobrar o valor efetivo aqui faria
   * `custo_gatilho_nao_lancado` acender por uma diferença que já tem conferência
   * própria (`custo_parcelas_vs_alvo`), e o painel diria duas vezes a mesma
   * coisa com números diferentes.
   */
  const alvoLancado = (c: (typeof custos)[number], i: number) => {
    const parcelas = parcelasDe(c);
    if (parcelas.length > 0) return parcelas.reduce((a, p) => a + (p.valor || 0), 0);
    return ctx.resolucao.valores[i] ?? 0;
  };

  /** Como o item foi digitado — para a mensagem dizer o que o usuário informou. */
  const comoFoiDigitado = (c: (typeof custos)[number]) => {
    if (c.baseCalculo === 'por_unidade') return `${dinheiro(c.valorUnitario || 0)} por unidade`;
    if (c.baseCalculo === 'por_sf') return `${dinheiro(c.valorUnitario || 0)} por pé quadrado`;
    if (c.baseCalculo === 'pct_de_grupo') return `${pct(c.percentual || 0)} de um grupo`;
    return dinheiro(c.valor || 0);
  };

  const semDenominador = custos.filter((c, i) => {
    if (c.baseCalculo === 'por_unidade') return ctx.bases.unidades <= 0;
    if (c.baseCalculo === 'por_sf') return ctx.bases.areaSf <= 0;
    if (c.baseCalculo === 'pct_de_grupo') {
      // Item em ciclo já tem conferência própria, em vermelho: não duplicar aqui.
      if (emCiclo.has(i)) return false;
      const ref = c.grupoReferencia;
      return ref == null || (ctx.resolucao.referencias[ref] ?? 0) <= 0;
    }
    return false;
  });
  if (semDenominador.length > 0) {
    add(
      'custo_base_zerada',
      'Custo com base de cálculo zerada',
      'ambar',
      `${semDenominador.length}`,
      `${semDenominador
        .map((c, i) => `${nomeDoCusto(c, i)} (${comoFoiDigitado(c)})`)
        .join('; ')} — a base sobre a qual o valor incide é zero, então o custo entra no fluxo como ${dinheiro(0)}.`,
      'Cadastre as tipologias e a área por unidade na aba Tipologias, escolha um grupo de referência que tenha custo lançado, ou mude a base do custo para "Valor total".',
    );
  }

  // ─── Referência circular entre custos percentuais ──────────────────────────
  // Uma contingência de 5% que incide sobre a própria categoria — ou duas linhas
  // que incidem uma sobre a outra — não tem valor definido: cada passada
  // aumentaria a anterior, sem parar. O motor devolve ZERO para os itens
  // envolvidos em vez de iterar até estourar, e a conferência nomeia cada um
  // deles para que o zero não passe por acaso.
  //
  // Vermelho, mas NÃO bloqueia o salvamento: o usuário precisa poder gravar o
  // trabalho pela metade e voltar depois. Ver `bloqueiaSalvamento`.
  if (ctx.resolucao.circulares.length > 0) {
    const nomes = ctx.resolucao.circulares.map((i) => {
      const c = custos[i];
      const alvo = c?.grupoReferencia ? ROTULO_CATEGORIA[c.grupoReferencia] : 'sem grupo';
      return `${nomeDoCusto(c, i)} → ${alvo}`;
    });
    add(
      'custo_referencia_circular',
      'Referência circular entre custos',
      'vermelho',
      `${ctx.resolucao.circulares.length}`,
      `${nomes.join('; ')}. A referência volta para a própria categoria do item, direta ou indiretamente, então o valor não existe — estes itens entram no fluxo como ${dinheiro(0)}.`,
      'Aponte o percentual para uma categoria que não dependa da categoria do próprio item. Uma contingência em "Contingência" não pode incidir sobre "Contingência".',
    );
  }

  // ─── Gatilho sem mês para lançar ───────────────────────────────────────────
  // O gatilho pode não encontrar mês nenhum: 'mes_fixo' sem âncora ou com âncora
  // fora do prazo, 'fim_obra' num projeto sem meses de construção, 'por_venda'
  // sem venda declarada (modo manual, ou tipologia sem mês de venda). Nesses
  // casos o dinheiro não entra no fluxo — e a invariante do módulo é que input
  // do usuário nunca some em silêncio.
  //
  // Restrita a gatilho <> 'cronograma' DE PROPÓSITO: com o default da migration
  // 1761500000 esta conferência é inalcançável, então nenhuma modelagem já salva
  // ganha item novo no painel.
  //
  // Um custo 'mes_fixo' PARCELADO também passa por aqui — não há conferência
  // separada para ele: o alvo é a soma das parcelas, e o que sobra é parcela em
  // mês fora do prazo. `custo_parcelas_fora_do_prazo` conta quantas são;
  // esta diz quanto dinheiro ficou de fora.
  const naoLancados = custos
    .map((c, i) => ({
      c,
      i,
      efetivo: alvoLancado(c, i),
      lancado: ctx.lancadoPorCusto[i] ?? 0,
    }))
    .filter(
      (x) =>
        x.c.gatilho !== 'cronograma' &&
        Math.abs(x.efetivo) > TOLERANCIA &&
        Math.abs(x.efetivo - x.lancado) > TOLERANCIA,
    );
  if (naoLancados.length > 0) {
    const total = naoLancados.reduce((a, x) => a + (x.efetivo - x.lancado), 0);
    add(
      'custo_gatilho_nao_lancado',
      'Gatilho sem mês para lançar',
      'ambar',
      dinheiro(total),
      `${naoLancados
        .map(
          (x) =>
            `${nomeDoCusto(x.c, x.i)} (${ROTULO_GATILHO[x.c.gatilho] ?? x.c.gatilho}): ${dinheiro(
              x.lancado,
            )} de ${dinheiro(x.efetivo)}`,
        )
        .join('; ')}. O que não foi lançado NÃO é apagado — volta ao fluxo assim que o gatilho encontrar mês.`,
      'Informe o mês âncora, ajuste o cronograma para que o evento caia dentro do prazo, declare o mês de venda das tipologias na aba Receita, ou mova as parcelas para dentro do prazo.',
    );
  }

  // ─── Parcelamento do gatilho 'mes_fixo' ────────────────────────────────────
  // Restritas a custo COM parcela DE PROPÓSITO: nenhum custo anterior à migration
  // 1763000000 tem parcela, então nenhuma modelagem já salva ganha item novo no
  // painel. Sem parcela, as duas ficam inalcançáveis.
  const parcelados = custos
    .map((c, i) => ({ c, i, parcelas: parcelasDe(c) }))
    .filter((x) => x.parcelas.length > 0);

  if (parcelados.length > 0) {
    // As parcelas é que lançam. O valor efetivo do custo vira REFERÊNCIA — não
    // teto, não piso —, e a diferença é informação, não erro.
    const divergentes = parcelados
      .map((x) => ({
        ...x,
        somado: x.parcelas.reduce((a, p) => a + (p.valor || 0), 0),
        alvo: ctx.resolucao.valores[x.i] ?? 0,
      }))
      .filter((x) => Math.abs(x.somado - x.alvo) > TOLERANCIA);
    const difTotal = divergentes.reduce((a, x) => a + (x.somado - x.alvo), 0);
    add(
      'custo_parcelas_vs_alvo',
      'Parcelas do custo vs valor do custo',
      divergentes.length > 0 ? 'ambar' : 'verde',
      dinheiro(difTotal),
      divergentes.length > 0
        ? `${divergentes
            .map(
              (x) =>
                `${nomeDoCusto(x.c, x.i)}: ${x.parcelas.length} parcela(s) somando ${dinheiro(
                  x.somado,
                )} contra um valor de ${dinheiro(x.alvo)}`,
            )
            .join('; ')}.`
        : 'As parcelas de cada custo fecham com o valor do custo.',
      'As parcelas é que lançam no fluxo. Ajuste as parcelas ou o valor do custo.',
    );

    // Parcela além do prazo não é lançada em mês nenhum — o dinheiro não some do
    // custo, mas não entra no fluxo. Mesma leitura de `aporte_parcela_fora_prazo`.
    const fora = parcelados.flatMap((x) =>
      x.parcelas
        .filter((p) => !Number.isInteger(p.mes) || p.mes < 1 || p.mes > cronograma.prazoTotal)
        .map((p) => ({ ...x, p })),
    );
    const valorFora = fora.reduce((a, x) => a + (x.p.valor || 0), 0);
    add(
      'custo_parcelas_fora_do_prazo',
      'Parcelas de custo fora do prazo',
      fora.length > 0 ? 'ambar' : 'verde',
      `${fora.length}`,
      fora.length > 0
        ? `${fora.length} parcela(s) somando ${dinheiro(valorFora)} caem fora dos ${cronograma.prazoTotal} meses do cronograma: ficam guardadas, inativas, e não entram no fluxo.`
        : 'Todas as parcelas caem dentro do cronograma.',
      'Mova as parcelas para meses dentro do prazo ou aumente o cronograma. O sistema não apaga parcela nenhuma sozinho.',
    );
  }

  // ─── Takedown schedule ─────────────────────────────────────────────────────
  // Restritas ao modo 'takedown' DE PROPÓSITO: nenhuma modelagem anterior à
  // migration 1761800000 tem esse modo, então nenhuma delas ganha item novo no
  // painel. 'single_exit', 'per_unit' e 'manual' seguem com as conferências de
  // sempre.
  if (rec.modoVenda === 'takedown') {
    const takedowns = rec.takedowns ?? [];
    const unidades = input.unidades ?? [];

    // Quanto cada tipologia já tem vendido, contando TODOS os lotes — inclusive
    // os que caem fora do prazo. O usuário declarou a venda; que ela não caiba no
    // cronograma é outro problema, e some no `nao lançado` abaixo.
    const vendidoPorTipologia = new Map<number, number>();
    for (const t of takedowns) {
      if (!unidades[t.unidadeIndex]) continue;
      vendidoPorTipologia.set(
        t.unidadeIndex,
        (vendidoPorTipologia.get(t.unidadeIndex) ?? 0) + Math.max(0, Math.trunc(t.quantidade || 0)),
      );
    }
    const balanco = unidades.map((u, i) => ({
      nome: u.nome || `Tipologia ${i + 1}`,
      total: Math.max(1, Math.trunc(u.quantidade || 1)),
      vendido: vendidoPorTipologia.get(i) ?? 0,
    }));

    // ── Vendeu mais unidades do que a tipologia tem ──────────────────────────
    const excedidas = balanco.filter((x) => x.vendido > x.total);
    add(
      'takedown_quantidade',
      'Takedowns dentro da quantidade da tipologia',
      excedidas.length > 0 ? 'vermelho' : 'verde',
      `${excedidas.length}`,
      excedidas.length === 0
        ? 'Nenhuma tipologia vende mais unidades do que tem.'
        : `${excedidas
            .map((x) => `${x.nome} (${x.vendido} de ${x.total}, +${x.vendido - x.total})`)
            .join('; ')}. O motor lança a receita de todos os lotes assim mesmo — o excedente vira receita que não existe.`,
      'Reduza a quantidade dos lotes ou aumente a quantidade da tipologia na aba Tipologias.',
    );

    // ── Sobrou unidade sem lote ──────────────────────────────────────────────
    const incompletas = balanco.filter((x) => x.vendido < x.total);
    const sobrando = incompletas.reduce((a, x) => a + (x.total - x.vendido), 0);
    add(
      'takedown_incompleto',
      'Unidades sem takedown',
      sobrando > 0 ? 'ambar' : 'verde',
      `${sobrando}`,
      sobrando === 0
        ? 'Todas as unidades estão distribuídas em lotes.'
        : `${incompletas
            .map((x) => `${x.nome} (${x.vendido} de ${x.total})`)
            .join('; ')}. As ${sobrando} unidades restantes não geram receita em mês nenhum, mas o custo delas continua no fluxo.`,
      'Use "Gerar cronograma" na aba Receita para distribuir o que falta, ou acrescente os lotes à mão.',
    );

    // ── Lote fora do prazo do cronograma ─────────────────────────────────────
    // Não é a mesma coisa que o item acima: aqui o lote EXISTE, mas cai num mês
    // que o cronograma não tem. Como sempre neste módulo, não é apagado — fica
    // guardado e volta a valer se o prazo aumentar.
    const foraDoPrazo = takedowns.filter(
      (t) => !Number.isInteger(t.mes) || t.mes < 1 || t.mes > cronograma.prazoTotal,
    );
    add(
      'takedown_fora_prazo',
      'Takedowns fora do prazo',
      foraDoPrazo.length > 0 ? 'ambar' : 'verde',
      `${foraDoPrazo.length}`,
      foraDoPrazo.length > 0
        ? `${foraDoPrazo.length} lote(s) somando ${foraDoPrazo.reduce((a, t) => a + Math.max(0, Math.trunc(t.quantidade || 0)), 0)} unidade(s) caem fora dos ${cronograma.prazoTotal} meses do cronograma e não entram no fluxo.`
        : 'Todos os lotes caem dentro do cronograma.',
      'Mova os lotes para meses dentro do prazo ou aumente o cronograma. O sistema não apaga lote nenhum sozinho.',
    );

    // ── Venda antes de a fase concluir ───────────────────────────────────────
    // Vender na planta é legítimo e comum. A conferência não condena: só garante
    // que ninguém descubra por acaso que a receita entra antes da obra terminar.
    const antesDaFase = takedowns
      .map((t) => ({ t, f: t.faseIndex == null ? undefined : cronograma.fases[t.faseIndex] }))
      .filter((x) => x.f && x.t.mes < x.f.mesFim);
    add(
      'takedown_antes_da_fase',
      'Takedown antes da conclusão da fase',
      antesDaFase.length > 0 ? 'ambar' : 'verde',
      `${antesDaFase.length}`,
      antesDaFase.length > 0
        ? `${antesDaFase
            .map((x) => `${x.f!.nome || 'fase'}: lote no mês ${x.t.mes}, fase conclui no ${x.f!.mesFim}`)
            .join('; ')}. Vender antes de a fase concluir é possível — venda na planta —, mas a receita entra antes de a obra terminar.`
        : 'Nenhum lote vende antes de a fase dele concluir.',
      'Se a venda na planta é intencional, ignore. Senão, mova o lote para depois do fim da fase ou corrija a fase do lote.',
    );
  }

  // ─── Reserva de juros ──────────────────────────────────────────────────────
  // Restritas a reservaJuros > 0 DE PROPÓSITO: com o DEFAULT 0 da migration
  // 1762100000 estas conferências são inalcançáveis, então nenhuma modelagem já
  // salva ganha item novo no painel.
  if ((fin.reservaJuros || 0) > 0) {
    const saldoFinalReserva = meses.length ? meses[meses.length - 1].saldoReservaJuros : 0;
    // O mês em que a reserva acabou é a transição de saldo positivo para zero.
    const mesEsgotou = meses.find(
      (m, i) => i > 0 && m.saldoReservaJuros <= TOLERANCIA && meses[i - 1].saldoReservaJuros > TOLERANCIA,
    )?.mes;
    const pagoPelaReserva = meses.reduce((a, m) => a + m.jurosPagosPelaReserva, 0);

    add(
      'reserva_juros_esgotada',
      'Reserva de juros esgotada',
      mesEsgotou ? 'ambar' : 'verde',
      mesEsgotou ? `mês ${mesEsgotou}` : 'não esgotou',
      mesEsgotou
        ? `A reserva de ${dinheiro(fin.reservaJuros)} pagou ${dinheiro(pagoPelaReserva)} de juros e acabou no mês ${mesEsgotou}. A partir dali os juros voltam a sair do caixa.`
        : `A reserva de ${dinheiro(fin.reservaJuros)} cobre os juros até o fim do projeto.`,
      'Não é erro: é o momento em que a linha vira "interest after reserve". Confira se o caixa a partir desse mês comporta o juro.',
    );

    add(
      'reserva_juros_sobrando',
      'Sobra de reserva de juros',
      saldoFinalReserva > TOLERANCIA ? 'ambar' : 'verde',
      dinheiro(saldoFinalReserva),
      saldoFinalReserva > TOLERANCIA
        ? `Sobram ${dinheiro(saldoFinalReserva)} de reserva no fim do projeto. É dinheiro parado${fin.reservaJurosSacada !== false ? ' — e, sacado do empréstimo, pagando juros sobre si mesmo' : ''}.`
        : 'A reserva foi integralmente consumida.',
      `Dimensione a reserva mais perto dos ${dinheiro(pagoPelaReserva)} de juros que ela de fato pagou.`,
    );
  }

  // As conferências `amortizacao_alem_do_prazo` e `balloon_sem_caixa` viviam aqui
  // e saíram com os modos 'price' e 'sac' (migration 1763400000): as duas só
  // faziam sentido com prestação, vencimento e balloon. `prazoMeses`,
  // `carenciaMeses`, `amortizacaoMeses` e `balloonNoVencimento` continuam no
  // input, sem efeito e sem conferência — não há mais nada a cobrar deles.

  // ─── Release price ─────────────────────────────────────────────────────────
  // Restritas a quem de fato configurou release: com releasePrice = 0 e
  // releasePricePct nulo — os defaults da migration 1762300000 — são inalcançáveis.
  const usaRelease = (fin.releasePrice || 0) > 0 || fin.releasePricePct != null;
  if (usaRelease) {
    const saldoFinalDivida = meses.length ? meses[meses.length - 1].saldoDevedor : 0;
    add(
      'release_insuficiente',
      'Releases quitam a dívida',
      // Âmbar também quando o teto do saldo de abertura cortou release: não é
      // erro — é a dívida acabando antes das vendas —, mas o usuário precisa
      // saber que parte do release contratado não teve o que amortizar.
      saldoFinalDivida > TOLERANCIA || ctx.releaseCortadoTotal > TOLERANCIA ? 'ambar' : 'verde',
      dinheiro(saldoFinalDivida),
      (saldoFinalDivida > TOLERANCIA
        ? `Os releases somam ${dinheiro(ctx.releaseTotal)} contra ${dinheiro(apuracao.dividaSacada)} sacados, e sobram ${dinheiro(saldoFinalDivida)} de saldo devedor no fim.`
        : `Os releases somam ${dinheiro(ctx.releaseTotal)} e a dívida é integralmente quitada.`) +
        // O corte pelo teto do saldo de ABERTURA não é erro: é a dívida acabando
        // antes das vendas. Sem dizer o valor, o usuário vê o release somando
        // mais do que a amortização e não entende para onde foi a diferença.
        (ctx.releaseCortadoTotal > TOLERANCIA
          ? ` ${dinheiro(ctx.releaseCortadoTotal)} de release não chegaram a ser amortizados: nesses meses o saldo devedor de abertura já era menor que o release da venda.`
          : ''),
      'Aumente o release por unidade, ou conte com a amortização do modo escolhido para cobrir a diferença.',
    );

    // Release maior que o preço LÍQUIDO da unidade significa que a venda não
    // sobra caixa nenhum para o projeto — o banco leva tudo e ainda falta.
    const fatorLiquido = 1 - (rec.comissaoPct || 0) - (rec.custoCartorioPct || 0);
    const acimaDaReceita = (input.unidades ?? [])
      .map((u, i) => ({
        nome: u.nome || `Tipologia ${i + 1}`,
        liquido: (u.precoVenda || 0) * fatorLiquido,
        release:
          (fin.releasePrice || 0) > 0
            ? fin.releasePrice
            : (fin.releasePricePct ?? 0) * (u.precoVenda || 0),
      }))
      .filter((x) => x.release > x.liquido + TOLERANCIA);
    add(
      'release_acima_da_receita',
      'Release dentro do preço líquido',
      acimaDaReceita.length > 0 ? 'vermelho' : 'verde',
      `${acimaDaReceita.length}`,
      acimaDaReceita.length === 0
        ? 'Toda venda sobra caixa para o projeto depois do release.'
        : `${acimaDaReceita
            .map((x) => `${x.nome}: release de ${dinheiro(x.release)} contra ${dinheiro(x.liquido)} de preço líquido`)
            .join('; ')}. Nessas tipologias a venda não gera caixa nenhum para o projeto — o banco leva mais do que entra.`,
      'Reduza o release por unidade, ou reveja o preço de venda e as comissões da tipologia.',
    );
  }

  // ─── Curva do benchmark ────────────────────────────────────────────────────
  // Restrita a tipoTaxa = 'variavel': com o DEFAULT 'fixa' da migration
  // 1762500000 a conferência é inalcançável.
  if (fin.tipoTaxa === 'variavel') {
    const naCurva = new Set((fin.benchmarkCurva ?? []).map((p) => Math.trunc(p.mes)));
    const semPonto: number[] = [];
    for (let m = 1; m <= cronograma.prazoTotal; m++) if (!naCurva.has(m)) semPonto.push(m);
    add(
      'benchmark_incompleto',
      'Curva do benchmark completa',
      semPonto.length > 0 ? 'ambar' : 'verde',
      `${semPonto.length}`,
      semPonto.length > 0
        ? `${semPonto.length} de ${cronograma.prazoTotal} meses não têm ponto na curva e usam o padrão de ${pct(fin.benchmarkPadrao || 0)}. Mês SEM linha não é benchmark zero — cai no padrão.`
        : `Todos os ${cronograma.prazoTotal} meses têm ponto na curva.`,
      'Use "preencher tudo com o padrão" na aba Financiamento e ajuste os meses que divergirem.',
    );
  }

  // ─── Obra sem meses de construção ──────────────────────────────────────────
  if (agregados.obraTotal > 0 && Math.trunc(input.mesesConstrucao) <= 0) {
    add(
      'obra_sem_prazo',
      'Obra sem prazo de construção',
      'vermelho',
      dinheiro(agregados.obraTotal),
      'Há custo de obra mas o cronograma tem zero meses de construção — o custo não é lançado em mês nenhum.',
      'Informe os meses de construção nas premissas.',
    );
  }

  return lista;
}

/**
 * Só estes QUATRO casos impedem SALVAR. Todo o resto é sinalização — o cálculo
 * continua rodando e devolvendo resultado mesmo com conferência vermelha.
 *
 * O critério é o mesmo nos quatro: são inputs em que gravar o estado inconsistente
 * produziria uma modelagem que ninguém consegue interpretar depois.
 *
 *   soma_participacoes — rateio que não soma 100% distribui LUCRO que não existe;
 *   soma_pct_capital   — idem para o CAPITAL, na regra 'pct_capital': a fração de
 *                        cada sócio multiplica o equity_call de todo mês, então
 *                        um total ≠ 100% produz rateio errado em toda a tela —
 *                        capital, MOIC, ROI e TIR de cada sócio;
 *   divisao_lucro      — idem para a divisão entre investidores e sponsor;
 *   alocacao_fases     — unidade não alocada some do fluxo: a modelagem passaria a
 *                        mostrar um custo de obra menor que o das próprias
 *                        tipologias, sem nada na tela explicando a diferença.
 *
 * A quarta entrou por decisão explícita do usuário, que definiu a distribuição
 * por fase como obrigatória quando o projeto é faseado. Sem esta lista, quem ler
 * o arquivo depois vai achar que é bug — não é.
 *
 * `soma_pct_capital` só existe na regra 'pct_capital', então nenhuma modelagem
 * já gravada passa a ser bloqueada por ela.
 */
export function bloqueiaSalvamento(conferencias: Conferencia[]): Conferencia[] {
  const BLOQUEANTES = [
    'soma_participacoes',
    'soma_pct_capital',
    'divisao_lucro',
    'alocacao_fases',
  ];
  return conferencias.filter((c) => BLOQUEANTES.includes(c.chave) && c.semaforo === 'vermelho');
}
