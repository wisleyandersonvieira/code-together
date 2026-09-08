'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { observarRequisicoes, useLoadAction, useMutateAction } from '@uibakery/data';
import {
  criarCronometro,
  debugSalvarLigado,
  formatarRelatorio,
  type MedicaoRenders,
} from './cronometroSalvar';
import { carimbarIds, montarPayload, type RetornoSalvar } from './payloadSalvar';
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
import salvarModelagemAction from '@/actions/salvarModelagem';
import duplicarModelagemAction from '@/actions/duplicarModelagem';
import createModelagemAporteParcelaAction from '@/actions/createModelagemAporteParcela';
import deleteModelagemAporteParcelaAction from '@/actions/deleteModelagemAporteParcela';
import deleteModelagemAporteParcelasTodasAction from '@/actions/deleteModelagemAporteParcelasTodas';
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

  // ─── Contador de renders (instrumentação, par do cronômetro) ─────────────
  //
  // O salvamento faz ~200 requisições em série e cada uma mexe em estado do
  // editor pelo shim. A pergunta que este contador existe para responder é se o
  // custo do salvamento está na rede ou em repintar a árvore — AbaFluxoCaixa
  // desenha 51 colunas sem memo, e não adianta otimizar o lado errado.
  //
  // Três números, porque um só mentiria:
  //   passadas — invocações da função. Sob StrictMode, ~2× os commits em dev.
  //   commits  — repinturas de verdade.
  //   ms       — do início do corpo até o layout effect: render da árvore
  //              inteira mais o commit. NÃO inclui a pintura do navegador.
  //
  // Atrás da MESMA flag `provison:debug:salvar` do cronômetro, e lida UMA VEZ na
  // montagem: um `localStorage.getItem` por render seria pior que o efeito que a
  // flag existe para evitar. O preço disso é que virar a flag no meio da sessão
  // exige recarregar a página — o cronômetro do `salvar()` relê a flag a cada
  // salvamento, este não. Desligada, o que sobra é uma comparação por render e
  // um effect que retorna na primeira linha.
  const medindoRenders = useRef(debugSalvarLigado()).current;
  const passadasRef = useRef(0);
  const commitsRef = useRef(0);
  const msRenderRef = useRef(0);
  const inicioRenderRef = useRef(0);
  if (medindoRenders) {
    passadasRef.current++;
    inicioRenderRef.current = performance.now();
  }
  // Sem array de dependências: roda a CADA commit, que é justamente o que se
  // quer contar. `useLayoutEffect` e não `useEffect` porque este roda antes da
  // pintura — medindo o trabalho do React, sem o do navegador misturado.
  useLayoutEffect(() => {
    if (!medindoRenders) return;
    commitsRef.current++;
    msRenderRef.current += performance.now() - inicioRenderRef.current;
  });

  // As mutations que sobraram: as que gravam FORA do botão salvar — override
  // por célula, parcela do plano de aportes, duplicação. Tudo o que era diff do
  // salvamento saiu daqui e virou a salvar_modelagem(jsonb).
  const [duplicar] = useMutateAction(duplicarModelagemAction);
  const [salvarTudo] = useMutateAction(salvarModelagemAction);
  const [criarParcela] = useMutateAction(createModelagemAporteParcelaAction);
  const [removerParcela] = useMutateAction(deleteModelagemAporteParcelaAction);
  const [removerParcelasTodas] = useMutateAction(deleteModelagemAporteParcelasTodasAction);
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
    // Cronômetro por bloco, atrás da flag `provison:debug:salvar` no
    // localStorage. Desligado, todo método é no-op e o shim nem cronometra.
    const cron = criarCronometro(observarRequisicoes);
    // Marco zero dos renders. Os contadores são cumulativos desde a montagem —
    // é a DIFERENÇA que pertence a este salvamento.
    const rendersAntes = {
      passadas: passadasRef.current,
      commits: commitsRef.current,
      ms: msRenderRef.current,
    };
    try {
      // UMA chamada, no lugar das ~118 que este bloco fazia. O payload leva a
      // modelagem inteira com os filhos aninhados no pai; a função resolve o
      // diff, os mapas de id e as duas passadas da facilidade dentro de UMA
      // transação — ou grava tudo, ou nada.
      //
      // A rota é `rpc()` pelo PostgREST, e não o execute-sql: ver o comentário
      // de actions/salvarModelagem.ts. O ganho medido não está em fazer menos
      // trabalho de banco — está em pagar um handshake em vez de 118.
      cron.bloco('salvar');
      const resposta = await salvarTudo({ payload: montarPayload(modelagemId, rascunho) });
      const retorno = (Array.isArray(resposta) ? resposta[0] : resposta) as RetornoSalvar;

      // Carimba os ids das linhas recém-criadas. O `recarregar()` logo abaixo
      // sobrescreve tudo de qualquer forma — este passo existe para o dia em que
      // ele cair, e como rede de segurança se ele falhar: sem os ids, o
      // salvamento seguinte inseriria as mesmas linhas de novo.
      if (retorno) setRascunho((atual) => (atual ? carimbarIds(atual, retorno) : atual));

      toast({ title: 'Modelagem salva' });
      // `recarregar()` é um `loadModelagemCompleta` inteiro e entra na conta como
      // qualquer outra requisição: sem medi-lo, o cronômetro esconderia uma das
      // idas ao banco mais caras do ciclo.
      cron.bloco('recarregar');
      await recarregar();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      // No `finally`: um salvamento que estoura no meio também precisa desligar o
      // observador do shim, ou ele seguiria medindo requisições de outras telas.
      const relatorio = cron.encerrar();
      // O último commit agendado pelo shim pode ainda não ter acontecido quando
      // esta linha roda, e o do `setSalvando(false)` logo abaixo certamente não
      // aconteceu: a contagem sai um ou dois commits abaixo do real. Numa ordem
      // de grandeza de centenas isso não muda leitura nenhuma, e esperar o
      // agendador só para fechar a conta atrasaria o salvamento de verdade.
      const renders: MedicaoRenders | undefined = medindoRenders
        ? {
            passadas: passadasRef.current - rendersAntes.passadas,
            commits: commitsRef.current - rendersAntes.commits,
            ms: msRenderRef.current - rendersAntes.ms,
          }
        : undefined;
      if (cron.ativo) console.log(formatarRelatorio({ ...relatorio, renders }));
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
