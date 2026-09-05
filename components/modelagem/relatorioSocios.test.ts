/**
 * O que o relatório para sócios AFIRMA, cobrado no relatório.
 *
 * O teste de `exportadores.test.ts` cobra que os quatro caminhos completam. Este
 * cobra o conteúdo: colunas que fecham, e nenhuma página aberta por uma nota.
 *
 * Duas famílias de teste, e a diferença importa:
 *
 * — As de SOMA olham a lista de linhas (`linhasDoAnexoFluxo`), porque "a coluna
 *   fecha" é uma afirmação sobre os números, não sobre os pixels.
 * — As de ENQUADRAMENTO olham o PDF gerado, página a página, porque "nenhuma
 *   página só com o disclaimer" é uma afirmação sobre o arquivo que o investidor
 *   abre, e contar `addPage` no código não provaria nada.
 */
import { describe, expect, it } from 'vitest';
import { calcular } from '@/lib/modelagem';
import type { CustoAdicional, ModelInput } from '@/lib/modelagem';
import { construirPdfSocios, linhasDoAnexoFluxo } from './exportarPdfSocios';
import { textoPorPagina } from './inspecionarPdf';
import { locacaoDoBanco, vendaDoBanco } from './fixturesModelagem';

const centavos = (v: number) => Math.round(v * 100) / 100;

const custo = (label: string, categoria: CustoAdicional['categoria']): CustoAdicional => ({
  label,
  valor: 40_000,
  distribuicao: 'linear_construction',
  categoria,
  baseCalculo: 'total',
  valorUnitario: 0,
  percentual: 0,
  gatilho: 'cronograma',
  parcelas: [],
});

const CATEGORIAS: CustoAdicional['categoria'][] = [
  'sitework', 'vertical', 'amenidades', 'offsite', 'contingencia', 'soft', 'financeiro', 'outros',
];

/**
 * A mesma modelagem com N linhas de custo e M sócios.
 *
 * O orçamento longo é o que importa aqui: com trinta e tantas linhas o Anexo A
 * chega ao piso de altura de linha, a tabela encosta no pé da folha, e é aí que
 * a nota de rodapé ia sozinha para a página seguinte.
 */
const comTamanho = (base: 'venda' | 'locacao', custos: number, socios: number): ModelInput => {
  const input = base === 'venda' ? vendaDoBanco() : locacaoDoBanco();
  input.custosAdicionais = Array.from({ length: custos }, (_, k) =>
    custo(`Custo ${k + 1}`, CATEGORIAS[k % CATEGORIAS.length]),
  );
  input.socios = Array.from({ length: socios }, (_, k) => ({
    nome: `Sócio ${k + 1}`,
    participacaoPct: 1 / socios,
    cotaDisponivel: false,
    aportes: [],
  }));
  return input;
};

// ─── Anexo A · a coluna de pagamentos fecha ─────────────────────────────────

describe('Anexo A · as linhas visíveis somam o Total de pagamentos', () => {
  for (const [rotulo, montar] of [
    ['venda', vendaDoBanco],
    ['locação', locacaoDoBanco],
  ] as const) {
    it(`${rotulo}: mês a mês, e no total`, () => {
      const input = montar();
      const saida = calcular(input);
      const linhas = linhasDoAnexoFluxo(input, saida);
      const pagamento = linhas.filter((l) => l.pagamento);
      expect(pagamento.length).toBeGreaterThan(0);

      // TODA coluna, sem exceção: era num punhado de meses de operação que a
      // conta não fechava, e um teste que olhasse só o total poderia passar com
      // duas linhas erradas se cancelando.
      for (const m of saida.meses) {
        const soma = pagamento.reduce((a, l) => a + l.valor(m), 0);
        expect(centavos(soma)).toBe(centavos(m.pagamentos));
      }

      const somaTotal = saida.meses.reduce(
        (a, m) => a + pagamento.reduce((b, l) => b + l.valor(m), 0),
        0,
      );
      expect(centavos(somaTotal)).toBe(centavos(saida.apuracao.totalPagamentos));
    });
  }

  it('locação: a receita de aluguel e o OPEX do anexo são os da apuração', () => {
    const input = locacaoDoBanco();
    const saida = calcular(input);
    const linhas = linhasDoAnexoFluxo(input, saida);
    const total = (rotulo: string) => {
      const def = linhas.find((l) => l.rotulo === rotulo);
      expect(def, `linha ausente: ${rotulo}`).toBeDefined();
      return saida.meses.reduce((a, m) => a + def!.valor(m), 0);
    };
    expect(centavos(total('Receita de aluguel'))).toBe(centavos(saida.apuracao.receitaAluguel));
    expect(centavos(total('OPEX (líq. reembolso)'))).toBe(centavos(saida.apuracao.opexTotal));
  });

  it("locação: a linha de venda deixa de se chamar só 'Receita'", () => {
    // Uma linha 'Receita' que exclui a receita de aluguel mente para quem lê.
    const locacao = linhasDoAnexoFluxo(locacaoDoBanco(), calcular(locacaoDoBanco()));
    expect(locacao.map((l) => l.rotulo)).toContain('Receita de venda');
    expect(locacao.map((l) => l.rotulo)).not.toContain('Receita');

    // E no modo venda nada muda: nem o rótulo, nem as duas linhas de locação.
    const venda = linhasDoAnexoFluxo(vendaDoBanco(), calcular(vendaDoBanco()));
    expect(venda.map((l) => l.rotulo)).toContain('Receita');
    expect(venda.map((l) => l.rotulo)).not.toContain('Receita de aluguel');
    expect(venda.map((l) => l.rotulo)).not.toContain('OPEX (líq. reembolso)');
  });

  it('a receita de aluguel vem ACIMA da de venda, e o OPEX antes do total', () => {
    const rotulos = linhasDoAnexoFluxo(locacaoDoBanco(), calcular(locacaoDoBanco())).map(
      (l) => l.rotulo,
    );
    expect(rotulos.indexOf('Receita de aluguel')).toBeLessThan(rotulos.indexOf('Receita de venda'));
    expect(rotulos.indexOf('OPEX (líq. reembolso)')).toBeLessThan(
      rotulos.indexOf('Total de pagamentos'),
    );
  });
});

