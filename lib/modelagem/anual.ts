/**
 * Demonstração de resultado por ANO-CALENDÁRIO.
 *
 * Derivação PURA do fluxo que o motor já produziu: nenhum input novo, nenhuma
 * migration, e — por construção — nenhum risco de divergir do motor, porque cada
 * número aqui é uma soma de `ModelOutput.meses`, não uma conta refeita.
 *
 * A única grandeza que precisa ser DESFEITA é a receita: `MesFluxo.revenue` já
 * chega líquida de comissão e cartório, e a demonstração precisa mostrar a bruta
 * e os dois descontos separados. O caminho de volta está em `fatoresDaReceita`.
 */
import type { ModelOutput } from './tipos';

/** Uma coluna da demonstração: um ano-calendário do cronograma. */
export interface ApuracaoAnual {
  /** Ano-calendário, como aparece em `MesFluxo.data`. */
  ano: number;
  /** Quantos meses do cronograma caem neste ano. O primeiro e o último são parciais. */
  meses: number;

  receitaBruta: number;
  comissoes: number;
  cartorio: number;
  receitaLiquida: number;

  custoTerrenos: number;
  custoObra: number;
  custoPropertyTax: number;
  custoOutros: number;
  /** Soma das quatro linhas acima. */
  custoEmpreendimento: number;

  jurosTotais: number;
  feeTotal: number;
  /** juros + fee do ano. */
  custoFinanceiro: number;

  /** receitaLiquida − custoEmpreendimento − custoFinanceiro. */
  resultado: number;
  /** Σ dos resultados deste ano e dos anteriores. */
  resultadoAcumulado: number;
}

/**
 * Como voltar da receita LÍQUIDA do fluxo para a bruta e seus descontos.
 *
 * A apuração do projeto conhece os três números — bruta, comissões, cartório —,
 * então as proporções saem dela, e não do `ModelInput`: assim a função continua
 * recebendo só o `ModelOutput`, e um dia em que a comissão passe a variar por
 * tipologia esta conta continua sendo a média efetivamente praticada.
 *
 * Sem receita bruta apurada não há proporção a extrair; nesse caso a receita do
 * fluxo é tratada como já líquida e os descontos ficam em zero. É o que evita
 * dividir por zero e inventar comissão onde não houve venda.
 */
function fatoresDaReceita(saida: ModelOutput) {
  const { receitaBruta, comissoes, cartorio } = saida.apuracao;
  if (!Number.isFinite(receitaBruta) || Math.abs(receitaBruta) < 1e-9) {
    return { porLiquida: 1, pctComissao: 0, pctCartorio: 0 };
  }
  const pctComissao = comissoes / receitaBruta;
  const pctCartorio = cartorio / receitaBruta;
  const fatorLiquido = 1 - pctComissao - pctCartorio;
  return {
    // Multiplicador que leva da receita líquida do mês de volta à bruta.
    porLiquida: Math.abs(fatorLiquido) < 1e-9 ? 1 : 1 / fatorLiquido,
    pctComissao,
    pctCartorio,
  };
}

