'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { ChevronDown, Copy, Download, FileSpreadsheet, FileText, Loader2, Save, Table2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FinanceDetailHeader,
  financeDetailTabsTriggerCompactClassName,
} from '@/components/finance/detail-ui';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import { cn } from '@/lib/utils';
import {
  bloqueiaSalvamento,
  calcular,
  aporteSomenteLeitura,
  AVISO_APORTE_POR_SOCIO,
  comParcelaNoMes,
  editaPlanoDeAportes,
  mapearModelInput,
  semParcelaNoMes,
} from '@/lib/modelagem';
import type {
  AporteParcela,
  ChaveOverride,
  Financiamento,
  ModelInput,
  PlanoAportes,
} from '@/lib/modelagem';

import loadModelagemCompletaAction from '@/actions/loadModelagemCompleta';
import updateModelagemPremissasAction from '@/actions/updateModelagemPremissas';
import duplicarModelagemAction from '@/actions/duplicarModelagem';
import createModelagemUnidadeAction from '@/actions/createModelagemUnidade';
import updateModelagemUnidadeAction from '@/actions/updateModelagemUnidade';
import deleteModelagemUnidadeAction from '@/actions/deleteModelagemUnidade';
import createModelagemCustoAction from '@/actions/createModelagemCusto';
import updateModelagemCustoAction from '@/actions/updateModelagemCusto';
import deleteModelagemCustoAction from '@/actions/deleteModelagemCusto';
import createModelagemCustoParcelaAction from '@/actions/createModelagemCustoParcela';
import updateModelagemCustoParcelaAction from '@/actions/updateModelagemCustoParcela';
import deleteModelagemCustoParcelaAction from '@/actions/deleteModelagemCustoParcela';
import deleteModelagemCustoParcelasDoCustoAction from '@/actions/deleteModelagemCustoParcelasDoCusto';
import createModelagemSocioAction from '@/actions/createModelagemSocio';
import updateModelagemSocioAction from '@/actions/updateModelagemSocio';
import deleteModelagemSocioAction from '@/actions/deleteModelagemSocio';
import createModelagemSocioAporteAction from '@/actions/createModelagemSocioAporte';
import updateModelagemSocioAporteAction from '@/actions/updateModelagemSocioAporte';
import deleteModelagemSocioAporteAction from '@/actions/deleteModelagemSocioAporte';
import deleteModelagemSocioAportesDoSocioAction from '@/actions/deleteModelagemSocioAportesDoSocio';
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
import createModelagemFacilidadeAction from '@/actions/createModelagemFacilidade';
import deleteModelagemFacilidadeAction from '@/actions/deleteModelagemFacilidade';
import saveModelagemLocacaoAction from '@/actions/saveModelagemLocacao';
import createModelagemOpexAction from '@/actions/createModelagemOpex';
import updateModelagemOpexAction from '@/actions/updateModelagemOpex';
import deleteModelagemOpexAction from '@/actions/deleteModelagemOpex';
import saveModelagemOcupacaoAction from '@/actions/saveModelagemOcupacao';
import deleteModelagemOcupacaoAction from '@/actions/deleteModelagemOcupacao';
import saveModelagemBenchmarkPontoAction from '@/actions/saveModelagemBenchmarkPonto';
import deleteModelagemBenchmarkPontoAction from '@/actions/deleteModelagemBenchmarkPonto';
import saveModelagemReceitaAction from '@/actions/saveModelagemReceita';
import saveModelagemVendaUnidadeAction from '@/actions/saveModelagemVendaUnidade';
import createModelagemTakedownAction from '@/actions/createModelagemTakedown';
import updateModelagemTakedownAction from '@/actions/updateModelagemTakedown';
import deleteModelagemTakedownAction from '@/actions/deleteModelagemTakedown';
import upsertModelagemOverrideAction from '@/actions/upsertModelagemOverride';
import deleteModelagemOverrideAction from '@/actions/deleteModelagemOverride';
import deleteModelagemOverridesLinhaAction from '@/actions/deleteModelagemOverridesLinha';
import deleteModelagemOverridesTodosAction from '@/actions/deleteModelagemOverridesTodos';

