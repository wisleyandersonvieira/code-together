'use client';

import { useState } from 'react';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { ApuracaoAnual, ModelInput, ModelOutput, RateioSocio } from '@/lib/modelagem';
import { apuracaoAnual, LINHAS_ANUAL, totalAnual } from '@/lib/modelagem';
import { dinheiro, mesAno, multiplo, numero, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
}

/** Cartão de indicador. Números em tokens de texto, nunca coloridos por série. */
function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{valor}</p>
      {nota ? <p className="mt-1 text-xs leading-4 text-slate-500">{nota}</p> : null}
    </div>
  );
}

/**
 * Fluxo líquido mês a mês, em SVG à mão — sem biblioteca.
 *
 * Barras para cima em verde (recebeu), para baixo em rosa (pôs), e a linha do
 * zero sempre visível: sem ela o gráfico mentiria sobre o sinal. A escala é
 * simétrica em torno do zero, então a altura de duas barras é comparável.
 */
function GraficoFluxo({ fluxo, moeda }: { fluxo: number[]; moeda: string }) {
  const n = fluxo.length;
  if (n === 0) return null;
  const L = 640;
  const A = 140;
  const maior = Math.max(1, ...fluxo.map((v) => Math.abs(v)));
  const zeroY = A / 2;
  const larguraBarra = Math.max(1, (L / n) * 0.7);
  const passo = L / n;
  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      className="h-36 w-full"
      role="img"
      aria-label="Fluxo líquido do sócio, mês a mês"
    >
      {fluxo.map((v, i) => {
        const altura = (Math.abs(v) / maior) * (A / 2 - 6);
        const x = i * passo + (passo - larguraBarra) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={v >= 0 ? zeroY - altura : zeroY}
            width={larguraBarra}
            height={Math.max(altura, v === 0 ? 0 : 0.5)}
            className={v >= 0 ? 'fill-emerald-500' : 'fill-rose-400'}
          >
            <title>{`Mês ${i + 1}: ${dinheiro(v, moeda)}`}</title>
          </rect>
        );
      })}
      {/* A linha do zero por cima das barras: é a referência de leitura. */}
      <line x1={0} y1={zeroY} x2={L} y2={zeroY} className="stroke-slate-400" strokeWidth={1} />
    </svg>
  );
}

