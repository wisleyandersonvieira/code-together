'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Save, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceDetailHeader, financeDetailTabsTriggerClassName } from '@/components/finance/detail-ui';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import { cn } from '@/lib/utils';
import {
  bloqueiaSalvamento,
  calcular,
  comParcelaNoMes,
  editaPlanoDeAportes,
  mapearModelInput,
  semParcelaNoMes,
} from '@/lib/modelagem';
import type {
  AporteParcela,
  Financiamento,
  LinhaFluxo,
  ModelInput,
  PlanoAportes,
} from '@/lib/modelagem';

import loadModelagemCompletaAction from '@/actions/loadModelagemCompleta';
import updateModelagemPremissasAction from '@/actions/updateModelagemPremissas';
import createModelagemUnidadeAction from '@/actions/createModelagemUnidade';
import updateModelagemUnidadeAction from '@/actions/updateModelagemUnidade';
import deleteModelagemUnidadeAction from '@/actions/deleteModelagemUnidade';
import createModelagemCustoAction from '@/actions/createModelagemCusto';
import updateModelagemCustoAction from '@/actions/updateModelagemCusto';
import deleteModelagemCustoAction from '@/actions/deleteModelagemCusto';
import createModelagemSocioAction from '@/actions/createModelagemSocio';
import updateModelagemSocioAction from '@/actions/updateModelagemSocio';
import deleteModelagemSocioAction from '@/actions/deleteModelagemSocio';
import saveModelagemAportesAction from '@/actions/saveModelagemAportes';
import createModelagemAporteParcelaAction from '@/actions/createModelagemAporteParcela';
import updateModelagemAporteParcelaAction from '@/actions/updateModelagemAporteParcela';
import deleteModelagemAporteParcelaAction from '@/actions/deleteModelagemAporteParcela';
import deleteModelagemAporteParcelasTodasAction from '@/actions/deleteModelagemAporteParcelasTodas';
import createModelagemFaseAction from '@/actions/createModelagemFase';
import updateModelagemFaseAction from '@/actions/updateModelagemFase';
import deleteModelagemFaseAction from '@/actions/deleteModelagemFase';
import saveModelagemUnidadeFaseAction from '@/actions/saveModelagemUnidadeFase';
import deleteModelagemUnidadeFaseAction from '@/actions/deleteModelagemUnidadeFase';
import saveModelagemFinanciamentoAction from '@/actions/saveModelagemFinanciamento';
import saveModelagemReceitaAction from '@/actions/saveModelagemReceita';
import saveModelagemVendaUnidadeAction from '@/actions/saveModelagemVendaUnidade';
import upsertModelagemOverrideAction from '@/actions/upsertModelagemOverride';
import deleteModelagemOverrideAction from '@/actions/deleteModelagemOverride';
import deleteModelagemOverridesLinhaAction from '@/actions/deleteModelagemOverridesLinha';
import deleteModelagemOverridesTodosAction from '@/actions/deleteModelagemOverridesTodos';

import { AbaPremissas } from './AbaPremissas';
import { AbaUnidades } from './AbaUnidades';
import { AbaAportes } from './AbaAportes';
import { AbaCustos } from './AbaCustos';
import { AbaFinanciamento } from './AbaFinanciamento';
import { AbaSocios } from './AbaSocios';
import { AbaReceita } from './AbaReceita';
import { AbaFluxoCaixa } from './AbaFluxoCaixa';
import { AbaResultado } from './AbaResultado';
import { AbaDemandaCaixa } from './AbaDemandaCaixa';
import { AbaSensibilidade } from './AbaSensibilidade';
import { PainelConferencias } from './PainelConferencias';
import { exportarFluxoCsv, exportarModelagemPdf, exportarXlsx } from './exportar';
import { dinheiro, multiplo, percentual } from './formato';

const ABAS = [
  { valor: 'premissas', rotulo: 'Premissas' },
  { valor: 'unidades', rotulo: 'Unidades' },
  { valor: 'aportes', rotulo: 'Aportes' },
  { valor: 'custos', rotulo: 'Custos' },
  { valor: 'financiamento', rotulo: 'Financiamento' },
  { valor: 'socios', rotulo: 'Sócios' },
  { valor: 'receita', rotulo: 'Receita' },
  { valor: 'fluxo', rotulo: 'Fluxo de caixa' },
  { valor: 'resultado', rotulo: 'Resultado' },
  { valor: 'demanda', rotulo: 'Demanda de caixa' },
  { valor: 'sensibilidade', rotulo: 'Sensibilidade' },
];

