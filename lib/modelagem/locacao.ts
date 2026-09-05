/**
 * A PONTE ARITMÉTICA ATÉ O NOI, e as premissas que a alimentam.
 *
 * O relatório para sócios usava um NOI de referência para gerar um valor de
 * saída que é quase toda a receita do projeto — e nunca mostrava de onde o NOI
 * vinha. Um investidor não tem como auditar um número que aparece pronto.
 *
 * Esta é a cadeia inteira, em dinheiro por ANO, cada elo saindo do input e do
 * `ModelOutput` que o motor já produziu:
 *
 *   receita potencial → (−) vacância → (−) perda de crédito → (=) receita efetiva
 *                     → (−) OPEX bruto → (+) reembolso → (=) NOI estabilizado
 *                     → ÷ cap → valor de saída → (−) custo de venda
 *
 * Derivação PURA, como `anual.ts`: nenhum input novo, nenhuma migration. O motor
 * não muda.
 *
 * ── Por que a cadeia é refeita aqui, e não lida do motor ────────────────────
 * O motor calcula o NOI de referência numa expressão só (`noiReferencia`, em
 * motor.ts) e guarda apenas o RESULTADO em `Indicadores.noiEstabilizado`. Os elos
 * do meio — a vacância em dinheiro, o reembolso anual — não existem em lugar
 * nenhum da saída. Refazê-los aqui só é seguro porque o último elo é conferido
 * contra o motor: `divergenciaNoi` é a diferença entre esta cadeia e o
 * `noiEstabilizado` que o motor apurou, e há teste cobrando que ela seja zero.
 * Se um dia a fórmula do motor mudar e esta não, o teste quebra alto.
 */
import type { ModelInput, ModelOutput, NoiReferencia } from './tipos';

/** Um elo da cadeia, na ordem em que o relatório o imprime. */
export interface EloNoi {
  rotulo: string;
  valor: number;
  /** Entra na cadeia subtraindo — o relatório mostra entre parênteses. */
  deducao?: boolean;
  /** Fecha um trecho da cadeia: receita efetiva, NOI, valor de saída. */
  subtotal?: boolean;
  /** A frase que explica de onde o número saiu. Vazia quando é evidente. */
  memoria?: string;
}

export interface PonteNoi {
  /** Qual NOI o modelo usa para dividir pelo cap. */
  modo: NoiReferencia;

  /** Receita de aluguel anual a 100% de ocupação: Σ (área × aluguel/sf). */
  receitaPotencial: number;
  /** Fração da receita potencial que a ocupação estabilizada não captura. */
  vacanciaPct: number;
  vacancia: number;
  receitaFaturada: number;
  perdaCreditoPct: number;
  perdaCredito: number;
  /** `receitaFaturada − perdaCredito`. */
  receitaEfetiva: number;

  /** Σ (linha de OPEX × ABL). NÃO varia com a ocupação. */
  opexBruto: number;
  /** Parte do OPEX que os inquilinos reembolsam, proporcional à ocupação. */
  reembolso: number;
  taxaReembolsoPct: number;
  /** `receitaEfetiva − opexBruto + reembolso`. */
  noiEstabilizado: number;

  /**
   * O NOI que o motor de fato usou como numerador do valor de saída. Igual a
   * `noiEstabilizado` no modo 'estabilizado'; no modo 'ultimos_12m' é a soma dos
   * doze `noiMes` que terminam no mês de saída, e aí os dois divergem de
   * propósito — a cadeia continua sendo a leitura do ativo maduro.
   */
  noiUsado: number | null;
  /**
   * `noiEstabilizado` desta cadeia menos o `noiEstabilizado` do motor, no modo
   * 'estabilizado'. Tem de ser ZERO, e há teste cobrando. `null` no modo
   * 'ultimos_12m', onde as duas grandezas não são a mesma coisa.
   */
  divergenciaNoi: number | null;

  capRateSaida: number;
  /** `noiUsado ÷ cap`, ANTES do custo de venda — é `Indicadores.valorSaida`. */
  valorSaida: number | null;
  custoVendaPct: number;
  custoVenda: number;
  /** O que de fato entra no caixa no mês da saída. */
  valorSaidaLiquido: number | null;
}

const soma = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/**
 * A cadeia, do aluguel potencial ao valor de saída líquido.
 *
 * Devolve `null` fora do modo locação: num projeto de venda não há ativo a
 * locar, e uma cadeia zerada seria pior que a ausência dela — o relatório
 * mostraria uma seção inteira de traços.
 */
