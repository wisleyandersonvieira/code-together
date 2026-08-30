'use client';

import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { cn } from '@/lib/utils';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiro, mesAno, multiplo, percentual } from './formato';

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

export function AbaResultado({ rascunho, resultado }: Props) {
  const { apuracao: ap, indicadores: ind, agregados: ag } = resultado;
  const moeda = rascunho.moeda;
  const d = (v: number | null | undefined) => dinheiro(v, moeda);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Lucro do projeto" valor={d(ap.lucroProjeto)} nota={`Margem de ${percentual(ind.margemVgv)} sobre o VGV`} />
        <Indicador rotulo="MOIC" valor={multiplo(ind.moic)} nota={`ROI de ${percentual(ind.roi)}`} />
        <Indicador rotulo="TIR anual" valor={percentual(ind.tirAnual)} nota={`${percentual(ind.tirMensal, 4)} ao mês`} />
        <Indicador rotulo="Equity total" valor={d(ap.equityTotal)} nota={`Distribuído: ${d(ap.totalDistribuido)}`} />
        <Indicador rotulo="Dívida sacada" valor={d(ap.dividaSacada)} nota={`LTC de ${percentual(ind.ltc)}`} />
        <Indicador rotulo="Alavancagem" valor={percentual(ind.alavancagem)} nota="Dívida sobre o total de pagamentos" />
        <Indicador
          rotulo="Custo total da dívida"
          valor={percentual(ind.custoTotalDividaPct)}
          nota="Acumulado sobre o principal sacado — não é taxa a.a."
        />
        <Indicador rotulo="XIRR" valor={percentual(ind.xirr)} nota="Com as datas reais, base actual/365" />
      </div>

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
        description="Pro-rata. MOIC, ROI e TIR são idênticos para todos — o que varia é apenas a escala."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                {['Sócio', 'Participação', 'Capital', 'Lucro', 'Total', 'MOIC', 'TIR anual'].map((h, i) => (
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
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(s.capital)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(s.lucro)}</td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">{d(s.total)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{multiplo(ind.moic)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{percentual(ind.tirAnual)}</td>
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
    </div>
  );
}
