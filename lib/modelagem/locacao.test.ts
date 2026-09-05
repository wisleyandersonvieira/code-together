/**
 * As IDENTIDADES do modo locação — o que o relatório afirma e tem de fechar.
 *
 * Cada teste aqui cobra uma igualdade entre duas leituras da MESMA grandeza. Não
 * são testes de valor esperado escrito à mão: são testes de que as leituras não
 * podem divergir. É a única forma de guarda que sobrevive a uma mudança de
 * premissa da fixture.
 */
import { describe, expect, it } from 'vitest';
import {
  apuracaoAnual,
  ativoPorTipologia,
  calcular,
  gradeCapObra,
  linhasAnuaisVisiveis,
  ponteNoi,
  pontosDeEquilibrioLocacao,
  totalAnual,
} from './index';
import type { ModelInput } from './index';
import { locacaoDoBanco, vendaDoBanco } from '@/components/modelagem/fixturesModelagem';

/** Igualdade AO CENTAVO. Não é tolerância: é a mesma moeda, arredondada uma vez. */
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Uma locação com duas tipologias de aluguel diferente e lease-up de verdade. */
const duasTipologias = (): ModelInput => {
  const input = locacaoDoBanco();
  input.unidades = [
    { nome: 'Torre A', quantidade: 1, areaSf: 30_000, aluguelSfAno: 32, custoTerreno: 1_000_000, custoObra: 6_000_000, precoVenda: 0, propertyTaxAno: 0 },
    { nome: 'Torre B', quantidade: 2, areaSf: 9_000, aluguelSfAno: 41, custoTerreno: 300_000, custoObra: 1_600_000, precoVenda: 0, propertyTaxAno: 0 },
  ];
  input.locacao = { ...input.locacao!, ocupacaoEstabilizadaPct: 0.93 };
  // Lease-up em degraus, e não estabilizado no primeiro mês: é o que exercita a
  // curva de ocupação e faz a receita de aluguel do fluxo ser menor que o teto.
  input.ocupacao = [
    { mes: 19, ocupacaoPct: 0.3 },
    { mes: 20, ocupacaoPct: 0.5 },
    { mes: 21, ocupacaoPct: 0.75 },
    ...Array.from({ length: 15 }, (_, k) => ({ mes: 22 + k, ocupacaoPct: 0.93 })),
  ];
  return input;
};

const CENARIOS: [string, () => ModelInput][] = [
  ['venda', vendaDoBanco],
  ['locação, uma tipologia', locacaoDoBanco],
  ['locação, duas tipologias e lease-up', duasTipologias],
];

// ─── P&L anual ───────────────────────────────────────────────────────────────