export function ponteNoi(input: ModelInput, saida: ModelOutput): PonteNoi | null {
  if ((input.tipoModelagem ?? 'venda') !== 'locacao') return null;

  const loc = input.locacao;
  const ablSf = saida.agregados.ablSf;
  const ocupacao = loc?.ocupacaoEstabilizadaPct ?? 0;
  const perdaCreditoPct = loc?.perdaCreditoPct ?? 0;
  const taxaReembolsoPct = loc?.taxaReembolsoPct ?? 0;
  const capRateSaida = loc?.capRateSaida ?? 0;
  const custoVendaPct = loc?.custoVendaPct ?? 0;

  const receitaPotencial = saida.agregados.receitaBrutaAnual100;
  const receitaFaturada = receitaPotencial * ocupacao;
  // A perda de crédito incide sobre a receita FATURADA, não sobre a receita a
  // 100%: inquilino que não existe não deixa de pagar. É a mesma regra do motor,
  // e a razão de a vacância vir antes dela na cadeia.
  const perdaCredito = receitaFaturada * perdaCreditoPct;
  const receitaEfetiva = receitaFaturada - perdaCredito;

  const linhas = input.opex ?? [];
  const opexBruto = soma(linhas.map((l) => (l.valorSfAno || 0) * ablSf));
  // Só quem está no prédio reembolsa — por isso o reembolso acompanha a ocupação
  // e o OPEX bruto não. É exatamente isso que faz o NOI ser negativo em ocupação
  // baixa, e é o que a cadeia precisa deixar visível.
  const opexReembolsavel = soma(
    linhas.filter((l) => l.reembolsavel !== false).map((l) => (l.valorSfAno || 0) * ablSf),
  );
  const reembolso = opexReembolsavel * taxaReembolsoPct * ocupacao;
  const noiEstabilizado = receitaEfetiva - opexBruto + reembolso;

  const modo = loc?.noiReferencia ?? 'estabilizado';
  const noiUsado = saida.indicadores.noiEstabilizado;
  const valorSaida = saida.indicadores.valorSaida;
  const custoVenda = (valorSaida ?? 0) * custoVendaPct;

  return {
    modo,
    receitaPotencial,
    vacanciaPct: 1 - ocupacao,
    vacancia: receitaPotencial - receitaFaturada,
    receitaFaturada,
    perdaCreditoPct,
    perdaCredito,
    receitaEfetiva,
    opexBruto,
    reembolso,
    taxaReembolsoPct,
    noiEstabilizado,
    noiUsado,
    divergenciaNoi:
      modo === 'estabilizado' && noiUsado !== null ? noiEstabilizado - noiUsado : null,
    capRateSaida,
    valorSaida,
    custoVendaPct,
    custoVenda,
    valorSaidaLiquido: valorSaida === null ? null : valorSaida - custoVenda,
  };
}

/**
 * A cadeia como LINHAS, na ordem em que o relatório e a tela a imprimem.
 *
 * Separada de `ponteNoi` porque a cadeia é um objeto de números — auditável e
 * testável campo a campo — e a lista é uma leitura dela. Quem desenha não decide
 * a ordem nem os rótulos, e por isso os dois consumidores não podem divergir.
 */
export function linhasDaPonteNoi(ponte: PonteNoi): EloNoi[] {
  const pctBr = (v: number, casas = 1) => `${(v * 100).toFixed(casas).replace('.', ',')}%`;
  return [
    {
      rotulo: 'Receita potencial de aluguel (100% de ocupação)',
      valor: ponte.receitaPotencial,
      memoria: 'ABL x aluguel por sf/ano',
    },
    {
      rotulo: `(-) Vacância (${pctBr(ponte.vacanciaPct)})`,
      valor: ponte.vacancia,
      deducao: true,
      memoria: 'ocupação estabilizada declarada no modelo',
    },
    {
      rotulo: `(-) Perda de crédito (${pctBr(ponte.perdaCreditoPct)})`,
      valor: ponte.perdaCredito,
      deducao: true,
      memoria: 'incide sobre a receita faturada, não sobre a receita a 100%',
    },
    { rotulo: '(=) Receita efetiva', valor: ponte.receitaEfetiva, subtotal: true },
    {
      rotulo: '(-) OPEX bruto',
      valor: ponte.opexBruto,
      deducao: true,
      memoria: 'não varia com a ocupação: prédio vazio custa o mesmo',
    },
    {
      rotulo: `(+) Reembolso dos inquilinos (${pctBr(ponte.taxaReembolsoPct)} do OPEX reembolsável)`,
      valor: ponte.reembolso,
      memoria: 'proporcional à ocupação: só quem está lá paga',
    },
    { rotulo: '(=) NOI estabilizado', valor: ponte.noiEstabilizado, subtotal: true },
    {
      rotulo: `(÷) Cap rate de saída (${pctBr(ponte.capRateSaida, 2)})`,
      valor: ponte.valorSaida ?? 0,
      subtotal: true,
      memoria: 'exigido pelo comprador do ativo estabilizado',
    },
    {
      rotulo: `(-) Custo de venda (${pctBr(ponte.custoVendaPct, 2)})`,
      valor: ponte.custoVenda,
      deducao: true,
    },
    {
      rotulo: '(=) Valor de saída líquido',
      valor: ponte.valorSaidaLiquido ?? 0,
      subtotal: true,
      memoria: 'é o que entra no caixa no mês da saída',
    },
  ];
}

