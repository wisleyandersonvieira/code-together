'use client';

import { useMemo, useState } from 'react';
import { Plus, Snowflake, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { cn } from '@/lib/utils';
import { somarMeses } from '@/lib/modelagem';
import type {
  AporteParcela,
  LinhaFluxo,
  ModelInput,
  ModelOutput,
  ModoAporte,
  PlanoAportes,
} from '@/lib/modelagem';
import { dinheiro, mesAno, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
  /**
   * Substitui o plano inteiro de uma vez, gravando na hora — é operação em lote e
   * destrutiva, então não espera o botão salvar (mesmo tratamento dos overrides).
   */
  substituirParcelas: (parcelas: AporteParcela[], patch?: Partial<PlanoAportes>) => Promise<void>;
  /** Apaga os overrides de uma linha do fluxo, no rascunho e no banco. */
  reverterLinha: (linha: LinhaFluxo) => void;
}

const PLANO_NEUTRO: PlanoAportes = {
  modoAporte: 'demanda',
  aporteBaseTotal: 0,
  valorTotalAlvo: 0,
  parcelas: [],
};

const EXPLICACAO_MODO: Record<ModoAporte, string> = {
  demanda:
    'O motor calcula o aporte de cada mês como resíduo: o que falta em caixa depois de saque, receita e caixa de abertura. É o comportamento padrão, e a aba fica em leitura.',
  plano:
    'As parcelas mandam. O aporte do mês é o valor da parcela daquele mês e zero nos meses sem parcela — se o plano não cobrir a demanda, o caixa fica negativo e a conferência acusa.',
};

const PERIODICIDADES = [
  { valor: '1', rotulo: 'Mensal' },
  { valor: '2', rotulo: 'Bimestral' },
  { valor: '3', rotulo: 'Trimestral' },
  { valor: '6', rotulo: 'Semestral' },
];

const celula = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-right text-sm tabular-nums';
const cabecalho = 'px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500';
const lido = 'bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700';

/** Centavos, para a soma das parcelas fechar exatamente com o total pedido. */
const centavos = (v: number) => Math.round(v * 100) / 100;

export function AbaAportes({ rascunho, alterar, resultado, substituirParcelas, reverterLinha }: Props) {
  const plano = rascunho.aportes ?? PLANO_NEUTRO;
  const moeda = rascunho.moeda;
  const prazoTotal = resultado.cronograma.prazoTotal;

  const [erroMes, setErroMes] = useState<string | null>(null);
  const [gerador, setGerador] = useState({ total: 0, quantidade: 12, mesInicial: 1, passo: '1' });

  const mudarPlano = (patch: Partial<PlanoAportes>) =>
    alterar({ aportes: { ...plano, ...patch } });

  /** Ordenação por mês, sempre — a tabela não tem outra ordem possível. */
  const ordenadas = useMemo(
    () => [...(plano.parcelas ?? [])].sort((a, b) => a.mes - b.mes),
    [plano.parcelas],
  );
  const planejado = ordenadas.reduce((a, p) => a + (p.valor || 0), 0);
  const difAlvo = planejado - (plano.valorTotalAlvo || 0);
  const chamado = resultado.apuracao.equityTotal;

  const dataDoMes = (mes: number) => mesAno(somarMeses(rascunho.dataInicio, Math.max(1, mes) - 1));

  const gravarParcelas = (novas: AporteParcela[]) =>
    mudarPlano({ parcelas: [...novas].sort((a, b) => a.mes - b.mes) });

  const mudarParcela = (alvo: AporteParcela, patch: Partial<AporteParcela>) => {
    if (patch.mes !== undefined) {
      const mes = Math.max(1, Math.trunc(patch.mes) || 1);
      // Dois meses iguais é erro: a tabela tem UNIQUE (modelagem_id, mes). Bloquear
      // aqui é melhor do que deixar o insert estourar no meio do salvamento.
      if (ordenadas.some((p) => p !== alvo && p.mes === mes)) {
        setErroMes(`Já existe parcela no mês ${mes}. Some os dois valores numa parcela só.`);
        return;
      }
      patch = { ...patch, mes };
    }
    setErroMes(null);
    gravarParcelas(ordenadas.map((p) => (p === alvo ? { ...p, ...patch } : p)));
  };

  const removerParcela = (alvo: AporteParcela) =>
    gravarParcelas(ordenadas.filter((p) => p !== alvo));

  const adicionarParcela = () => {
    const usados = new Set(ordenadas.map((p) => p.mes));
    let mes = 1;
    while (usados.has(mes)) mes++;
    setErroMes(null);
    gravarParcelas([...ordenadas, { mes, valor: 0 }]);
  };

  // ─── Troca de modo ─────────────────────────────────────────────────────────
  // Ligar o plano com overrides pendentes na linha de aporte é o caso delicado:
  // override vence o plano (é a invariante do motor), então o usuário decide se
  // quer transformá-los em parcelas — eles são literalmente mês + valor.
  const trocarModo = async (modo: ModoAporte) => {
    if (modo !== 'plano') {
      mudarPlano({ modoAporte: modo });
      return;
    }
    const overrides = (rascunho.overrides ?? []).filter(
      (o) => o.linha === 'equity_call' && o.mes >= 1 && o.mes <= prazoTotal,
    );
    if (overrides.length === 0) {
      mudarPlano({ modoAporte: 'plano' });
      return;
    }
    const importar = window.confirm(
      `Há ${overrides.length} mês(es) com aporte lançado à mão no fluxo. Importar como parcelas do plano?\n\n` +
        'OK: viram parcelas e os overrides são apagados.\n' +
        'Cancelar: os overrides ficam como estão e continuam vencendo o plano (a conferência acende âmbar).',
    );
    if (!importar) {
      mudarPlano({ modoAporte: 'plano' });
      return;
    }
    const porMes = new Map(ordenadas.map((p) => [p.mes, { ...p }]));
    for (const o of overrides) {
      const atual = porMes.get(o.mes);
      // `limpar` força a célula a vazio: como parcela, isso é zero.
      const valor = o.limpar ? 0 : (o.valor ?? 0);
      if (atual) atual.valor = valor;
      else porMes.set(o.mes, { mes: o.mes, valor });
    }
    await substituirParcelas(
      [...porMes.values()].sort((a, b) => a.mes - b.mes),
      { modoAporte: 'plano' },
    );
    reverterLinha('equity_call');
  };

  /** Copia a curva que o motor produziu e passa a mandar nela. */
  const congelarCurva = async () => {
    const novas = resultado.meses
      .filter((m) => Math.abs(m.equityCall) > 0.005)
      .map((m) => ({ mes: m.mes, valor: centavos(m.equityCall) }));
    if (novas.length === 0) {
      window.alert('O motor não chamou capital em mês nenhum — não há curva para congelar.');
      return;
    }
    if (
      ordenadas.length > 0 &&
      !window.confirm(`Isto substitui as ${ordenadas.length} parcelas atuais pela curva calculada. Continuar?`)
    ) {
      return;
    }
    await substituirParcelas(novas, {
      modoAporte: 'plano',
      valorTotalAlvo: centavos(novas.reduce((a, p) => a + p.valor, 0)),
    });
  };

  // ─── Gerador ───────────────────────────────────────────────────────────────
  const gerar = async () => {
    const n = Math.max(1, Math.trunc(gerador.quantidade) || 1);
    const passo = Math.max(1, Number(gerador.passo) || 1);
    const inicio = Math.max(1, Math.trunc(gerador.mesInicial) || 1);
    const total = gerador.total || 0;

    // Divide igual e joga o resíduo do arredondamento na última parcela: a soma
    // fecha no centavo com o total pedido, sempre.
    const fatia = centavos(total / n);
    const novas: AporteParcela[] = [];
    for (let i = 0; i < n; i++) {
      const valor = i === n - 1 ? centavos(total - fatia * (n - 1)) : fatia;
      novas.push({ mes: inicio + i * passo, valor });
    }

    const fora = novas.filter((p) => p.mes > prazoTotal);
    if (fora.length > 0) {
      const segue = window.confirm(
        `${fora.length} parcela(s) caem além do mês ${prazoTotal}, o fim do cronograma, e não entram no fluxo. ` +
          'Gerar assim mesmo? (a conferência vai acusar)',
      );
      if (!segue) return;
    }
    if (
      ordenadas.length > 0 &&
      !window.confirm(`Isto substitui as ${ordenadas.length} parcelas já lançadas. Continuar?`)
    ) {
      return;
    }
    setErroMes(null);
    await substituirParcelas(novas, { valorTotalAlvo: centavos(total) });
  };

  // ─── Curva ─────────────────────────────────────────────────────────────────
  const parcelaPorMes = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const p of ordenadas) mapa.set(p.mes, (mapa.get(p.mes) ?? 0) + (p.valor || 0));
    return mapa;
  }, [ordenadas]);

  const maiorBarra = Math.max(
    1,
    ...resultado.meses.map((m) => Math.max(m.equityCall, parcelaPorMes.get(m.mes) ?? 0)),
  );

  const indicadores = [
    { rotulo: 'Planejado (Σ parcelas)', valor: dinheiro(planejado, moeda), ambar: false },
    { rotulo: 'Alvo declarado', valor: dinheiro(plano.valorTotalAlvo || 0, moeda), ambar: false },
    {
      rotulo: 'Diferença',
      valor: dinheiro(difAlvo, moeda),
      ambar: Math.abs(difAlvo) > 0.01,
    },
    { rotulo: 'Efetivamente chamado no fluxo', valor: dinheiro(chamado, moeda), ambar: false },
  ];

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Plano de aportes"
        description="A linha de aporte do fluxo de caixa vista por outra interface. Não há sincronização entre as duas telas: a fonte é uma só."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={plano.modoAporte} onValueChange={(v) => trocarModo(v as ModoAporte)}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demanda">Por demanda de caixa</SelectItem>
                <SelectItem value="plano">Plano de parcelas</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">{EXPLICACAO_MODO[plano.modoAporte]}</p>
          </div>

          {plano.modoAporte === 'demanda' ? (
            <>
              <div className="space-y-2">
                <Label>Aporte base total</Label>
                <Input
                  type="number"
                  step="any"
                  className={financeDetailFieldClassName}
                  value={plano.aporteBaseTotal}
                  onChange={(e) => mudarPlano({ aporteBaseTotal: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-slate-500">
                  Premissa que dimensiona a curva do modo <em>equity first</em>: descontado o terreno,
                  sobram {dinheiro(resultado.agregados.equityDisponivelObra, moeda)} para a obra antes do
                  primeiro saque.
                </p>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={congelarCurva}>
                  <Snowflake className="mr-2 h-4 w-4" />
                  Congelar curva como plano
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Valor total do aporte (alvo)</Label>
              <Input
                type="number"
                step="any"
                className={financeDetailFieldClassName}
                value={plano.valorTotalAlvo}
                onChange={(e) => mudarPlano({ valorTotalAlvo: Number(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500">
                O alvo não é imposto — quem manda no fluxo são as parcelas. A diferença acende âmbar.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-4">
          {indicadores.map((k) => (
            <div key={k.rotulo}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.rotulo}</p>
              <p
                className={cn(
                  'mt-1 text-sm font-semibold tabular-nums',
                  k.ambar ? 'text-amber-700' : 'text-slate-900',
                )}
              >
                {k.valor}
              </p>
            </div>
          ))}
        </div>
      </FinanceDetailSectionCard>

      {plano.modoAporte === 'plano' ? (
        <FinanceDetailSectionCard
          title="Gerador de parcelas"
          description="Divide um total em parcelas iguais a partir de um mês. O resíduo do arredondamento vai na última parcela, para a soma fechar no centavo."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Valor total</Label>
              <Input
                type="number"
                step="any"
                className={financeDetailFieldClassName}
                value={gerador.total}
                onChange={(e) => setGerador({ ...gerador, total: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de parcelas</Label>
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                value={gerador.quantidade}
                onChange={(e) => setGerador({ ...gerador, quantidade: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mês da 1ª parcela</Label>
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                value={gerador.mesInicial}
                onChange={(e) => setGerador({ ...gerador, mesInicial: Number(e.target.value) || 1 })}
              />
              <p className="text-xs text-slate-500">{dataDoMes(gerador.mesInicial)}</p>
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={gerador.passo} onValueChange={(v) => setGerador({ ...gerador, passo: v })}>
                <SelectTrigger className={financeDetailFieldClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={gerar}>
                <Wand2 className="mr-2 h-4 w-4" />
                Gerar parcelas
              </Button>
            </div>
          </div>
        </FinanceDetailSectionCard>
      ) : null}

      <FinanceDetailSectionCard
        title="Parcelas"
        description="O mês é índice do cronograma, não data — a data abaixo é derivada do início do projeto."
        action={
          <Button type="button" variant="outline" onClick={adicionarParcela}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar parcela
          </Button>
        }
      >
        {erroMes ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{erroMes}</p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={`${cabecalho} text-left`}>#</th>
                <th className={`${cabecalho} text-right`}>Mês</th>
                <th className={`${cabecalho} text-right`}>Valor</th>
                <th className={`${cabecalho} bg-slate-50 text-right`}>% do total</th>
                <th className={`${cabecalho} bg-slate-50 text-right`}>Acumulado</th>
                <th className={`${cabecalho} bg-slate-50 text-right`}>Acumulado %</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((p, i) => {
                const acumulado = ordenadas.slice(0, i + 1).reduce((a, x) => a + (x.valor || 0), 0);
                return (
                  <tr key={p.id ?? `nova-${i}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5 text-sm tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className={celula}
                        value={p.mes}
                        onChange={(e) => mudarParcela(p, { mes: Number(e.target.value) || 1 })}
                      />
                      <p className="mt-0.5 pr-2 text-right text-xs text-slate-400">
                        mês {p.mes} · {dataDoMes(p.mes)}
                      </p>
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className={celula}
                        value={p.valor}
                        onChange={(e) => mudarParcela(p, { valor: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className={lido}>{percentual(planejado > 0 ? (p.valor || 0) / planejado : null)}</td>
                    <td className={lido}>{dinheiro(acumulado, moeda)}</td>
                    <td className={lido}>{percentual(planejado > 0 ? acumulado / planejado : null)}</td>
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => removerParcela(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {ordenadas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-sm text-slate-500">
                    Nenhuma parcela lançada. No modo por demanda isso é o normal — o motor calcula a curva.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {ordenadas.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-2 py-2 text-sm" colSpan={2}>
                    Total das parcelas ({ordenadas.length})
                  </td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums">{dinheiro(planejado, moeda)}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums" colSpan={3}>
                    {Math.abs(difAlvo) > 0.01 ? (
                      <span className="text-amber-700">
                        {difAlvo > 0 ? 'Excede o alvo em ' : 'Falta para o alvo '}
                        {dinheiro(Math.abs(difAlvo), moeda)}
                      </span>
                    ) : (
                      <span className="text-slate-500">Fecha com o alvo declarado.</span>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Curva"
        description="Plano ao lado do que o motor efetivamente chamou. Onde o motor pediu mais capital do que o plano previu, a linha acende âmbar — é aqui que o plano falhando aparece antes do fluxo."
      >
        <div className="space-y-1">
          {resultado.meses.map((m) => {
            const previsto = parcelaPorMes.get(m.mes) ?? 0;
            const faltou = plano.modoAporte === 'plano' && m.equityCall > previsto + 0.01;
            return (
              <div
                key={m.mes}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-1 text-xs',
                  faltou && 'bg-amber-50',
                )}
              >
                <span className="w-24 shrink-0 tabular-nums text-slate-500">
                  {m.mes} · {mesAno(m.data)}
                </span>
                <span className="flex h-4 flex-1 items-center gap-1">
                  <span
                    className="h-2.5 rounded-sm bg-slate-800"
                    style={{ width: `${(previsto / maiorBarra) * 100}%` }}
                    title={`Plano: ${dinheiro(previsto, moeda)}`}
                  />
                </span>
                <span className="w-28 shrink-0 text-right tabular-nums text-slate-700">
                  {dinheiro(previsto, moeda)}
                </span>
                <span className="flex h-4 flex-1 items-center gap-1">
                  <span
                    className={cn('h-2.5 rounded-sm', faltou ? 'bg-amber-500' : 'bg-slate-400')}
                    style={{ width: `${(m.equityCall / maiorBarra) * 100}%` }}
                    title={`Motor: ${dinheiro(m.equityCall, moeda)}`}
                  />
                </span>
                <span
                  className={cn(
                    'w-28 shrink-0 text-right tabular-nums',
                    faltou ? 'font-semibold text-amber-800' : 'text-slate-700',
                  )}
                >
                  {dinheiro(m.equityCall, moeda)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Barra escura: o plano. Barra clara: o que o motor chamou. No modo por demanda as duas divergem
          por construção — o plano só passa a mandar quando o modo é <em>plano de parcelas</em>.
        </p>
      </FinanceDetailSectionCard>
    </div>
  );
}