import { AbaPremissas } from './AbaPremissas';
import { AbaUnidades } from './AbaUnidades';
import { AbaAportes } from './AbaAportes';
import { AbaCustos } from './AbaCustos';
import { AbaTimeline } from './AbaTimeline';
import { AbaFinanciamento } from './AbaFinanciamento';
import { AbaSocios } from './AbaSocios';
import { AbaReceita } from './AbaReceita';
import { AbaLocacaoSaida } from './AbaLocacaoSaida';
import { AbaOperacao } from './AbaOperacao';
import { SeloTipoModelagem } from './ModelagensList';
import { AbaFluxoCaixa } from './AbaFluxoCaixa';
import { AbaResultado } from './AbaResultado';
import { AbaDemandaCaixa } from './AbaDemandaCaixa';
import { AbaSensibilidade } from './AbaSensibilidade';
import { PainelConferencias } from './PainelConferencias';
import { exportarFluxoCsv, exportarModelagemPdf, exportarPdfSocios, exportarXlsx } from './exportar';
import { dinheiro, multiplo, numero, percentual } from './formato';

/**
 * As abas do editor, por modo de negócio.
 *
 * NENHUMA aba do modo venda muda — nem de rótulo, nem de ordem, nem de conteúdo.
 * O modo locação troca UMA (Receita vira "Locação e saída", porque não há venda
 * de unidade a modelar) e ACRESCENTA uma (Operação: OPEX e curva de ocupação).
 *
 * A grade do TabsList é de 6 colunas com o Exportar na 12ª célula. No modo
 * locação são 13 itens, então a última linha passa a ter uma célula a mais —
 * o `grid` acomoda sozinho, sem quebrar o alinhamento das duas primeiras.
 */
const ABAS_VENDA = [
  { valor: 'premissas', rotulo: 'Premissas' },
  { valor: 'unidades', rotulo: 'Unidades' },
  { valor: 'aportes', rotulo: 'Aportes' },
  { valor: 'custos', rotulo: 'Custos' },
  { valor: 'financiamento', rotulo: 'Financiamento' },
  { valor: 'socios', rotulo: 'Sócios' },
  { valor: 'receita', rotulo: 'Receita' },
  { valor: 'fluxo', rotulo: 'Fluxo de caixa' },
  { valor: 'timeline', rotulo: 'Linha do tempo' },
  { valor: 'resultado', rotulo: 'Resultado' },
  { valor: 'demanda', rotulo: 'Demanda de caixa' },
  { valor: 'sensibilidade', rotulo: 'Sensibilidade' },
];