/**
 * O ativo, tipologia a tipologia, nas grandezas da OPERAÇÃO.
 *
 * A tabela "O ativo" do relatório mostrava preço por unidade e preço total — as
 * duas colunas de um projeto de venda, e as duas zeradas num de locação. O que
 * ocupa esse lugar é ABL, aluguel por sf, NOI por sf e valor de saída por sf.
 *
 * ── Por que o NOI por sf é EXATO por tipologia, e não um rateio ─────────────
 * A única premissa de operação que varia por tipologia é `aluguelSfAno`. Todo o
 * resto — OPEX por sf, taxa de reembolso, ocupação estabilizada, perda de
 * crédito, cap rate — é uma taxa sobre a ABL, igual em todo o ativo. Então o NOI
 * por sf de uma tipologia é o mesmo cálculo do NOI de referência, aplicado ao
 * aluguel dela:
 *
 *   noiSf = aluguel/sf x ocupação x (1 − perda) − opex/sf + reembolso/sf
 *
 * e Σ (noiSf x ABL da tipologia) reconstitui EXATAMENTE `noiEstabilizado`. Há
 * teste cobrando essa identidade. Não há rateio nenhum aqui: se houvesse, seria
 * número inventado, e número inventado não entra no relatório.
 */
export interface AtivoPorTipologia {
  nome: string;
  quantidade: number;
  /** Área bruta locável da tipologia inteira: área unitária x quantidade. */
  ablSf: number;
  /** Aluguel pedido, por sf e por ano. É a única premissa que varia por tipologia. */
  aluguelSfAno: number;
  /** NOI anual por sf de ABL. Ver o comentário da interface: é exato, não rateado. */
  noiSf: number;
  /** `noiSf ÷ cap`. Zero quando o cap é zero — nunca Infinity. */
  valorSaidaSf: number;
}

export function ativoPorTipologia(input: ModelInput): AtivoPorTipologia[] {
  if ((input.tipoModelagem ?? 'venda') !== 'locacao') return [];

  const loc = input.locacao;
  const ocupacao = loc?.ocupacaoEstabilizadaPct ?? 0;
  const perdaCreditoPct = loc?.perdaCreditoPct ?? 0;
  const taxaReembolsoPct = loc?.taxaReembolsoPct ?? 0;
  const capRateSaida = loc?.capRateSaida ?? 0;

  // As taxas de OPEX são POR SF de ABL — é assim que `LinhaOpex` as declara —,
  // então já chegam na unidade da conta e não precisam de denominador nenhum.
  const linhas = input.opex ?? [];
  const opexSf = soma(linhas.map((l) => l.valorSfAno || 0));
  const opexReembolsavelSf = soma(
    linhas.filter((l) => l.reembolsavel !== false).map((l) => l.valorSfAno || 0),
  );
  const reembolsoSf = opexReembolsavelSf * taxaReembolsoPct * ocupacao;

  return input.unidades.map((u, i) => {
    const quantidade = Math.max(1, Math.trunc(u.quantidade || 1));
    const aluguelSfAno = u.aluguelSfAno || 0;
    const noiSf = aluguelSfAno * ocupacao * (1 - perdaCreditoPct) - opexSf + reembolsoSf;
    return {
      nome: u.nome || `Tipologia ${i + 1}`,
      quantidade,
      ablSf: (u.areaSf || 0) * quantidade,
      aluguelSfAno,
      noiSf,
      // Mesma guarda do motor: cap zero devolve ZERO, nunca Infinity.
      valorSaidaSf: capRateSaida > 0 ? noiSf / capRateSaida : 0,
    };
  });
}