const anoDe = (dataIso: string): number => {
  const n = Number(String(dataIso).slice(0, 4));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Demonstração por ano-calendário, em ordem crescente de ano.
 *
 * ── O que fecha, e por quê ───────────────────────────────────────────────────
 * Σ custoEmpreendimento, Σ juros e Σ fee dos anos batem EXATAMENTE com
 * `apuracao`, porque a apuração do projeto é somada dos mesmos meses.
 *
 * Σ resultado dos anos = `apuracao.lucroProjeto` sempre que a receita lançada no
 * fluxo for igual à receita apurada a partir do VGV. Quando não for — override na
 * linha de receita, venda em mês fora do prazo, preço próprio num takedown —, a
 * demonstração anual segue o FLUXO, que é o que de fato aconteceu, e a divergência
 * já tem conferência própria: `receita_lancada`. Preferir o fluxo é deliberado:
 * uma demonstração que ignorasse o override mostraria receita que não entrou.
 *
 * Ano sem mês nenhum não existe na saída — a lista tem só os anos que o
 * cronograma toca.
 */
export function apuracaoAnual(saida: ModelOutput): ApuracaoAnual[] {
  const { porLiquida, pctComissao, pctCartorio } = fatoresDaReceita(saida);

  const porAno = new Map<number, ApuracaoAnual>();
  for (const m of saida.meses) {
    const ano = anoDe(m.data);
    let linha = porAno.get(ano);
    if (!linha) {
      linha = {
        ano,
        meses: 0,
        receitaBruta: 0,
        comissoes: 0,
        cartorio: 0,
        receitaLiquida: 0,
        custoTerrenos: 0,
        custoObra: 0,
        custoPropertyTax: 0,
        custoOutros: 0,
        custoEmpreendimento: 0,
        jurosTotais: 0,
        feeTotal: 0,
        custoFinanceiro: 0,
        resultado: 0,
        resultadoAcumulado: 0,
      };
      porAno.set(ano, linha);
    }

    linha.meses += 1;

    // Comissão e cartório incidem sobre a receita DO ANO, não sobre o VGV total:
    // ratear o desconto do projeto inteiro pelos anos colocaria comissão em ano
    // sem venda nenhuma.
    const bruta = m.revenue * porLiquida;
    linha.receitaBruta += bruta;
    linha.comissoes += bruta * pctComissao;
    linha.cartorio += bruta * pctCartorio;
    // Somado do próprio fluxo, e não de `bruta − descontos`: assim o total dos
    // anos fecha com Σ meses.revenue por identidade, sem depender do arredondamento
    // do caminho de volta.
    linha.receitaLiquida += m.revenue;

    linha.custoTerrenos += m.land;
    linha.custoObra += m.construction;
    linha.custoPropertyTax += m.propertyTax;
    linha.custoOutros += m.otherCosts;
    linha.jurosTotais += m.juros;
    linha.feeTotal += m.fee;
  }

  const anos = [...porAno.values()].sort((a, b) => a.ano - b.ano);
  let acumulado = 0;
  for (const linha of anos) {
    linha.custoEmpreendimento =
      linha.custoTerrenos + linha.custoObra + linha.custoPropertyTax + linha.custoOutros;
    linha.custoFinanceiro = linha.jurosTotais + linha.feeTotal;
    linha.resultado = linha.receitaLiquida - linha.custoEmpreendimento - linha.custoFinanceiro;
    acumulado += linha.resultado;
    linha.resultadoAcumulado = acumulado;
  }
  return anos;
}

/**
 * Coluna "Total" da demonstração: a soma das colunas de ano.
 *
 * Existe para a tela e a planilha não somarem por conta própria — se o total
 * divergir das colunas, é bug de leitura, não de cálculo. `ano` vem como 0 e
 * `resultadoAcumulado` repete `resultado`, porque um total não tem ano nem
 * acumulado próprio.
 */
export function totalAnual(anos: ApuracaoAnual[]): ApuracaoAnual {
  const zero: ApuracaoAnual = {
    ano: 0,
    meses: 0,
    receitaBruta: 0,
    comissoes: 0,
    cartorio: 0,
    receitaLiquida: 0,
    custoTerrenos: 0,
    custoObra: 0,
    custoPropertyTax: 0,
    custoOutros: 0,
    custoEmpreendimento: 0,
    jurosTotais: 0,
    feeTotal: 0,
    custoFinanceiro: 0,
    resultado: 0,
    resultadoAcumulado: 0,
  };
  const total = anos.reduce<ApuracaoAnual>(
    (a, x) => ({
      ...a,
      meses: a.meses + x.meses,
      receitaBruta: a.receitaBruta + x.receitaBruta,
      comissoes: a.comissoes + x.comissoes,
      cartorio: a.cartorio + x.cartorio,
      receitaLiquida: a.receitaLiquida + x.receitaLiquida,
      custoTerrenos: a.custoTerrenos + x.custoTerrenos,
      custoObra: a.custoObra + x.custoObra,
      custoPropertyTax: a.custoPropertyTax + x.custoPropertyTax,
      custoOutros: a.custoOutros + x.custoOutros,
      custoEmpreendimento: a.custoEmpreendimento + x.custoEmpreendimento,
      jurosTotais: a.jurosTotais + x.jurosTotais,
      feeTotal: a.feeTotal + x.feeTotal,
      custoFinanceiro: a.custoFinanceiro + x.custoFinanceiro,
      resultado: a.resultado + x.resultado,
    }),
    zero,
  );
  total.resultadoAcumulado = total.resultado;
  return total;
}

/** Linhas da demonstração, na ordem em que a tela e a planilha as mostram. */
export const LINHAS_ANUAL: {
  chave: keyof ApuracaoAnual;
  rotulo: string;
  /** Entra na demonstração como dedução — a tela mostra entre parênteses. */
  deducao?: boolean;
  subtotal?: boolean;
  total?: boolean;
}[] = [
  { chave: 'receitaBruta', rotulo: 'Receita bruta' },
  { chave: 'comissoes', rotulo: '(−) Comissões', deducao: true },
  { chave: 'cartorio', rotulo: '(−) Cartório / closing', deducao: true },
  { chave: 'receitaLiquida', rotulo: '(=) Receita líquida', subtotal: true },
  { chave: 'custoTerrenos', rotulo: '(−) Terrenos', deducao: true },
  { chave: 'custoObra', rotulo: '(−) Obra', deducao: true },
  { chave: 'custoPropertyTax', rotulo: '(−) Property taxes', deducao: true },
  { chave: 'custoOutros', rotulo: '(−) Outros custos', deducao: true },
  { chave: 'custoEmpreendimento', rotulo: '(=) Custo do empreendimento', subtotal: true, deducao: true },
  { chave: 'jurosTotais', rotulo: '(−) Juros', deducao: true },
  { chave: 'feeTotal', rotulo: '(−) Fee de estruturação', deducao: true },
  { chave: 'custoFinanceiro', rotulo: '(=) Custo financeiro', subtotal: true, deducao: true },
  { chave: 'resultado', rotulo: '(=) Resultado do ano', total: true },
  { chave: 'resultadoAcumulado', rotulo: 'Resultado acumulado' },
];