describe('P&L por ano-calendário fecha com a apuração', () => {
  for (const [rotulo, montar] of CENARIOS) {
    it(`${rotulo}: o Resultado do ano (Total) é o LUCRO DO PROJETO, ao centavo`, () => {
      const saida = calcular(montar());
      const total = totalAnual(apuracaoAnual(saida));
      // Igualdade, não tolerância. As duas somas percorrem os mesmos meses em
      // ordens diferentes — a anual por ano, a apuração de uma vez —, e a única
      // diferença admissível é a última casa binária, que o arredondamento a
      // centavo resolve. Era esta identidade que estava quebrada: a demonstração
      // anual ignorava aluguel e OPEX e sobrava a diferença entre os dois.
      expect(centavos(total.resultado)).toBe(centavos(saida.apuracao.lucroProjeto));
    });

    it(`${rotulo}: as parcelas do ano batem com as da apuração`, () => {
      const saida = calcular(montar());
      const total = totalAnual(apuracaoAnual(saida));
      const ap = saida.apuracao;
      expect(centavos(total.receitaAluguel)).toBe(centavos(ap.receitaAluguel));
      expect(centavos(total.opex)).toBe(centavos(ap.opexTotal));
      expect(centavos(total.custoEmpreendimento)).toBe(centavos(ap.custoEmpreendimento));
      expect(centavos(total.receitaLiquida)).toBe(centavos(ap.receitaLiquida));
      expect(centavos(total.custoFinanceiro)).toBe(centavos(ap.custoFinanceiro));
    });

    it(`${rotulo}: cada coluna de ano fecha na própria conta`, () => {
      for (const ano of apuracaoAnual(calcular(montar()))) {
        expect(centavos(ano.receitaLiquida)).toBe(
          centavos(ano.receitaAluguel + ano.receitaBruta - ano.comissoes - ano.cartorio),
        );
        expect(centavos(ano.custoEmpreendimento)).toBe(
          centavos(
            ano.custoTerrenos + ano.custoObra + ano.custoPropertyTax + ano.custoOutros + ano.opex,
          ),
        );
        expect(centavos(ano.resultado)).toBe(
          centavos(ano.receitaLiquida - ano.custoEmpreendimento - ano.custoFinanceiro),
        );
      }
    });
  }

  it('as linhas de locação só aparecem no projeto que as tem', () => {
    const rotulos = (input: ModelInput) =>
      linhasAnuaisVisiveis(apuracaoAnual(calcular(input))).map((l) => l.chave);

    // Em venda são zero em todo ano — linha zerada não é informação.
    expect(rotulos(vendaDoBanco())).not.toContain('receitaAluguel');
    expect(rotulos(vendaDoBanco())).not.toContain('opex');
    expect(rotulos(locacaoDoBanco())).toContain('receitaAluguel');
    expect(rotulos(locacaoDoBanco())).toContain('opex');
  });

  it('a receita de aluguel entra ACIMA da bruta, e o OPEX dentro do custo', () => {
    const chaves = linhasAnuaisVisiveis(apuracaoAnual(calcular(locacaoDoBanco()))).map(
      (l) => l.chave,
    );
    expect(chaves.indexOf('receitaAluguel')).toBeLessThan(chaves.indexOf('receitaBruta'));
    expect(chaves.indexOf('opex')).toBeGreaterThan(chaves.indexOf('custoOutros'));
    expect(chaves.indexOf('opex')).toBeLessThan(chaves.indexOf('custoEmpreendimento'));
  });
});

// ─── A ponte até o NOI ───────────────────────────────────────────────────────

describe('a ponte do aluguel ao valor de saída', () => {
  for (const [rotulo, montar] of CENARIOS.slice(1)) {
    it(`${rotulo}: a cadeia reconstitui o NOI que o motor apurou`, () => {
      const input = montar();
      const ponte = ponteNoi(input, calcular(input))!;
      // Zero EXATO: a cadeia é a mesma expressão do motor, aberta elo a elo. Se
      // um dia a fórmula do motor mudar e esta não, esta linha quebra.
      expect(ponte.divergenciaNoi).not.toBeNull();
      expect(centavos(ponte.divergenciaNoi as number)).toBe(0);
    });

    it(`${rotulo}: a cadeia fecha elo a elo`, () => {
      const input = montar();
      const ponte = ponteNoi(input, calcular(input))!;
      expect(centavos(ponte.receitaEfetiva)).toBe(
        centavos(ponte.receitaPotencial - ponte.vacancia - ponte.perdaCredito),
      );
      expect(centavos(ponte.noiEstabilizado)).toBe(
        centavos(ponte.receitaEfetiva - ponte.opexBruto + ponte.reembolso),
      );
      // O valor de saída é o do MOTOR; o que se cobra é que ele seja o NOI usado
      // dividido pelo cap — a conta que a página promete que o leitor pode
      // refazer com lápis e papel.
      expect(centavos(ponte.valorSaida as number)).toBe(
        centavos((ponte.noiUsado as number) / ponte.capRateSaida),
      );
      expect(centavos(ponte.valorSaidaLiquido as number)).toBe(
        centavos((ponte.valorSaida as number) - ponte.custoVenda),
      );
    });

    it(`${rotulo}: o NOI por sf das tipologias reconstitui o NOI do ativo`, () => {
      const input = montar();
      const saida = calcular(input);
      const linhas = ativoPorTipologia(input);
      const noi = linhas.reduce((a, l) => a + l.noiSf * l.ablSf, 0);
      // Exato, e não rateado: a única premissa que varia por tipologia é o
      // aluguel por sf. Se um dia outra passar a variar, esta linha quebra — e
      // é isso que se quer, porque aí o rateio deixaria de ser exato.
      expect(centavos(noi)).toBe(centavos(saida.indicadores.noiEstabilizado as number));
      expect(linhas.reduce((a, l) => a + l.ablSf, 0)).toBeCloseTo(saida.agregados.ablSf, 6);
    });
  }

  it('não existe ponte num projeto de venda', () => {
    const input = vendaDoBanco();
    expect(ponteNoi(input, calcular(input))).toBeNull();
    expect(ativoPorTipologia(input)).toEqual([]);
  });
});