// ─── Enquadramento · nenhuma página aberta por uma nota ─────────────────────

/**
 * O texto de uma página, sem o rodapé — que está em TODA página e não é conteúdo.
 * O que sobra é o que a página de fato diz.
 */
const corpoDaPagina = (texto: string[]) =>
  texto.filter(
    (t) =>
      t !== 'PROVISION' &&
      t !== 'Relatório para Sócios' &&
      !/^Página \d+ de \d+$/.test(t) &&
      !/Emitido em/.test(t),
  );

const paginasDe = (input: ModelInput) =>
  textoPorPagina(construirPdfSocios(input, calcular(input)).output('arraybuffer') as ArrayBuffer);

describe('nenhuma página é aberta por uma nota sozinha', () => {
  // A varredura cobre os dois modos nos tamanhos de orçamento e de quadro
  // societário que empurram a tabela contra o pé da folha. Com orçamento de 14
  // linhas o Anexo A produzia exatamente a página só com a nota de rodapé; com
  // 22 ele passa a estourar em dois blocos, que é o outro caminho para a órfã.
  //
  // Doze casos, e não trinta: cada um constrói um PDF inteiro — no modo locação
  // isso são centenas de rodadas do motor — e a varredura larga demais fazia a
  // suíte estourar a memória do worker.
  const casos: [string, ModelInput][] = [];
  for (const base of ['venda', 'locacao'] as const) {
    for (const custos of [0, 14, 22]) {
      for (const socios of [1, 5]) {
        casos.push([`${base} · ${custos} custos · ${socios} sócios`, comTamanho(base, custos, socios)]);
      }
    }
  }

  for (const [rotulo, input] of casos) {
    it(rotulo, () => {
      const paginas = paginasDe(input);
      expect(paginas.length).toBeGreaterThan(0);
      paginas.forEach((texto, i) => {
        const corpo = corpoDaPagina(texto);
        // Três é folgado de propósito: qualquer página de conteúdo do relatório
        // tem dezenas de textos. Uma página com três ou menos é uma nota — ou o
        // disclaimer — que abriu folha sozinha.
        expect(
          corpo.length,
          `página ${i + 1} de ${paginas.length} tem só ${JSON.stringify(corpo)}`,
        ).toBeGreaterThan(3);
      });
    });
  }

  it('o disclaimer fecha a última página, e não abre uma nova', () => {
    for (const base of ['venda', 'locacao'] as const) {
      const paginas = paginasDe(comTamanho(base, 14, 2));
      const ultima = corpoDaPagina(paginas[paginas.length - 1]);
      expect(ultima.some((t) => t.startsWith('Este material não constitui oferta'))).toBe(true);
      // Não é a única coisa na página: há tabela de sócio junto.
      expect(ultima.length).toBeGreaterThan(10);
    }
  });
});

// ─── Sem célula zerada onde deveria haver indicador de locação ──────────────

describe('o relatório de locação não mostra indicador de venda zerado', () => {
  it('não imprime preço médio por unidade nem margem sobre VGV', () => {
    const texto = paginasDe(locacaoDoBanco()).flat();
    // Os dois rótulos são de venda: um saía $0.00, o outro travessão.
    expect(texto).not.toContain('PREÇO MÉDIO POR UNIDADE');
    expect(texto).not.toContain('MARGEM SOBRE VGV');
    // E no lugar deles, a tese do negócio.
    expect(texto).toContain('YIELD ON COST');
    expect(texto).toContain('SPREAD SOBRE O CAP');
    expect(texto).toContain('CAP DE SAÍDA');
  });

  it('o relatório de venda continua com os indicadores de venda', () => {
    const texto = paginasDe(vendaDoBanco()).flat();
    expect(texto).toContain('PREÇO MÉDIO POR UNIDADE');
    expect(texto).toContain('MARGEM SOBRE VGV');
    expect(texto).not.toContain('YIELD ON COST');
  });

  it('a seção de premissas de locação existe, e só na locação', () => {
    expect(paginasDe(locacaoDoBanco()).flat()).toContain('Premissas de locação');
    expect(paginasDe(vendaDoBanco()).flat()).not.toContain('Premissas de locação');
  });

  it('a capa fala de expansão de cap, não de queda de preço', () => {
    const capa = paginasDe(locacaoDoBanco())[0].join(' ');
    expect(capa).toMatch(/expansão de \d+ bps no cap de saída/);
    expect(capa).not.toContain('queda de preço');
  });
});
