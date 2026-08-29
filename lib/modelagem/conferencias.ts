/**
 * Painel de validação da modelagem.
 *
 * Conferências NUNCA bloqueiam o cálculo — só sinalizam. Bloquear o SALVAMENTO é
 * outra coisa, e vale para dois casos apenas: soma das participações e divisão do
 * lucro fora de 100% (ver `bloqueiaSalvamento`).
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
  Semaforo,
} from './tipos';
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

  // ─── Caixa mínimo acumulado ────────────────────────────────────────────────
  const caixaMinimo = meses.length ? Math.min(...meses.map((m) => m.caixaAcumulado)) : 0;
  const mesDoMinimo = meses.find((m) => m.caixaAcumulado === caixaMinimo)?.mes ?? 0;
  add(
    'caixa_minimo',
    'Caixa mínimo acumulado',
    caixaMinimo < -TOLERANCIA ? 'vermelho' : caixaMinimo < colchao - TOLERANCIA ? 'ambar' : 'verde',
    dinheiro(caixaMinimo),
    caixaMinimo < -TOLERANCIA
      ? `O caixa fica negativo no mês ${mesDoMinimo}.`
      : caixaMinimo < colchao - TOLERANCIA
        ? `O caixa cai abaixo do colchão de ${dinheiro(colchao)} no mês ${mesDoMinimo}.`
        : 'O caixa nunca fica descoberto.',
    'Aumente o aporte do mês, antecipe saque do financiamento ou reduza o colchão mínimo.',
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
  const temTeto = Number.isFinite(apuracao.tetoDivida);
  add(
    'teto_divida',
    'Saque dentro do teto de dívida',
    !temTeto
      ? 'ambar'
      : apuracao.dividaSacada <= apuracao.tetoDivida + TOLERANCIA
        ? 'verde'
        : 'vermelho',
    temTeto
      ? `${dinheiro(apuracao.dividaSacada)} de ${dinheiro(apuracao.tetoDivida)}`
      : dinheiro(apuracao.dividaSacada),
    !temTeto
      ? 'Nenhum teto definido: nem LTC máximo, nem valor contratado.'
      : apuracao.dividaSacada <= apuracao.tetoDivida + TOLERANCIA
        ? 'O total sacado respeita o teto.'
        : 'O total sacado ultrapassa o teto — só acontece com override manual de saque.',
    'Defina LTC máximo ou valor contratado na aba Financiamento, ou reverta os overrides de saque.',
  );

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
 * Só estes dois casos impedem SALVAR. Todo o resto é sinalização — o cálculo
 * continua rodando e devolvendo resultado mesmo com conferência vermelha.
 */
export function bloqueiaSalvamento(conferencias: Conferencia[]): Conferencia[] {
  return conferencias.filter(
    (c) => (c.chave === 'soma_participacoes' || c.chave === 'divisao_lucro') && c.semaforo === 'vermelho',
  );
}