export function AbaResultado({ rascunho, resultado }: Props) {
  const { apuracao: ap, indicadores: ind, agregados: ag } = resultado;
  const moeda = rascunho.moeda;
  const d = (v: number | null | undefined) => dinheiro(v, moeda);

  // Abas internas da própria aba Resultado — não são aba nova do editor.
  // 'geral' é o padrão: é o conteúdo que já existia.
  const [visao, setVisao] = useState('geral');
  const [socioIndice, setSocioIndice] = useState('0');
  const socio: RateioSocio | undefined = resultado.rateioSocios[Number(socioIndice)];
  /** 1 ponto percentual — mesma tolerância da conferência `capital_vs_participacao`. */
  const divergente =
    socio != null && Math.abs(socio.pctCapital - socio.participacaoPct) > 0.01;

  const cascata = [
    { rotulo: 'Receita bruta (VGV)', valor: ap.receitaBruta, sinal: 1 },
    { rotulo: 'Comissões', valor: -ap.comissoes, sinal: -1 },
    { rotulo: 'Cartório / closing', valor: -ap.cartorio, sinal: -1 },
    { rotulo: 'Receita líquida', valor: ap.receitaLiquida, total: true },
    { rotulo: 'Terrenos', valor: -ap.custoTerrenos, sinal: -1 },
    { rotulo: 'Obra', valor: -ap.custoObra, sinal: -1 },
    { rotulo: 'Property taxes', valor: -ap.custoPropertyTax, sinal: -1 },
    { rotulo: 'Outros custos', valor: -ap.custoOutros, sinal: -1 },
    { rotulo: 'Custo do empreendimento', valor: -ap.custoEmpreendimento, subtotal: true },
    { rotulo: 'Juros', valor: -ap.jurosTotais, sinal: -1 },
    { rotulo: 'Fee de estruturação', valor: -ap.feeTotal, sinal: -1 },
    { rotulo: 'Custo financeiro', valor: -ap.custoFinanceiro, subtotal: true },
    { rotulo: 'Lucro do projeto', valor: ap.lucroProjeto, total: true },
    { rotulo: `Lucro dos investidores (${percentual(rascunho.receita.lucroInvestidoresPct, 0)})`, valor: ap.lucroInvestidores },
    { rotulo: `Lucro do sponsor (${percentual(rascunho.receita.lucroSponsorPct, 0)})`, valor: ap.lucroSponsor },
  ];

  const usos = [
    { rotulo: 'Terrenos', valor: ap.custoTerrenos },
    { rotulo: 'Obra', valor: ap.custoObra },
    { rotulo: 'Property taxes', valor: ap.custoPropertyTax },
    { rotulo: 'Outros custos', valor: ap.custoOutros },
    { rotulo: 'Juros e taxas', valor: ap.custoFinanceiro },
    { rotulo: 'Amortização da dívida', valor: ap.dividaAmortizada },
    { rotulo: 'Distribuição', valor: ap.totalDistribuido },
  ];
  const origens = [
    { rotulo: 'Aporte de equity', valor: ap.equityTotal },
    { rotulo: 'Dívida sacada', valor: ap.dividaSacada },
    { rotulo: 'Receita de vendas', valor: ap.receitaLiquida },
  ];
  const totalUsos = usos.reduce((a, u) => a + u.valor, 0);
  const totalOrigens = origens.reduce((a, o) => a + o.valor, 0);

  // Demonstração por ano-calendário. A tela não soma nada por conta própria: a
  // coluna Total vem de `totalAnual`, e as colunas de `apuracaoAnual`.
  const anos = apuracaoAnual(resultado);
  const totalAnos = totalAnual(anos);

  /** Dedução sai entre parênteses, como numa demonstração de resultado. */
  const celulaAnual = (linha: (typeof LINHAS_ANUAL)[number], col: ApuracaoAnual) => {
    const v = col[linha.chave] as number;
    if (linha.deducao) return v === 0 ? '—' : `(${d(Math.abs(v))})`;
    return d(v);
  };

  return (
    // Abas INTERNAS da aba Resultado — o editor não ganha aba nova. 'geral' é o
    // padrão porque é exatamente o conteúdo que já existia aqui.
    <Tabs value={visao} onValueChange={setVisao} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="geral">Geral</TabsTrigger>
        <TabsTrigger value="por-socio">Por sócio</TabsTrigger>
      </TabsList>

      <TabsContent value="geral" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Lucro do projeto" valor={d(ap.lucroProjeto)} nota={`Margem de ${percentual(ind.margemVgv)} sobre o VGV`} />
        <Indicador rotulo="MOIC" valor={multiplo(ind.moic)} nota={`ROI de ${percentual(ind.roi)}`} />
        <Indicador rotulo="TIR anual" valor={percentual(ind.tirAnual)} nota={`${percentual(ind.tirMensal, 4)} ao mês`} />
        <Indicador rotulo="Equity total" valor={d(ap.equityTotal)} nota={`Distribuído: ${d(ap.totalDistribuido)}`} />
        {/* Os dois LTC lado a lado, porque medem coisas diferentes: por
            desembolso é o total sacado na vida do empréstimo; de pico é o maior
            saldo em aberto — o que um covenant de linha rotativa cobra. Sem
            amortização antes do fim, coincidem. */}
        <Indicador
          rotulo="Dívida sacada"
          valor={d(ap.dividaSacada)}
          nota={`LTC por desembolso de ${percentual(ind.ltc)}`}
        />
        <Indicador
          rotulo="Pico do saldo devedor"
          valor={d(ap.saldoDevedorMaximo)}
          nota={`LTC de pico de ${percentual(ind.ltcPico)}${
            rascunho.financiamento.linhaRotativa ? ' — é o que o teto da linha rotativa limita' : ''
          }`}
        />
        <Indicador rotulo="Alavancagem" valor={percentual(ind.alavancagem)} nota="Dívida sobre o total de pagamentos" />
        <Indicador
          rotulo="Custo total da dívida"
          valor={percentual(ind.custoTotalDividaPct)}
          nota="Acumulado sobre o principal sacado — não é taxa a.a."
        />
        <Indicador rotulo="XIRR" valor={percentual(ind.xirr)} nota="Com as datas reais, base actual/365" />
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Os indicadores gerais tratam o projeto como se tivesse um único sócio, somando os aportes nas
        datas em que ocorrem. Com datas de aporte diferentes por sócio, a TIR geral não é a média das
        TIRs individuais — os perfis no tempo são diferentes.
      </p>

      <FinanceDetailSectionCard
        title="Por unidade"
        description="O que uma pro forma mostra em toda linha do orçamento: custo por lote contra preço de venda. Derivado da apuração — não há premissa nova aqui."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Indicador
            rotulo="Custo por unidade"
            valor={d(ind.custoPorUnidade)}
            nota={`Tudo incluído, sobre ${numero(ag.unidadesTotal, 0)} unidades`}
          />
          <Indicador
            rotulo="Preço médio por unidade"
            valor={d(ind.precoMedioPorUnidade)}
            nota="Bruto, antes de comissão e cartório"
          />
          <Indicador
            rotulo="Margem por unidade"
            valor={d(ind.margemPorUnidade)}
            nota={`${percentual(ind.margemVgv)} sobre o VGV`}
          />
          <Indicador
            rotulo="Custo por sf"
            valor={d(ind.custoPorSf)}
            nota={
              ag.areaTotalSf > 0
                ? `Sobre ${numero(ag.areaTotalSf, 0)} sf`
                : 'Sem área por unidade cadastrada'
            }
          />
          <Indicador
            rotulo="Receita por sf"
            valor={d(ind.receitaPorSf)}
            nota={
              ag.areaTotalSf > 0
                ? `Sobre ${numero(ag.areaTotalSf, 0)} sf`
                : 'Informe a área na aba Unidades'
            }
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          O custo por unidade é <strong>tudo incluído</strong>: custo do empreendimento mais juros e
          fee, dividido pelas {numero(ag.unidadesTotal, 0)} unidades. Multiplicado de volta pela
          quantidade, reconstitui a apuração acima.
        </p>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Resultado por ano"
        description="Demonstração por ano-calendário. Comissão e cartório incidem sobre a receita de cada ano, não sobre o VGV total."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Linha
                </th>
                {anos.map((a) => (
                  <th
                    key={a.ano}
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {a.ano}
                    <span className="block font-normal normal-case text-slate-400">
                      {a.meses} {a.meses === 1 ? 'mês' : 'meses'}
                    </span>
                  </th>
                ))}
                <th className="border-l border-slate-300 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {LINHAS_ANUAL.map((linha) => (
                <tr
                  key={linha.chave}
                  className={cn(
                    'border-b border-slate-100 last:border-0',
                    linha.total && 'bg-slate-50 font-semibold text-slate-900',
                    linha.subtotal && 'font-medium',
                  )}
                >
                  <td className="px-3 py-1.5 text-sm text-slate-700">{linha.rotulo}</td>
                  {anos.map((a) => (
                    <td key={a.ano} className="px-3 py-1.5 text-right text-sm tabular-nums text-slate-800">
                      {celulaAnual(linha, a)}
                    </td>
                  ))}
                  <td className="border-l border-slate-300 bg-slate-50 px-3 py-1.5 text-right text-sm font-medium tabular-nums text-slate-900">
                    {celulaAnual(linha, totalAnos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          O primeiro e o último ano são parciais — a contagem de meses está no cabeçalho. A soma dos
          resultados anuais é o lucro do projeto; quando divergir, é porque a receita foi lançada à
          mão no fluxo, e a conferência <em>Receita lançada vs apurada</em> aponta a diferença.
        </p>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Cascata de apuração" description="Do VGV ao lucro repartido.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full">
            <tbody>
              {cascata.map((l, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-slate-100 last:border-0',
                    (l as any).total && 'border-y-2 border-slate-300 bg-slate-100 font-semibold',
                    (l as any).subtotal && 'bg-slate-50 font-medium',
                  )}
                >
                  <td className="px-4 py-2 text-sm text-slate-700">{l.rotulo}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right text-sm tabular-nums',
                      l.valor < 0 ? 'text-slate-600' : 'text-slate-900',
                    )}
                  >
                    {d(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Usos e origens"
        description="Prova de que o modelo fecha: a diferença entre origens e usos é o caixa residual, que é o lucro do sponsor."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[
            { titulo: 'Usos', linhas: usos, total: totalUsos },
            { titulo: 'Origens', linhas: origens, total: totalOrigens },
          ].map((bloco) => (
            <div key={bloco.titulo} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
                {bloco.titulo}
              </div>
              <table className="w-full">
                <tbody>
                  {bloco.linhas.map((l) => (
                    <tr key={l.rotulo} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-sm text-slate-700">{l.rotulo}</td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-900">{d(l.valor)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                    <td className="px-4 py-2 text-sm text-slate-900">Total</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-900">{d(bloco.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Origens menos usos: <strong>{d(totalOrigens - totalUsos)}</strong>. Quando tudo está automático,
          isso é exatamente o lucro do sponsor ({d(ap.lucroSponsor)}), que não é distribuído e permanece
          como caixa do projeto.
        </p>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Resultado por tipologia"
        description="Todo valor da tabela é TOTAL das N unidades da tipologia, com o custo unitário ao lado. Custos que não pertencem a nenhuma tipologia (contingência, property tax, juros e fee) são rateados pro-rata pelo custo direto — por isso a soma dos lucros fecha com o lucro do projeto."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50">
              <tr>
                {['Tipologia', 'Qtd', 'Custo direto', 'Rateio', 'Compartilhados', 'Financeiro', 'Custo total', 'Custo unitário', 'Receita líquida', 'Lucro', 'Margem'].map((h, i) => (
                  <th key={h} className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', i === 0 ? 'text-left' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.resultadoUnidades.map((u, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-sm text-slate-800">{u.nome || `Tipologia ${i + 1}`}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-600">{u.quantidade}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(u.custoDireto)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{percentual(u.fatorRateio)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(u.custosCompartilhados)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(u.custoFinanceiro)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-900">{d(u.custoTotal)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{d(u.custoTotalUnitario)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(u.receitaLiquida)}</td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">{d(u.lucro)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{percentual(u.margem)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                <td className="px-3 py-2 text-sm text-slate-900">
                  Total ({resultado.resultadoUnidades.length} tipologias)
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-900">
                  {ag.unidadesTotal}
                </td>
                <td className="px-3 py-2" colSpan={7} />
                <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-900">
                  {d(resultado.resultadoUnidades.reduce((a, u) => a + u.lucro, 0))}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Rateio por sócio"
        description="A participação governa o lucro; o capital pode seguir outra regra. Quando as duas frações divergem, MOIC e TIR deixam de ser iguais para todos — e a coluna % capital acende âmbar."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                {['Sócio', 'Participação', '% capital', 'Capital', 'Lucro', 'Total', 'MOIC', 'TIR anual'].map((h, i) => (
                  <th key={h} className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', i === 0 ? 'text-left' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.rateioSocios.map((s, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-sm text-slate-800">
                    {s.nome || `Sócio ${i + 1}`}
                    {s.cotaDisponivel ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        cota disponível
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{percentual(s.participacaoPct)}</td>
                  {/* A fração de CAPITAL, que pode divergir da participação — é ela
                      que explica MOIC e TIR diferentes entre os sócios. */}
                  <td
                    className={cn(
                      'px-3 py-2 text-right text-sm tabular-nums',
                      Math.abs(s.pctCapital - s.participacaoPct) > 0.01
                        ? 'font-medium text-amber-700'
                        : 'text-slate-700',
                    )}
                  >
                    {percentual(s.pctCapital)}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(s.capital)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(s.lucro)}</td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">{d(s.total)}</td>
                  {/* MOIC e TIR DELE, não os do projeto: com capital ou datas
                      próprias, os dois números deixam de ser iguais para todos. */}
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{multiplo(s.moic)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{percentual(s.tirAnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {resultado.rateioSocios.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-slate-800">Chamadas de capital por sócio</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sócio
                    </th>
                    {resultado.meses.map((m) => (
                      <th key={m.mes} className="min-w-[86px] px-2 py-2 text-right text-xs font-semibold text-slate-500">
                        {mesAno(m.data)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.rateioSocios.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-slate-800">{s.nome || `Sócio ${i + 1}`}</td>
                      {s.chamadasPorMes.map((v, k) => (
                        <td key={k} className="px-2 py-2 text-right tabular-nums text-slate-600">
                          {v === 0 ? '—' : d(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </FinanceDetailSectionCard>
      </TabsContent>

      <TabsContent value="por-socio" className="space-y-6">
        {resultado.rateioSocios.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            Nenhum sócio cadastrado. Adicione os sócios na aba Sócios para ver o retorno de cada um.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full max-w-xs">
                <Select value={socioIndice} onValueChange={setSocioIndice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resultado.rateioSocios.map((s, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {s.nome || `Sócio ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Os dois selos lado a lado: é a leitura que responde "por que o
                  meu retorno é diferente do dele?" sem abrir o fluxo. */}
              {socio ? (
                <>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tabular-nums text-slate-700">
                    Participação {percentual(socio.participacaoPct)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium tabular-nums',
                      divergente ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700',
                    )}
                    title={
                      divergente
                        ? 'A fração de capital diverge da participação em mais de 1 ponto percentual. Não é erro — é a negociação.'
                        : undefined
                    }
                  >
                    Capital {percentual(socio.pctCapital)}
                  </span>
                </>
              ) : null}
            </div>

            {socio ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Indicador rotulo="Capital aportado" valor={d(socio.capital)} nota="Σ dos aportes dele" />
                  <Indicador rotulo="Total recebido" valor={d(socio.total)} nota="Capital devolvido + lucro" />
                  <Indicador
                    rotulo="Lucro"
                    valor={d(socio.lucro)}
                    nota={`${percentual(socio.participacaoPct)} do lucro dos investidores`}
                  />
                  <Indicador rotulo="MOIC" valor={multiplo(socio.moic)} nota={`ROI de ${percentual(socio.roi)}`} />
                  <Indicador rotulo="ROI" valor={percentual(socio.roi)} nota="Lucro sobre o capital dele" />
                  <Indicador
                    rotulo="TIR anual"
                    valor={percentual(socio.tirAnual)}
                    nota={`${percentual(socio.tirMensal, 4)} ao mês`}
                  />
                  <Indicador rotulo="XIRR" valor={percentual(socio.xirr)} nota="Com as datas reais, base actual/365" />
                  <Indicador
                    rotulo="TIR geral do projeto"
                    valor={percentual(ind.tirAnual)}
                    nota="Para comparar — não é a média das TIRs individuais"
                  />
                </div>

                <FinanceDetailSectionCard
                  title="Fluxo líquido"
                  description="Barras para cima: o que ele recebeu. Para baixo: o que ele aportou. É este fluxo que produz a TIR dele."
                >
                  <GraficoFluxo fluxo={socio.fluxoPorMes} moeda={moeda} />
                </FinanceDetailSectionCard>

                <FinanceDetailSectionCard
                  title="Extrato mensal"
                  description="Mês a mês, o que entrou e o que saiu do bolso deste sócio."
                >
                  <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[640px]">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr>
                          {['Mês', 'Data', 'Aporte', 'Devolução', 'Fluxo líquido', 'Acumulado'].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                                i <= 1 ? 'text-left' : 'text-right',
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.meses.map((m, k) => {
                          const fluxo = socio.fluxoPorMes[k] ?? 0;
                          const acumulado = socio.fluxoPorMes.slice(0, k + 1).reduce((a, v) => a + v, 0);
                          return (
                            <tr key={m.mes} className="border-t border-slate-100">
                              <td className="px-3 py-1.5 text-sm tabular-nums text-slate-500">{m.mes}</td>
                              <td className="px-3 py-1.5 text-sm text-slate-500">{mesAno(m.data)}</td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-slate-700">
                                {socio.chamadasPorMes[k] === 0 ? '—' : d(socio.chamadasPorMes[k])}
                              </td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-slate-700">
                                {socio.devolucoesPorMes[k] === 0 ? '—' : d(socio.devolucoesPorMes[k])}
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-1.5 text-right text-sm font-medium tabular-nums',
                                  fluxo < 0 ? 'text-rose-600' : fluxo > 0 ? 'text-emerald-700' : 'text-slate-400',
                                )}
                              >
                                {fluxo === 0 ? '—' : d(fluxo)}
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-1.5 text-right text-sm tabular-nums',
                                  acumulado < 0 ? 'text-rose-600' : 'text-slate-700',
                                )}
                              >
                                {d(acumulado)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </FinanceDetailSectionCard>

                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  A devolução segue duas camadas: primeiro cada sócio recupera o capital que aportou,
                  depois o lucro é repartido pela participação.{' '}
                  <strong>Não há preferred return nem promote nesta modelagem.</strong>
                </p>
              </>
            ) : null}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