export function ModelagemEditor({ modelagemId, onBack }: { modelagemId: number; onBack: () => void }) {
  const { toast } = useToast();
  const usuario = useCurrentUser();
  const [linhas, carregando, erro, recarregar] = useLoadAction(loadModelagemCompletaAction, [], {
    id: modelagemId,
    cenarioId: null,
  });

  const [rascunho, setRascunho] = useState<ModelInput | null>(null);
  /** Snapshot do que veio do banco — base do diff no salvamento. */
  const [original, setOriginal] = useState<ModelInput | null>(null);
  const [cenarioId, setCenarioId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

  const [salvarPremissas] = useMutateAction(updateModelagemPremissasAction);
  const [criarUnidade] = useMutateAction(createModelagemUnidadeAction);
  const [atualizarUnidade] = useMutateAction(updateModelagemUnidadeAction);
  const [removerUnidade] = useMutateAction(deleteModelagemUnidadeAction);
  const [criarCusto] = useMutateAction(createModelagemCustoAction);
  const [atualizarCusto] = useMutateAction(updateModelagemCustoAction);
  const [removerCusto] = useMutateAction(deleteModelagemCustoAction);
  const [criarSocio] = useMutateAction(createModelagemSocioAction);
  const [atualizarSocio] = useMutateAction(updateModelagemSocioAction);
  const [removerSocio] = useMutateAction(deleteModelagemSocioAction);
  const [salvarAportes] = useMutateAction(saveModelagemAportesAction);
  const [criarParcela] = useMutateAction(createModelagemAporteParcelaAction);
  const [atualizarParcela] = useMutateAction(updateModelagemAporteParcelaAction);
  const [removerParcela] = useMutateAction(deleteModelagemAporteParcelaAction);
  const [removerParcelasTodas] = useMutateAction(deleteModelagemAporteParcelasTodasAction);
  const [criarFase] = useMutateAction(createModelagemFaseAction);
  const [atualizarFase] = useMutateAction(updateModelagemFaseAction);
  const [removerFase] = useMutateAction(deleteModelagemFaseAction);
  const [salvarAlocacao] = useMutateAction(saveModelagemUnidadeFaseAction);
  const [removerAlocacao] = useMutateAction(deleteModelagemUnidadeFaseAction);
  const [salvarFinanciamento] = useMutateAction(saveModelagemFinanciamentoAction);
  const [salvarReceita] = useMutateAction(saveModelagemReceitaAction);
  const [salvarVenda] = useMutateAction(saveModelagemVendaUnidadeAction);
  const [gravarOverride] = useMutateAction(upsertModelagemOverrideAction);
  const [apagarOverride] = useMutateAction(deleteModelagemOverrideAction);
  const [apagarOverridesLinha] = useMutateAction(deleteModelagemOverridesLinhaAction);
  const [apagarOverridesTodos] = useMutateAction(deleteModelagemOverridesTodosAction);

  useEffect(() => {
    const linha = Array.isArray(linhas) ? linhas[0] : null;
    if (!linha) return;
    const input = mapearModelInput(linha);
    setRascunho(input);
    setOriginal(JSON.parse(JSON.stringify(input)));
    const base = (linha.cenarios ?? []).find((c: any) => c.is_baseline) ?? (linha.cenarios ?? [])[0];
    setCenarioId(base?.id ?? null);
  }, [linhas]);

  const alterar = useCallback((patch: Partial<ModelInput>) => {
    setRascunho((atual) => (atual ? { ...atual, ...patch } : atual));
  }, []);

  // O motor roda a cada mudança: sem botão de "recalcular", sem estado intermediário.
  const resultado = useMemo(() => (rascunho ? calcular(rascunho) : null), [rascunho]);
  /** Mesma modelagem sem override nenhum — é o que o tooltip da célula mostra. */
  const resultadoAutomatico = useMemo(
    () => (rascunho ? calcular({ ...rascunho, overrides: [] }) : null),
    [rascunho],
  );

  // ─── Plano de aportes ─────────────────────────────────────────────────────
  /**
   * Substitui o plano inteiro de uma vez, gravando na hora.
   *
   * É operação em lote e destrutiva (gerador de parcelas, congelar curva), sempre
   * precedida de confirmação na aba. Fazer isso pelo diff do salvamento daria o
   * mesmo resultado, mas com uma janela em que o banco e a tela discordam sobre
   * quantas parcelas existem — e é justamente aí que o UNIQUE (modelagem_id, mes)
   * estoura.
   */
  const substituirParcelas = async (parcelas: AporteParcela[], patch?: Partial<PlanoAportes>) => {
    if (!rascunho?.aportes) return;
    const plano = { ...rascunho.aportes, ...patch };
    try {
      await removerParcelasTodas({ modelagemId });
      const gravadas: AporteParcela[] = [];
      for (const p of parcelas) {
        const r = await criarParcela({
          modelagemId,
          mes: p.mes,
          valor: p.valor,
          observacao: p.observacao ?? '',
        });
        gravadas.push({ ...p, id: Array.isArray(r) ? r[0]?.id : undefined });
      }
      const novo = { ...plano, parcelas: gravadas };
      setRascunho((atual) => (atual ? { ...atual, aportes: novo } : atual));
      // O original acompanha: as parcelas já estão no banco, então o diff do
      // salvamento não tem mais nada a fazer com elas.
      setOriginal((atual) =>
        atual ? { ...atual, aportes: JSON.parse(JSON.stringify(novo)) } : atual,
      );
    } catch (e: any) {
      toast({
        title: 'Não foi possível gravar o plano de aportes',
        description: e?.message ?? String(e),
        variant: 'destructive',
      });
    }
  };

  // ─── Overrides: persistem na hora, não esperam o botão salvar ──────────────
  const aplicarOverride = async (mes: number, linha: LinhaFluxo, valor: number | null) => {
    if (!rascunho || cenarioId == null) return;

    // A linha de aporte com o plano ligado NÃO vira override: ela edita a parcela
    // daquele mês. Override e plano são duas fontes para a mesma linha do fluxo;
    // manter as duas ativas seria criar sincronização onde tem de haver fonte única.
    // A regra e a transformação são puras, em lib/modelagem/aportes.ts.
    if (editaPlanoDeAportes(rascunho, linha)) {
      const novoValor = valor ?? 0;
      setRascunho((atual) => (atual ? comParcelaNoMes(atual, mes, valor) : atual));
      try {
        // Upsert por (modelagem_id, mes): a célula do fluxo já grava na hora, e
        // a parcela do mês passa a se comportar do mesmo jeito.
        const r = await criarParcela({ modelagemId, mes, valor: novoValor, observacao: '' });
        const id = Array.isArray(r) ? r[0]?.id : undefined;
        if (id) {
          setRascunho((atual) =>
            atual?.aportes
              ? {
                  ...atual,
                  aportes: {
                    ...atual.aportes,
                    parcelas: (atual.aportes.parcelas ?? []).map((p) =>
                      p.mes === mes ? { ...p, id: p.id ?? Number(id) } : p,
                    ),
                  },
                }
              : atual,
          );
        }
      } catch (e: any) {
        toast({
          title: 'Não foi possível gravar a parcela',
          description: e?.message ?? String(e),
          variant: 'destructive',
        });
      }
      return;
    }

    const outros = (rascunho.overrides ?? []).filter((o) => !(o.mes === mes && o.linha === linha));
    setRascunho({ ...rascunho, overrides: [...outros, { mes, linha, valor, limpar: valor === null }] });
    try {
      await gravarOverride({
        modelagemId,
        cenarioId,
        mes,
        linha,
        valor,
        limpar: valor === null,
        createdBy: usuario?.legacy_user_id ?? null,
      });
    } catch (e: any) {
      toast({ title: 'Não foi possível gravar o override', description: e.message, variant: 'destructive' });
    }
  };

  const reverterCelula = async (mes: number, linha: LinhaFluxo) => {
    if (!rascunho || cenarioId == null) return;

    // Mesmo desvio do aplicarOverride, do outro lado: com o plano ligado, o que
    // se reverte na linha de aporte é a parcela. Com confirmação, porque parcela
    // é input do usuário — não é um valor calculado que volta sozinho.
    if (editaPlanoDeAportes(rascunho, linha)) {
      const parcela = (rascunho.aportes?.parcelas ?? []).find((p) => p.mes === mes);
      if (!parcela) return;
      if (!window.confirm(`Remover a parcela do mês ${mes} do plano de aportes?`)) return;
      setRascunho((atual) => (atual ? semParcelaNoMes(atual, mes) : atual));
      if (parcela.id) await removerParcela({ id: parcela.id }).catch(() => undefined);
      return;
    }

    setRascunho({
      ...rascunho,
      overrides: (rascunho.overrides ?? []).filter((o) => !(o.mes === mes && o.linha === linha)),
    });
    await apagarOverride({ modelagemId, cenarioId, mes, linha }).catch(() => undefined);
  };

  const reverterLinha = async (linha: LinhaFluxo) => {
    if (!rascunho || cenarioId == null) return;
    setRascunho({ ...rascunho, overrides: (rascunho.overrides ?? []).filter((o) => o.linha !== linha) });
    await apagarOverridesLinha({ modelagemId, cenarioId, linha }).catch(() => undefined);
  };

  const reverterTudo = async () => {
    if (!rascunho || cenarioId == null) return;
    if (!window.confirm('Reverter TODAS as células manuais desta modelagem para automático?')) return;
    setRascunho({ ...rascunho, overrides: [] });
    await apagarOverridesTodos({ modelagemId, cenarioId }).catch(() => undefined);
    toast({ title: 'Modelagem revertida para automático' });
  };

  // ─── Exportação ───────────────────────────────────────────────────────────
  const exportar = async (tipo: 'pdf' | 'xlsx' | 'csv') => {
    if (!rascunho || !resultado || exportando) return;
    setExportando(tipo);
    try {
      // O PDF roda a sensibilidade (dezenas de passadas do motor) e o Excel
      // formata 60 colunas: os dois travam a thread por alguns segundos. Este
      // respiro deixa o React pintar o botão em estado de carregamento antes.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (tipo === 'pdf') exportarModelagemPdf(rascunho, resultado);
      else if (tipo === 'xlsx') await exportarXlsx(rascunho, resultado);
      else exportarFluxoCsv(rascunho, resultado);
    } catch (erro) {
      toast({
        title: 'Falha ao exportar',
        description: erro instanceof Error ? erro.message : 'Não foi possível gerar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setExportando(null);
    }
  };

  // ─── Salvamento ───────────────────────────────────────────────────────────
  const bloqueios = resultado ? bloqueiaSalvamento(resultado.conferencias) : [];

  const salvar = async () => {
    if (!rascunho || !original) return;
    if (bloqueios.length > 0) {
      toast({
        title: 'Salvamento bloqueado',
        description: bloqueios.map((b) => `${b.titulo}: ${b.detalhe}`).join(' '),
        variant: 'destructive',
      });
      return;
    }
    setSalvando(true);
    try {
      await salvarPremissas({
        id: modelagemId,
        nome: rascunho.nome,
        localizacao: rascunho.localizacao,
        tipoUso: rascunho.tipoUso,
        moeda: rascunho.moeda,
        dataInicio: rascunho.dataInicio,
        mesesAprovacao: rascunho.mesesAprovacao,
        mesesConstrucao: rascunho.mesesConstrucao,
        mesesPosObra: rascunho.mesesPosObra,
        horizonteMaximo: rascunho.horizonteMaximo,
        usaFases: !!rascunho.usaFases,
        terrenoPorFase: !!rascunho.terrenoPorFase,
        dataBase: null,
        revisao: '',
        status: null,
      });

      // Diff por id: o que tem id foi atualizado, o que não tem é novo, e o que
      // sumiu da lista foi removido. Ids estáveis importam — apagar e reinserir
      // quebraria os vínculos de venda por unidade.
      //
      // Devolve os ids alinhados com `atuais`, incluindo os recém-criados: a
      // alocação por fase é gravada por (unidade_id, fase_id), e sem os ids das
      // linhas novas ela não teria como ser escrita no mesmo salvamento.
      const sincronizar = async (
        atuais: any[],
        anteriores: any[],
        criar: (x: any, i: number) => Promise<any>,
        atualizar: (x: any, i: number) => Promise<any>,
        remover: (id: number) => Promise<any>,
      ): Promise<(number | null)[]> => {
        const idsAtuais = new Set(atuais.map((x) => x.id).filter(Boolean));
        for (const antigo of anteriores) {
          if (antigo.id && !idsAtuais.has(antigo.id)) await remover(antigo.id);
        }
        const ids: (number | null)[] = [];
        for (let i = 0; i < atuais.length; i++) {
          if (atuais[i].id) {
            await atualizar(atuais[i], i);
            ids.push(Number(atuais[i].id));
          } else {
            const criado = await criar(atuais[i], i);
            const id = Array.isArray(criado) ? criado[0]?.id : undefined;
            ids.push(id == null ? null : Number(id));
          }
        }
        return ids;
      };

      const idsUnidades = await sincronizar(
        rascunho.unidades,
        original.unidades,
        (u, i) => criarUnidade({ modelagemId, ordem: i, ...u, observacoes: '' }),
        (u, i) => atualizarUnidade({ id: u.id, ordem: i, ...u, observacoes: '' }),
        (id) => removerUnidade({ id }),
      );

      await sincronizar(
        rascunho.custosAdicionais ?? [],
        original.custosAdicionais ?? [],
        (c, i) => criarCusto({ modelagemId, ordem: i, ...c }),
        (c, i) => atualizarCusto({ id: c.id, ordem: i, ...c }),
        (id) => removerCusto({ id }),
      );

      await sincronizar(
        rascunho.socios ?? [],
        original.socios ?? [],
        (s, i) => criarSocio({ modelagemId, ordem: i, ...s, observacoes: '' }),
        (s, i) => atualizarSocio({ id: s.id, ordem: i, ...s, observacoes: '' }),
        (id) => removerSocio({ id }),
      );

      // Cabeçalho do plano de aportes. Vai antes das parcelas: se o INSERT do
      // cabeçalho falhar, não faz sentido gravar parcela nenhuma.
      const plano = rascunho.aportes;
      if (plano) {
        await salvarAportes({
          modelagemId,
          modoAporte: plano.modoAporte,
          aporteBaseTotal: plano.aporteBaseTotal,
          valorTotalAlvo: plano.valorTotalAlvo,
        });
        // As parcelas editadas pela linha do fluxo já foram gravadas na hora; as
        // editadas na aba entram aqui, pelo mesmo diff por id das demais listas.
        await sincronizar(
          plano.parcelas ?? [],
          original.aportes?.parcelas ?? [],
          (p) => criarParcela({ modelagemId, mes: p.mes, valor: p.valor, observacao: p.observacao ?? '' }),
          (p) => atualizarParcela({ id: p.id, mes: p.mes, valor: p.valor, observacao: p.observacao ?? '' }),
          (id) => removerParcela({ id }),
        );
      }

      const idsFases = await sincronizar(
        rascunho.fases ?? [],
        original.fases ?? [],
        (f, i) => criarFase({ modelagemId, ordem: i, ...f }),
        (f, i) => atualizarFase({ id: f.id, ordem: i, ...f }),
        (id) => removerFase({ id }),
      );

      // Alocação por fase. Vai depois de tipologias e fases porque depende dos ids
      // dos dois, e é gravada pelo PAR (unidade, fase), que é a chave natural — a
      // linha de junção não tem identidade própria na tela.
      const par = (a: { unidadeIndex: number; faseIndex: number }) =>
        `${idsUnidades[a.unidadeIndex] ?? 'x'}:${idsFases[a.faseIndex] ?? 'x'}`;
      const atuaisAlocacao = new Map(
        (rascunho.alocacoes ?? []).filter((a) => a.quantidade > 0).map((a) => [par(a), a]),
      );
      for (const antiga of original.alocacoes ?? []) {
        const unidadeId = idsUnidades[antiga.unidadeIndex];
        const faseId = idsFases[antiga.faseIndex];
        if (unidadeId == null || faseId == null) continue;
        if (!atuaisAlocacao.has(par(antiga))) await removerAlocacao({ unidadeId, faseId });
      }
      for (const a of atuaisAlocacao.values()) {
        const unidadeId = idsUnidades[a.unidadeIndex];
        const faseId = idsFases[a.faseIndex];
        if (unidadeId == null || faseId == null) continue;
        await salvarAlocacao({ modelagemId, unidadeId, faseId, quantidade: a.quantidade });
      }

      await salvarFinanciamento({ modelagemId, ...rascunho.financiamento });
      await salvarReceita({ modelagemId, ...rascunho.receita });

      for (const venda of rascunho.receita.vendasPorUnidade ?? []) {
        const unidade = rascunho.unidades[venda.unidadeIndex];
        if (unidade?.id) {
          await salvarVenda({ modelagemId, unidadeId: unidade.id, mesVenda: venda.mesVenda });
        }
      }

      toast({ title: 'Modelagem salva' });
      recarregar();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando && !rascunho) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando modelagem…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Não foi possível carregar a modelagem: {String(erro.message ?? erro)}
      </div>
    );
  }

  if (!rascunho || !resultado || !resultadoAutomatico) return null;

  const ind = resultado.indicadores;

  return (
    <div className="space-y-6">
      <FinanceDetailHeader
        title={rascunho.nome || 'Modelagem'}
        subtitle={`${rascunho.localizacao || 'Sem localização'} · ${resultado.cronograma.prazoTotal} meses · VGV ${dinheiro(resultado.agregados.vgv, rascunho.moeda)}`}
        onBack={onBack}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { r: 'Lucro', v: dinheiro(resultado.apuracao.lucroProjeto, rascunho.moeda) },
            { r: 'MOIC', v: multiplo(ind.moic) },
            { r: 'TIR anual', v: percentual(ind.tirAnual) },
            { r: 'Equity', v: dinheiro(resultado.apuracao.equityTotal, rascunho.moeda) },
          ].map((k) => (
            <span key={k.r} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-slate-500">{k.r}: </span>
              <strong className="tabular-nums text-slate-900">{k.v}</strong>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" disabled={exportando !== null}>
                {exportando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {exportando ? 'Gerando…' : 'Exportar'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => exportar('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Relatório PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportar('xlsx')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Planilha Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportar('csv')}>
                <Table2 className="mr-2 h-4 w-4" />
                CSV do fluxo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" onClick={salvar} disabled={salvando || bloqueios.length > 0}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <PainelConferencias conferencias={resultado.conferencias} compacto />

      <Tabs defaultValue="premissas" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50/85 p-2 shadow-sm md:grid-cols-5">
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor} className={cn(financeDetailTabsTriggerClassName, 'text-xs md:text-sm')}>
              {a.rotulo}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="premissas">
            <AbaPremissas rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="unidades">
            <AbaUnidades rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="aportes">
            <AbaAportes
              rascunho={rascunho}
              alterar={alterar}
              resultado={resultado}
              substituirParcelas={substituirParcelas}
              reverterLinha={reverterLinha}
            />
          </TabsContent>
          <TabsContent value="custos">
            <AbaCustos rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="financiamento">
            <AbaFinanciamento rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="socios">
            <AbaSocios rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="receita">
            <AbaReceita rascunho={rascunho} alterar={alterar} resultado={resultado} />
          </TabsContent>
          <TabsContent value="fluxo">
            <AbaFluxoCaixa
              rascunho={rascunho}
              resultado={resultado}
              resultadoAutomatico={resultadoAutomatico}
              aplicarOverride={aplicarOverride}
              reverterCelula={reverterCelula}
              reverterLinha={reverterLinha}
              reverterTudo={reverterTudo}
            />
          </TabsContent>
          <TabsContent value="resultado">
            <AbaResultado rascunho={rascunho} resultado={resultado} />
          </TabsContent>
          <TabsContent value="demanda">
            <AbaDemandaCaixa
              rascunho={rascunho}
              resultado={resultado}
              aplicarDimensionamento={(fin: Financiamento) => alterar({ financiamento: fin })}
            />
          </TabsContent>
          <TabsContent value="sensibilidade">
            <AbaSensibilidade rascunho={rascunho} resultado={resultado} />
          </TabsContent>
        </div>
      </Tabs>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-900">Painel de validação</p>
        <PainelConferencias conferencias={resultado.conferencias} />
      </div>
    </div>
  );
}
