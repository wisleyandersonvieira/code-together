'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { cn } from '@/lib/utils';
import { somarMeses } from '@/lib/modelagem';
import type { Fase, ModelInput, ModelOutput } from '@/lib/modelagem';
import { dataCurta } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const celula = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-sm';
const cabecalho = 'px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500';
const lido = 'bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700';

export function AbaPremissas({ rascunho, alterar, resultado }: Props) {
  const cr = resultado.cronograma;
  const fases = rascunho.fases ?? [];
  const [quantidadeFases, setQuantidadeFases] = useState(2);

  const mudarFase = (i: number, patch: Partial<Fase>) =>
    alterar({ fases: fases.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  // Remover a fase leva junto a alocação dela e reindexa o resto: `faseIndex` é
  // posicional, então um índice antigo passaria a apontar para outra fase.
  const removerFase = (i: number) =>
    alterar({
      fases: fases.filter((_, k) => k !== i).map((f, k) => ({ ...f, ordem: k })),
      alocacoes: (rascunho.alocacoes ?? [])
        .filter((a) => a.faseIndex !== i)
        .map((a) => (a.faseIndex > i ? { ...a, faseIndex: a.faseIndex - 1 } : a)),
    });

  // Desligar as fases NÃO apaga linha nenhuma: elas continuam no banco e voltam a
  // valer quando o switch for religado. Input do usuário não some sozinho.
  const alternarFases = (ligado: boolean) => {
    if (!ligado && fases.length > 0) {
      const ok = window.confirm(
        `As ${fases.length} fases cadastradas continuam guardadas e voltam a valer se você religar o switch — ` +
          'só deixam de entrar no cálculo. Desligar?',
      );
      if (!ok) return;
    }
    alterar({ usaFases: ligado });
  };

  /**
   * Chute útil: divide a janela de obra em N fases de duração parecida (o resto da
   * divisão vai para as primeiras). É ponto de partida — o usuário ajusta as datas.
   */
  const gerarFases = () => {
    const n = Math.max(1, Math.trunc(quantidadeFases) || 1);
    const totalMeses = cr.mesFimObra - cr.mesInicioObra + 1;
    if (totalMeses < 1) {
      window.alert('Informe os meses de construção antes de gerar as fases.');
      return;
    }
    if (
      fases.length > 0 &&
      !window.confirm(`Isto substitui as ${fases.length} fases atuais. Continuar?`)
    ) {
      return;
    }
    const base = Math.floor(totalMeses / n);
    const resto = totalMeses % n;
    const novas: Fase[] = [];
    let mes = cr.mesInicioObra;
    for (let i = 0; i < n; i++) {
      const duracao = Math.max(1, base + (i < resto ? 1 : 0));
      novas.push({
        ordem: i,
        nome: `Fase ${i + 1}`,
        dataInicio: somarMeses(rascunho.dataInicio, mes - 1),
        dataFim: somarMeses(rascunho.dataInicio, mes + duracao - 2),
      });
      mes += duracao;
    }
    // Gerar fases zera a alocação: os índices antigos apontariam para fases que
    // não existem mais. A conferência `alocacao_fases` acende vermelho até a
    // distribuição ser refeita na aba Tipologias.
    alterar({ usaFases: true, fases: novas, alocacoes: [] });
  };

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Identificação"
        description="Nome, localização e uso do empreendimento."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome da modelagem</Label>
            <Input
              className={financeDetailFieldClassName}
              value={rascunho.nome ?? ''}
              onChange={(e) => alterar({ nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Localização</Label>
            <Input
              className={financeDetailFieldClassName}
              value={rascunho.localizacao ?? ''}
              onChange={(e) => alterar({ localizacao: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de uso</Label>
            <Input
              className={financeDetailFieldClassName}
              value={rascunho.tipoUso ?? ''}
              onChange={(e) => alterar({ tipoUso: e.target.value })}
              placeholder="Residencial, misto, comercial…"
            />
          </div>
          <div className="space-y-2">
            <Label>Moeda</Label>
            <Input
              className={financeDetailFieldClassName}
              value={rascunho.moeda ?? 'USD'}
              maxLength={3}
              onChange={(e) => alterar({ moeda: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Cronograma"
        description="O mês 1 é a data de início. As datas derivadas aparecem abaixo em tempo real."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Data do mês 1</Label>
            <Input
              type="date"
              className={financeDetailFieldClassName}
              value={rascunho.dataInicio}
              onChange={(e) => alterar({ dataInicio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Meses de aprovação</Label>
            <Input
              type="number"
              min={0}
              className={financeDetailFieldClassName}
              value={rascunho.mesesAprovacao}
              onChange={(e) => alterar({ mesesAprovacao: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Meses de construção</Label>
            <Input
              type="number"
              min={0}
              className={financeDetailFieldClassName}
              value={rascunho.mesesConstrucao}
              onChange={(e) => alterar({ mesesConstrucao: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Meses de pós-obra</Label>
            <Input
              type="number"
              min={0}
              className={financeDetailFieldClassName}
              value={rascunho.mesesPosObra}
              onChange={(e) => alterar({ mesesPosObra: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Horizonte máximo (meses)</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              value={rascunho.horizonteMaximo ?? 60}
              onChange={(e) => alterar({ horizonteMaximo: Number(e.target.value) || 60 })}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-4">
          {[
            { rotulo: 'Prazo total', valor: `${cr.prazoTotal} meses` },
            { rotulo: `Início da obra (mês ${cr.mesInicioObra})`, valor: dataCurta(cr.dataInicioObra) },
            { rotulo: `Fim da obra (mês ${cr.mesFimObra})`, valor: dataCurta(cr.dataFimObra) },
            { rotulo: `Saída (mês ${cr.mesSaida})`, valor: dataCurta(cr.dataSaida) },
          ].map((d) => (
            <div key={d.rotulo}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.rotulo}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{d.valor}</p>
            </div>
          ))}
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Fases"
        description="Opcional. Sem fases o empreendimento é uma frente única: obra linear na janela de construção e terreno inteiro no mês 1."
      >
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <Switch checked={!!rascunho.usaFases} onCheckedChange={alternarFases} />
            Dividir o empreendimento em fases
          </label>
          {rascunho.usaFases ? (
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <Switch
                checked={!!rascunho.terrenoPorFase}
                onCheckedChange={(v) => alterar({ terrenoPorFase: v })}
              />
              Alocar o terreno por fase (em vez de tudo no mês 1)
            </label>
          ) : null}
        </div>

        {rascunho.usaFases ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Quantidade de fases</Label>
                <Input
                  type="number"
                  min={1}
                  className={financeDetailFieldClassName}
                  value={quantidadeFases}
                  onChange={(e) => setQuantidadeFases(Number(e.target.value) || 1)}
                />
              </div>
              <Button type="button" variant="outline" onClick={gerarFases}>
                Gerar
              </Button>
              <p className="text-xs text-slate-500">
                Divide a janela de obra (mês {cr.mesInicioObra} ao {cr.mesFimObra}) em partes iguais. É um
                chute inicial — ajuste as datas depois.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={`${cabecalho} text-right`}>Ordem</th>
                    <th className={`${cabecalho} text-left`}>Nome</th>
                    <th className={`${cabecalho} text-left`}>Data início</th>
                    <th className={`${cabecalho} text-left`}>Data fim</th>
                    <th className={`${cabecalho} bg-slate-50 text-right`}>Mês início</th>
                    <th className={`${cabecalho} bg-slate-50 text-right`}>Mês fim</th>
                    <th className={`${cabecalho} bg-slate-50 text-right`}>Duração</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fases.map((f, i) => {
                    // Índices derivados pelo motor — a tela não recalcula data → mês.
                    const d = cr.fases[i];
                    const duracao = d ? d.mesFim - d.mesInicio + 1 : 0;
                    const invertida = !!d && d.mesFim < d.mesInicio;
                    const estoura = !!d && d.mesFim > cr.prazoTotal;
                    return (
                      <tr key={f.id ?? `nova-${i}`} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1.5 text-right text-sm tabular-nums text-slate-500">
                          {i + 1}
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            className={celula}
                            value={f.nome}
                            onChange={(e) => mudarFase(i, { nome: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="date"
                            className={celula}
                            value={f.dataInicio}
                            onChange={(e) => mudarFase(i, { dataInicio: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="date"
                            className={celula}
                            value={f.dataFim}
                            onChange={(e) => mudarFase(i, { dataFim: e.target.value })}
                          />
                        </td>
                        <td className={lido}>{d?.mesInicio ?? '—'}</td>
                        <td className={cn(lido, estoura && 'text-red-600')}>{d?.mesFim ?? '—'}</td>
                        <td className={cn(lido, invertida && 'text-red-600')}>
                          {invertida ? 'invertida' : `${duracao} ${duracao === 1 ? 'mês' : 'meses'}`}
                        </td>
                        <td className="px-1 py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => removerFase(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {fases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-8 text-center text-sm text-slate-500">
                        Nenhuma fase cadastrada — o cálculo segue como frente única.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Régua sobre a linha do tempo do projeto: sobreposição e buraco ficam
                visíveis de imediato, sem precisar ler a tabela. */}
            {fases.length > 0 && cr.prazoTotal > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Linha do tempo — mês 1 ao {cr.prazoTotal}
                </p>
                <div className="space-y-1.5">
                  {cr.fases.map((d, i) => {
                    const inicio = Math.max(1, Math.min(d.mesInicio, cr.prazoTotal));
                    const fim = Math.max(inicio, Math.min(Math.max(d.mesFim, d.mesInicio), cr.prazoTotal));
                    const esquerda = ((inicio - 1) / cr.prazoTotal) * 100;
                    const largura = ((fim - inicio + 1) / cr.prazoTotal) * 100;
                    const fora = d.mesFim > cr.prazoTotal || d.mesInicio < 1;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs text-slate-600">{d.nome || `Fase ${i + 1}`}</span>
                        <div className="relative h-4 flex-1 rounded bg-slate-100">
                          <div
                            className={cn(
                              'absolute top-0.5 h-3 rounded-sm',
                              fora ? 'bg-red-400' : 'bg-slate-700',
                            )}
                            style={{ left: `${esquerda}%`, width: `${largura}%` }}
                            title={`Mês ${d.mesInicio} ao ${d.mesFim}`}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-500">
                          {d.mesInicio}–{d.mesFim}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}