const ABAS_LOCACAO = [
  { valor: 'premissas', rotulo: 'Premissas' },
  { valor: 'unidades', rotulo: 'Ativo locável' },
  { valor: 'operacao', rotulo: 'Operação' },
  { valor: 'aportes', rotulo: 'Aportes' },
  { valor: 'custos', rotulo: 'Custos' },
  { valor: 'financiamento', rotulo: 'Financiamento' },
  { valor: 'socios', rotulo: 'Sócios' },
  { valor: 'receita', rotulo: 'Locação e saída' },
  { valor: 'fluxo', rotulo: 'Fluxo de caixa' },
  { valor: 'timeline', rotulo: 'Linha do tempo' },
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
  const [aba, setAba] = useState('premissas');
  const [exportando, setExportando] = useState<'socios' | 'pdf' | 'xlsx' | 'csv' | null>(null);
  /** Natureza da linha, não premissa de cálculo — por isso fora do ModelInput. */
  const [ehModelo, setEhModelo] = useState(false);
  const [duplicando, setDuplicando] = useState(false);

  const [duplicar] = useMutateAction(duplicarModelagemAction);
  const [salvarPremissas] = useMutateAction(updateModelagemPremissasAction);
  const [criarUnidade] = useMutateAction(createModelagemUnidadeAction);
  const [atualizarUnidade] = useMutateAction(updateModelagemUnidadeAction);
  const [removerUnidade] = useMutateAction(deleteModelagemUnidadeAction);
  const [criarCusto] = useMutateAction(createModelagemCustoAction);
  const [atualizarCusto] = useMutateAction(updateModelagemCustoAction);
  const [removerCusto] = useMutateAction(deleteModelagemCustoAction);
  const [criarParcelaCusto] = useMutateAction(createModelagemCustoParcelaAction);
  const [atualizarParcelaCusto] = useMutateAction(updateModelagemCustoParcelaAction);
  const [removerParcelaCusto] = useMutateAction(deleteModelagemCustoParcelaAction);
  const [removerParcelasDoCusto] = useMutateAction(deleteModelagemCustoParcelasDoCustoAction);
  const [criarSocio] = useMutateAction(createModelagemSocioAction);
  const [atualizarSocio] = useMutateAction(updateModelagemSocioAction);
  const [removerSocio] = useMutateAction(deleteModelagemSocioAction);
  const [criarAporteSocio] = useMutateAction(createModelagemSocioAporteAction);
  const [atualizarAporteSocio] = useMutateAction(updateModelagemSocioAporteAction);
  const [removerAporteSocio] = useMutateAction(deleteModelagemSocioAporteAction);
  const [removerAportesDoSocio] = useMutateAction(deleteModelagemSocioAportesDoSocioAction);
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
  const [criarFacilidade] = useMutateAction(createModelagemFacilidadeAction);
  const [removerFacilidade] = useMutateAction(deleteModelagemFacilidadeAction);
  const [salvarLocacao] = useMutateAction(saveModelagemLocacaoAction);
  const [criarOpex] = useMutateAction(createModelagemOpexAction);
  const [atualizarOpex] = useMutateAction(updateModelagemOpexAction);
  const [removerOpex] = useMutateAction(deleteModelagemOpexAction);
  const [salvarOcupacao] = useMutateAction(saveModelagemOcupacaoAction);
  const [apagarOcupacao] = useMutateAction(deleteModelagemOcupacaoAction);
  const [salvarBenchmark] = useMutateAction(saveModelagemBenchmarkPontoAction);
  const [apagarBenchmark] = useMutateAction(deleteModelagemBenchmarkPontoAction);
  const [salvarReceita] = useMutateAction(saveModelagemReceitaAction);
  const [salvarVenda] = useMutateAction(saveModelagemVendaUnidadeAction);
  const [criarTakedown] = useMutateAction(createModelagemTakedownAction);
  const [atualizarTakedown] = useMutateAction(updateModelagemTakedownAction);
  const [removerTakedown] = useMutateAction(deleteModelagemTakedownAction);
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
    // `is_modelo` NÃO entra no ModelInput: não é premissa de cálculo, é natureza
    // da linha. O motor não sabe nem precisa saber que esta modelagem é o modelo.
    setEhModelo(!!linha.is_modelo);
  }, [linhas]);

  /**
   * Duplica a modelagem aberta. Na modelo é o caminho principal — é assim que o
   * plano de contas vira projeto —, e leva direto ao editor da cópia.
   */
  const duplicarEsta = async () => {
    const nome = window.prompt(
      ehModelo ? 'Nome da nova modelagem' : 'Nome da cópia',
      ehModelo ? 'Nova modelagem' : `Cópia de ${rascunho?.nome ?? ''}`,
    );
    if (!nome || !nome.trim()) return;
    setDuplicando(true);
    try {
      const r = await duplicar({ origemId: modelagemId, nome: nome.trim() });
      const id = Array.isArray(r) ? r[0]?.id : null;
      if (id) {
        toast({ title: 'Modelagem duplicada' });
        // Volta para a lista: ela recarrega e a cópia aparece. Navegar para
        // dentro da cópia daqui exigiria trocar o `modelagemId` do próprio
        // editor, e o rascunho não salvo desta tela se perderia sem aviso.
        onBack();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erro ao duplicar', description: msg, variant: 'destructive' });
    } finally {
      setDuplicando(false);
    }
  };

  const alterar = useCallback((patch: Partial<ModelInput>) => {
    setRascunho((atual) => (atual ? { ...atual, ...patch } : atual));
  }, []);

  /**
   * O modo de negócio da modelagem. Sai do RASCUNHO, não de um estado próprio,
   * porque ele é imutável depois de criada: não há caminho de edição, e portanto
   * não há o que sincronizar. Ausente = 'venda', como em todo o módulo.
   */
  const ehLocacao = (rascunho?.tipoModelagem ?? 'venda') === 'locacao';
  const abas = ehLocacao ? ABAS_LOCACAO : ABAS_VENDA;

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
  const aplicarOverride = async (mes: number, linha: ChaveOverride, valor: number | null) => {
    if (!rascunho || cenarioId == null) return;

    // Com cronograma por sócio a linha de aporte não aceita override: o motor
    // não teria a quem atribuir o valor. Avisar em vez de ignorar em silêncio —
    // silêncio aqui vira "o sistema não salva o que eu digito". A regra e a
    // frase são únicas, em lib/modelagem/aportes.ts, para a tela e o toast não
    // divergirem.
    if (aporteSomenteLeitura(rascunho, linha)) {
      toast({ title: 'Aporte por sócio', description: AVISO_APORTE_POR_SOCIO });
      return;
    }

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

  const reverterCelula = async (mes: number, linha: ChaveOverride) => {
    if (!rascunho || cenarioId == null) return;

    // Mesma guarda do aplicarOverride: não há o que reverter numa célula que
    // nunca aceitou edição.
    if (aporteSomenteLeitura(rascunho, linha)) {
      toast({ title: 'Aporte por sócio', description: AVISO_APORTE_POR_SOCIO });
      return;
    }

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

  const reverterLinha = async (linha: ChaveOverride) => {
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
  const exportar = async (tipo: 'socios' | 'pdf' | 'xlsx' | 'csv') => {
    if (!rascunho || !resultado || exportando) return;
    setExportando(tipo);
    try {
      // Os dois PDFs rodam a sensibilidade (dezenas de passadas do motor) e o
      // Excel formata 60 colunas: todos travam a thread por alguns segundos.
      // Este respiro deixa o React pintar o botão em estado de carregamento antes.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (tipo === 'socios') exportarPdfSocios(rascunho, resultado);
      else if (tipo === 'pdf') exportarModelagemPdf(rascunho, resultado);
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

      const custosAtuais = rascunho.custosAdicionais ?? [];
      const idsCustos = await sincronizar(
        custosAtuais,
        original.custosAdicionais ?? [],
        (c, i) => criarCusto({ modelagemId, ordem: i, ...c }),
        (c, i) => atualizarCusto({ id: c.id, ordem: i, ...c }),
        (id) => removerCusto({ id }),
      );

      // Parcelas dos custos (migration 1763000000). DEPOIS do sincronizar acima,
      // e usando os ids que ele devolve: um custo novo só tem id depois do INSERT,
      // e sem essa ordem as parcelas de um custo recém-criado se perderiam no
      // primeiro salvamento, em silêncio — que é o modo mais caro de falhar aqui.
      //
      // Custo removido não precisa de nada: modelagem_custo_parcelas.custo_id tem
      // ON DELETE CASCADE.
      const parcelasOriginais = new Map<number, typeof custosAtuais[number]['parcelas']>();
      for (const c of original.custosAdicionais ?? []) {
        if (c.id != null) parcelasOriginais.set(c.id, c.parcelas ?? []);
      }
      for (let i = 0; i < custosAtuais.length; i++) {
        const custoId = idsCustos[i];
        // Sem id o INSERT do custo falhou: não há a que amarrar a parcela, e
        // gravá-la em outro custo seria pior do que não gravar.
        if (custoId == null) continue;
        const atuais = custosAtuais[i].parcelas ?? [];
        const anteriores = parcelasOriginais.get(custoId) ?? [];
        if (anteriores.length > 0 && atuais.length > 0 && atuais.every((p) => p.id == null)) {
          // Assinatura do "gerar de novo": a lista inteira é nova. Um DELETE só
          // no lugar de N DELETEs do diff por id.
          await removerParcelasDoCusto({ custoId });
          for (let k = 0; k < atuais.length; k++) {
            await criarParcelaCusto({
              modelagemId,
              custoId,
              ordem: k,
              mes: atuais[k].mes,
              valor: atuais[k].valor,
            });
          }
          continue;
        }
        await sincronizar(
          atuais,
          anteriores,
          (p, k) => criarParcelaCusto({ modelagemId, custoId, ordem: k, mes: p.mes, valor: p.valor }),
          (p, k) => atualizarParcelaCusto({ id: p.id, ordem: k, mes: p.mes, valor: p.valor }),
          (id) => removerParcelaCusto({ id }),
        );
      }

      // `pctCapital` viaja como string vazia quando é nulo: a action usa NULLIF
      // para devolvê-lo a NULL no banco, e nulo é "usa a participação" — que é
      // diferente de zero, "não põe capital nenhum".
      const pctCapitalParam = (s: { pctCapital?: number | null }) =>
        s.pctCapital == null ? '' : String(s.pctCapital);
      const sociosAtuais = rascunho.socios ?? [];
      const idsSocios = await sincronizar(
        sociosAtuais,
        original.socios ?? [],
        (s, i) =>
          criarSocio({ modelagemId, ordem: i, ...s, pctCapital: pctCapitalParam(s), observacoes: '' }),
        (s, i) =>
          atualizarSocio({ id: s.id, ordem: i, ...s, pctCapital: pctCapitalParam(s), observacoes: '' }),
        (id) => removerSocio({ id }),
      );

      // Aportes por sócio (migration 1763100000). DEPOIS do sincronizar acima, e
      // usando os ids que ele devolve: um sócio novo só tem id depois do INSERT,
      // e sem essa ordem os aportes de um sócio recém-criado se perderiam no
      // primeiro salvamento, em silêncio. É o mesmo cuidado das parcelas de custo.
      //
      // Sócio removido não precisa de nada: modelagem_socio_aportes.socio_id tem
      // ON DELETE CASCADE.
      const aportesOriginais = new Map<number, typeof sociosAtuais[number]['aportes']>();
      for (const s of original.socios ?? []) {
        if (s.id != null) aportesOriginais.set(s.id, s.aportes ?? []);
      }
      for (let i = 0; i < sociosAtuais.length; i++) {
        const socioId = idsSocios[i];
        // Sem id o INSERT do sócio falhou: não há a quem amarrar o aporte, e
        // gravá-lo em outro sócio seria pior do que não gravar.
        if (socioId == null) continue;
        const atuais = sociosAtuais[i].aportes ?? [];
        const anteriores = aportesOriginais.get(socioId) ?? [];
        if (anteriores.length > 0 && atuais.length > 0 && atuais.every((a) => a.id == null)) {
          // Assinatura do "gerar de novo": a lista inteira é nova. Um DELETE só
          // no lugar de N DELETEs do diff por id.
          await removerAportesDoSocio({ socioId });
          for (let k = 0; k < atuais.length; k++) {
            await criarAporteSocio({
              modelagemId,
              socioId,
              ordem: k,
              mes: atuais[k].mes,
              valor: atuais[k].valor,
              observacao: atuais[k].observacao ?? '',
            });
          }
          continue;
        }
        await sincronizar(
          atuais,
          anteriores,
          (a, k) =>
            criarAporteSocio({
              modelagemId,
              socioId,
              ordem: k,
              mes: a.mes,
              valor: a.valor,
              observacao: a.observacao ?? '',
            }),
          (a, k) =>
            atualizarAporteSocio({
              id: a.id,
              ordem: k,
              mes: a.mes,
              valor: a.valor,
              observacao: a.observacao ?? '',
            }),
          (id) => removerAporteSocio({ id }),
        );
      }

      // Cabeçalho do plano de aportes. Vai antes das parcelas: se o INSERT do
      // cabeçalho falhar, não faz sentido gravar parcela nenhuma.
      const plano = rascunho.aportes;
      if (plano) {
        await salvarAportes({
          modelagemId,
          modoAporte: plano.modoAporte,
          aporteBaseTotal: plano.aporteBaseTotal,
          valorTotalAlvo: plano.valorTotalAlvo,
          regraRateioCapital: plano.regraRateioCapital,
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

      // ─── Facilidades de crédito (migration 1764200000) ───────────────────
      //
      // Diff por id como as demais listas. DUAS passadas, e a separação não é
      // estilo: `refinanciaFacilidadeId` é uma FK para a PRÓPRIA tabela, e a
      // facilidade apontada pode ser uma que ainda não existe quando a primeira é
      // gravada. Mandar o vínculo na primeira passada faria a FK estourar — ou,
      // pior, gravar `null` em silêncio.
      //
      // Por isso: passada 1 cria/atualiza tudo SEM o vínculo e colhe os ids;
      // passada 2 volta e grava só o `refinanciaFacilidadeId`, já com o mapa de
      // índice → id completo. É a mesma dança do `grupo_pai` na duplicação.
      const facilidadesAtuais = rascunho.financiamentos ?? [];
      const idsFacilidades = await sincronizar(
        facilidadesAtuais,
        original.financiamentos ?? [],
        (f, i) => criarFacilidade({ modelagemId, ordem: i, nome: f.nome ?? 'Financiamento' }),
        (f, i) =>
          salvarFinanciamento({
            modelagemId,
            ...f,
            ordem: i,
            // Passada 1: sem o vínculo. Ver acima.
            refinanciaFacilidadeId: null,
          }),
        (id) => removerFacilidade({ id }),
      );

      // Passada 2: o vínculo de refinanciamento, agora que todos os ids existem.
      // Só as facilidades que DECLARAM refinanciamento são revisitadas — um
      // UPDATE a mais por facilidade sem vínculo seria round-trip puro.
      for (let i = 0; i < facilidadesAtuais.length; i++) {
        const f = facilidadesAtuais[i];
        const alvo = f.refinanciaIndex;
        const id = idsFacilidades[i];
        if (id == null || alvo == null) continue;
        await salvarFinanciamento({
          modelagemId,
          ...f,
          id,
          ordem: i,
          refinanciaFacilidadeId: idsFacilidades[alvo] ?? null,
        });
      }

      // Curva do benchmark, POR FACILIDADE. Gravada pelo MÊS, que é a chave
      // natural — o ponto não tem identidade própria na tela, e o banco tem
      // UNIQUE (financiamento, mês).
      //
      // Apagar um ponto é diferente de gravá-lo com zero: sem linha, o motor usa
      // `benchmarkPadrao`. Por isso o que sumiu da tela é DELETE, não UPDATE 0.
      for (let i = 0; i < facilidadesAtuais.length; i++) {
        const financiamentoId = idsFacilidades[i];
        if (financiamentoId == null) continue;
        const curvaAtual = facilidadesAtuais[i].benchmarkCurva ?? [];
        const mesesAtuais = new Set(curvaAtual.map((ponto) => Math.trunc(ponto.mes)));
        // A facilidade ANTIGA na mesma posição: é dela que veio a curva que está
        // no banco. Uma facilidade recém-criada não tem curva anterior.
        const curvaAnterior = (original.financiamentos ?? [])[i]?.benchmarkCurva ?? [];
        for (const antigo of curvaAnterior) {
          if (!mesesAtuais.has(Math.trunc(antigo.mes))) {
            await apagarBenchmark({ modelagemId, financiamentoId, mes: antigo.mes });
          }
        }
        for (const ponto of curvaAtual) {
          await salvarBenchmark({ modelagemId, financiamentoId, mes: ponto.mes, valor: ponto.valor });
        }
      }
      await salvarReceita({ modelagemId, ...rascunho.receita });

      // ─── Modo locação (migration 1764100000) ─────────────────────────────
      //
      // Gravado só quando o tipo é 'locacao'. Numa modelagem de venda os três
      // blocos não têm o que gravar, e chamá-los criaria linha de cabeçalho —
      // inofensiva, mas mentirosa: a tabela passaria a dizer que existe uma
      // operação onde não existe.
      if (ehLocacao && rascunho.locacao) {
        await salvarLocacao({ modelagemId, ...rascunho.locacao });

        await sincronizar(
          rascunho.opex ?? [],
          original.opex ?? [],
          (o, i) => criarOpex({ modelagemId, ordem: i, ...o }),
          (o, i) => atualizarOpex({ id: o.id, ordem: i, ...o }),
          (id) => removerOpex({ id }),
        );

        // Curva de ocupação: chave natural é o MÊS, como a do benchmark. A
        // diferença é que aqui mês ausente é ocupação ZERO, não um padrão —
        // então apagar e gravar zero dão o mesmo número no fluxo. O DELETE
        // continua sendo o certo mesmo assim: um mês sem linha diz "ainda não
        // preenchi", e um zero declarado diz "aqui é vazio de propósito".
        const ocupacaoAtual = rascunho.ocupacao ?? [];
        const mesesOcupacao = new Set(ocupacaoAtual.map((ponto) => Math.trunc(ponto.mes)));
        for (const antigo of original.ocupacao ?? []) {
          if (!mesesOcupacao.has(Math.trunc(antigo.mes))) {
            await apagarOcupacao({ modelagemId, mes: antigo.mes });
          }
        }
        for (const ponto of ocupacaoAtual) {
          await salvarOcupacao({ modelagemId, mes: ponto.mes, ocupacaoPct: ponto.ocupacaoPct });
        }
      }

      for (const venda of rascunho.receita.vendasPorUnidade ?? []) {
        const unidade = rascunho.unidades[venda.unidadeIndex];
        if (unidade?.id) {
          await salvarVenda({ modelagemId, unidadeId: unidade.id, mesVenda: venda.mesVenda });
        }
      }

      // Takedowns. Depois de tipologias e fases, porque grava por id dos dois — e
      // pelo mesmo diff por id das demais listas, já que o lote TEM identidade
      // própria (dois lotes da mesma tipologia no mesmo mês são legítimos, então
      // o par (unidade, mês) não serve de chave).
      //
      // `faseId` fica nulo quando o lote não declara fase, ou quando declara uma
      // fase ainda sem id gravado: o vínculo é opcional e a venda não pode deixar
      // de ser salva por causa dele.
      await sincronizar(
        rascunho.receita.takedowns ?? [],
        original.receita.takedowns ?? [],
        (t, i) =>
          criarTakedown({
            modelagemId,
            unidadeId: idsUnidades[t.unidadeIndex],
            faseId: t.faseIndex == null ? null : (idsFases[t.faseIndex] ?? null),
            ordem: i,
            mes: t.mes,
            quantidade: t.quantidade,
            precoUnitario: t.precoUnitario,
            observacao: t.observacao ?? '',
          }),
        (t, i) =>
          atualizarTakedown({
            id: t.id,
            unidadeId: idsUnidades[t.unidadeIndex],
            faseId: t.faseIndex == null ? null : (idsFases[t.faseIndex] ?? null),
            ordem: i,
            mes: t.mes,
            quantidade: t.quantidade,
            precoUnitario: t.precoUnitario,
            observacao: t.observacao ?? '',
          }),
        (id) => removerTakedown({ id }),
      );

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
      {/* O SELO DO TIPO fica no título, e o tipo é SOMENTE LEITURA: ele não muda
          depois de criada. Cada modo tem campos que o outro ignora — preço de
          venda e takedowns de um lado; aluguel, OPEX e ocupação do outro —, e
          trocar deixaria campos órfãos de um modo dentro do outro, invisíveis
          para o motor e para a tela. Quem quer o outro modo, duplica: é o que a
          faixa logo abaixo diz, em vez de oferecer um select que não existe. */}
      <FinanceDetailHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {rascunho.nome || 'Modelagem'}
            <SeloTipoModelagem tipo={ehLocacao ? 'locacao' : 'venda'} />
          </span>
        }
        subtitle={
          ehLocacao
            ? // Numa locação o VGV é ignorado pelo motor: o subtítulo mostraria
              // zero, ou pior, um número que não entra em conta nenhuma.
              `${rascunho.localizacao || 'Sem localização'} · ${resultado.cronograma.prazoTotal} meses · ABL ${numero(resultado.agregados.ablSf)} sf · Saída ${dinheiro(resultado.indicadores.valorSaida ?? 0, rascunho.moeda)}`
            : `${rascunho.localizacao || 'Sem localização'} · ${resultado.cronograma.prazoTotal} meses · VGV ${dinheiro(resultado.agregados.vgv, rascunho.moeda)}`
        }
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
          <Button type="button" onClick={salvar} disabled={salvando || bloqueios.length > 0}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* A MODELO não mostra conferência nenhuma — nem a notificação compacta,
          nem o painel completo lá embaixo.

          O motivo: um plano de contas não tem unidades, receita nem cronograma,
          então quase toda conferência acende vermelho. Isso não é informação, é
          ruído — e ruído constante ensina o usuário a ignorar o painel
          justamente nas modelagens em que ele importa. A modelo não é uma
          modelagem inconsistente: é uma modelagem incompleta de propósito. */}
      {ehModelo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="flex-1 leading-5">
            <strong className="font-semibold">Esta é a modelagem modelo.</strong> Ela define o plano
            de contas padrão dos custos e não é excluída. Para criar uma modelagem de verdade, use
            Duplicar.
          </span>
          <Button type="button" variant="outline" onClick={duplicarEsta} disabled={duplicando}>
            {duplicando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Duplicar
          </Button>
        </div>
      ) : (
        /* Notificação de uma linha, e nada quando está tudo verde. `bloqueios`
           entra porque o motivo de o Salvar estar desabilitado precisa aparecer
           ANTES de o usuário tentar salvar, não só no toast depois da tentativa. */
        <PainelConferencias conferencias={resultado.conferencias} compacto bloqueios={bloqueios} />
      )}

      {/* Controlado (e não `defaultValue`) porque a aba Linha do tempo navega:
          clicar numa fase leva a Premissas, clicar num takedown leva a Receita. */}
      <Tabs value={aba} onValueChange={setAba} className="w-full">
        {/*
          Duas linhas de seis, com o Exportar ocupando a 12ª célula.

          `className="contents"` no TabsList remove a CAIXA do elemento sem mexer
          no aninhamento do DOM: os triggers continuam sendo filhos do
          role="tablist", então a semântica ARIA fica correta e o botão Exportar
          continua FORA da tablist — um botão que não é aba não pode ser filho de
          uma tablist. A navegação por setas do Radix não depende de layout: o
          roving focus resolve o próximo item por uma coleção de refs registradas
          (ver react-roving-focus), com o keydown em cada trigger.

          O risco conhecido de `display: contents` é a árvore de acessibilidade —
          navegadores antigos removiam o elemento dela junto com a caixa, e o
          role="tablist" sumia. Corrigido no Chrome 89+, Firefox e Safari 15.4+.
          Se aparecer regressão de leitor de tela, o fallback é TabsList normal
          com xl:grid-cols-6 e o Exportar de volta ao bloco de ações do header.

          A moldura que era do TabsList passou para o wrapper, senão ela sumiria
          junto com a caixa.
        */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50/85 p-2 shadow-sm sm:grid-cols-3 xl:grid-cols-6">
          <TabsList className="contents">
            {abas.map((a) => (
              <TabsTrigger
                key={a.valor}
                value={a.valor}
                className={cn(financeDetailTabsTriggerCompactClassName, 'text-xs md:text-[13px]')}
              >
                {a.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 12ª célula. Mesma altura e raio dos triggers, mas `outline`: é ação,
              não aba, e precisa parecer diferente. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={exportando !== null}
                className="min-h-[38px] rounded-lg px-3 py-2 text-[13px]"
              >
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
              <DropdownMenuItem onSelect={() => exportar('socios')}>
                <Users className="mr-2 h-4 w-4" />
                Relatório para sócios (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportar('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Relatório técnico (PDF)
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
        </div>

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
          {/* A MESMA chave de aba ('receita') serve os dois modos, e é
              deliberado: o rótulo muda, o componente muda, mas o endereço não —
              a aba Linha do tempo navega para 'receita' ao clicar num takedown, e
              um segundo nome quebraria essa navegação no modo venda sem ganho
              nenhum. */}
          <TabsContent value="receita">
            {ehLocacao ? (
              <AbaLocacaoSaida rascunho={rascunho} alterar={alterar} resultado={resultado} />
            ) : (
              <AbaReceita rascunho={rascunho} alterar={alterar} resultado={resultado} />
            )}
          </TabsContent>
          {/* Só existe no modo locação. Renderizar o TabsContent sempre não faria
              mal (o Radix só monta o ativo), mas o trigger correspondente não
              existe no modo venda e uma aba inalcançável é dívida esperando. */}
          {ehLocacao ? (
            <TabsContent value="operacao">
              <AbaOperacao rascunho={rascunho} alterar={alterar} resultado={resultado} />
            </TabsContent>
          ) : null}
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
          <TabsContent value="timeline">
            <AbaTimeline rascunho={rascunho} resultado={resultado} irParaAba={setAba} />
          </TabsContent>
          <TabsContent value="resultado">
            <AbaResultado rascunho={rascunho} resultado={resultado} />
          </TabsContent>
          <TabsContent value="demanda">
            <AbaDemandaCaixa
              rascunho={rascunho}
              resultado={resultado}
              // A aba dimensiona a PRIMEIRA facilidade — é a que a leitura dela
              // examina. Com uma só, que é o caso de toda modelagem já gravada, é
              // exatamente o comportamento de antes.
              aplicarDimensionamento={(fin: Financiamento) =>
                alterar({
                  financiamentos: (rascunho.financiamentos ?? []).map((f, i) =>
                    i === 0 ? fin : f,
                  ),
                })
              }
            />
          </TabsContent>
          <TabsContent value="sensibilidade">
            <AbaSensibilidade rascunho={rascunho} resultado={resultado} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Sem título acima: a barra já traz as contagens e o problema mais grave,
          e um cabeçalho gastaria a linha que este item veio recuperar. */}
      {ehModelo ? null : <PainelConferencias conferencias={resultado.conferencias} />}
    </div>
  );
}
