'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { dataCurta } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

export function AbaPremissas({ rascunho, alterar, resultado }: Props) {
  const cr = resultado.cronograma;

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
    </div>
  );
}