// ─── Sensibilidade por cap ───────────────────────────────────────────────────

describe('sensibilidade ao cap de saída', () => {
  it('a matriz de cap NÃO é constante — era esse o defeito da de preço', () => {
    const input = locacaoDoBanco();
    // Duas linhas e duas colunas bastam: o que se cobra é que os dois eixos
    // MOVAM o lucro. A matriz de preço movia só o eixo de obra, e a capa
    // concluía dali que não havia risco de queda.
    const grade = gradeCapObra(input, [-50, 100], [0, 0.1]);
    expect(grade[0][0].lucroProjeto).not.toBeCloseTo(grade[1][0].lucroProjeto, 2);
    expect(grade[0][0].lucroProjeto).not.toBeCloseTo(grade[0][1].lucroProjeto, 2);
    // Cap maior é comprador pagando menos: o lucro tem de CAIR.
    expect(grade[1][0].lucroProjeto).toBeLessThan(grade[0][0].lucroProjeto);
  });

  it('o cap central da grade é o cap contratado', () => {
    const input = locacaoDoBanco();
    const grade = gradeCapObra(input, [0], [0]);
    expect(grade[0][0].capRate).toBeCloseTo(input.locacao!.capRateSaida, 10);
    expect(centavos(grade[0][0].lucroProjeto)).toBe(
      centavos(calcular(input).apuracao.lucroProjeto),
    );
  });

  it('o cap máximo zera o lucro, e a expansão em bps é a distância até ele', () => {
    const input = locacaoDoBanco();
    const eq = pontosDeEquilibrioLocacao(input);
    expect(eq.capRateMaximo).not.toBeNull();
    // A bisseção prometeu um cap que zera o lucro: rodar o motor nele tem de dar
    // zero. É a única forma de o número na capa não ser uma promessa vazia.
    const noCap = gradeCapObra(
      input,
      [(eq.capRateMaximo as number) * 10_000 - input.locacao!.capRateSaida * 10_000],
      [0],
    );
    expect(Math.abs(noCap[0][0].lucroProjeto)).toBeLessThan(1);
    expect(eq.expansaoMaximaCapBps as number).toBeCloseTo(
      ((eq.capRateMaximo as number) - input.locacao!.capRateSaida) * 10_000,
      6,
    );
    // O NOI mínimo é o NOI daquele ponto, e é MENOR que o do projeto: o
    // equilíbrio está abaixo de onde o projeto está.
    expect(eq.noiMinimo).not.toBeNull();
    expect(eq.noiMinimo as number).toBeLessThan(
      calcular(input).indicadores.noiEstabilizado as number,
    );
  });

  it('num projeto de venda os pontos de locação são todos nulos', () => {
    expect(pontosDeEquilibrioLocacao(vendaDoBanco())).toEqual({
      capRateMaximo: null,
      expansaoMaximaCapBps: null,
      aluguelMinimoSf: null,
      noiMinimo: null,
      ocupacaoMinima: null,
    });
  });
});
