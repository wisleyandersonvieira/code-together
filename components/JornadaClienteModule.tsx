'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import {
  AlertTriangle,
  History,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  FinanceActionButton,
  FinanceStatusBadge,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';
import {
  FinanceDetailHeader,
  FinanceDetailSectionCard,
  financeDetailFieldClassName,
  financeDetailMutedPanelClassName,
} from '@/components/finance/detail-ui';
import { JornadaEtapaAnexos } from '@/components/operacao/JornadaEtapaAnexos';
import { JornadaEtapaChecklist, type ChecklistItem } from '@/components/operacao/JornadaEtapaChecklist';
import {
  ChecklistProgress,
  OperacaoStatusBadge,
  PrazoBadge,
  entityTypeLabels,
  etapaStatusOptions,
  isAguardando,
  operacaoStatusLabels,
  toNumber,
  type EntityType,
  type EtapaStatus,
} from '@/components/operacao/operacao-ui';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import loadJornadasAction from '@/actions/loadJornadas';
import loadJornadaByIdAction from '@/actions/loadJornadaById';
import loadJornadaEtapaItensAction from '@/actions/loadJornadaEtapaItens';
import loadJornadaEtapaHistoricoAction from '@/actions/loadJornadaEtapaHistorico';
import loadJornadaFluxosAction from '@/actions/loadJornadaFluxos';
import loadJornadaEntidadesDisponiveisAction from '@/actions/loadJornadaEntidadesDisponiveis';
import saveJornadaAction from '@/actions/saveJornada';
import saveJornadaItemAction from '@/actions/saveJornadaItem';
import sincronizarJornadaEtapasAction from '@/actions/sincronizarJornadaEtapas';
import deleteJornadaAction from '@/actions/deleteJornada';
import loadUsersAction from '@/actions/loadUsers';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';
import { formatDateForDatabase, formatDateForDisplay, parseLocalDate } from '@/utils/timezone';

type JornadaStatus = 'ATIVA' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA';

interface JornadaRow {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  entity_name?: string | null;
  fluxo_id?: number | null;
  fluxo_nome?: string | null;
  avanco_automatico?: boolean;
  status: JornadaStatus;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  observacoes?: string | null;
  responsavel_user_id?: number | null;
  responsavel_nome?: string | null;
  etapa_atual_item_id?: number | null;
  etapa_atual_nome?: string | null;
  etapa_atual_status?: string | null;
  etapa_atual_limite?: string | null;
  total_etapas?: number | string | null;
  etapas_concluidas?: number | string | null;
  progresso?: number | string | null;
  etapas_atrasadas?: number | string | null;
  etapas_aguardando?: number | string | null;
  pior_atraso?: number | string | null;
}

interface EtapaItemRow {
  item_id: number;
  fluxo_etapa_id: number;
  etapa_nome: string;
  etapa_descricao?: string | null;
  etapa_ativa?: boolean;
  setor?: string | null;
  ordem: number;
  status: EtapaStatus;
  prazo_dias?: number | string | null;
  data_prevista?: string | null;
  data_inicio?: string | null;
  data_limite?: string | null;
  data_conclusao?: string | null;
  dias_pausados?: number | string | null;
  aguardando_motivo?: string | null;
  dias_no_status?: number | string | null;
  dias_atraso?: number | string | null;
  responsavel_user_id?: number | null;
  responsavel_nome?: string | null;
  observacoes?: string | null;
  checklist_total?: number | string | null;
  checklist_concluidos?: number | string | null;
  total_anexos?: number | string | null;
  checklist?: ChecklistItem[];
}

const jornadaStatusOptions: Array<{ value: JornadaStatus; label: string }> = [
  { value: 'ATIVA', label: 'Ativa' },
  { value: 'PAUSADA', label: 'Pausada' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

function jornadaStatusTone(status: JornadaStatus) {
  if (status === 'ATIVA') return 'success' as const;
  if (status === 'PAUSADA') return 'warning' as const;
  if (status === 'CANCELADA') return 'danger' as const;
  return 'neutral' as const;
}

function toDate(value?: string | null) {
  if (!value) return undefined;
  try {
    return parseLocalDate(String(value));
  } catch {
    return undefined;
  }
}

export function JornadaClienteModule() {
  const { toast } = useToast();
  const currentUser = useCurrentUser();

  const [selectedJornadaId, setSelectedJornadaId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JornadaStatus>('ATIVA');
  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | EntityType>('all');
  const [fluxoFilter, setFluxoFilter] = useState<string>('all');
  const [apenasAtrasadas, setApenasAtrasadas] = useState(false);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [novaEntidade, setNovaEntidade] = useState('');
  const [novoFluxo, setNovoFluxo] = useState('');
  const [novaDataInicio, setNovaDataInicio] = useState<Date | undefined>(new Date());
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [headerForm, setHeaderForm] = useState({
    status: 'ATIVA' as JornadaStatus,
    fluxoId: '',
    dataInicio: undefined as Date | undefined,
    responsavelUserId: '',
    observacoes: '',
  });
  const [itens, setItens] = useState<EtapaItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const [jornadas, loadingJornadas, errorJornadas, refreshJornadas] = useLoadAction(loadJornadasAction, [], {
    status: statusFilter,
    entityType: entityTypeFilter,
    fluxoId: fluxoFilter,
    searchTerm: appliedSearch || null,
    apenasAtrasadas,
  });
  const [jornadaDetalhe, loadingDetalhe, , refreshDetalhe] = useLoadAction(loadJornadaByIdAction, [], {
    id: selectedJornadaId,
  });
  const [etapaItens, loadingItens, , refreshItens] = useLoadAction(loadJornadaEtapaItensAction, [], {
    jornadaId: selectedJornadaId,
  });
  const [historico, , , refreshHistorico] = useLoadAction(loadJornadaEtapaHistoricoAction, [], {
    jornadaId: historicoAberto ? selectedJornadaId : null,
  });
  const [fluxos] = useLoadAction(loadJornadaFluxosAction, [], { apenasAtivos: true });
  const [entidadesDisponiveis, , , refreshEntidades] = useLoadAction(loadJornadaEntidadesDisponiveisAction, []);
  const [usuarios] = useLoadAction(loadUsersAction, []);

  const [saveJornada] = useMutateAction(saveJornadaAction);
  const [saveJornadaItem] = useMutateAction(saveJornadaItemAction);
  const [sincronizarEtapas] = useMutateAction(sincronizarJornadaEtapasAction);
  const [deleteJornada] = useMutateAction(deleteJornadaAction);

  const lista: JornadaRow[] = Array.isArray(jornadas) ? jornadas : [];
  const jornadaAtual: JornadaRow | null = Array.isArray(jornadaDetalhe) ? jornadaDetalhe[0] ?? null : null;

  const usuarioOptions = useMemo(
    () => [
      { value: '', label: 'Sem responsável' },
      ...(Array.isArray(usuarios) ? usuarios : []).map((user: any) => ({
        value: String(user.id),
        label: user.name || user.email || `Usuário ${user.id}`,
      })),
    ],
    [usuarios],
  );

  const fluxoOptions = useMemo(
    () =>
      (Array.isArray(fluxos) ? fluxos : []).map((fluxo: any) => ({
        value: String(fluxo.id),
        label: fluxo.nome,
      })),
    [fluxos],
  );

  const entidadeOptions = useMemo(
    () =>
      (Array.isArray(entidadesDisponiveis) ? entidadesDisponiveis : []).map((entidade: any) => ({
        value: `${entidade.entity_type}:${entidade.id}`,
        label: entidade.display_name || entidade.name,
      })),
    [entidadesDisponiveis],
  );

  useEffect(() => {
    if (!jornadaAtual) return;
    setHeaderForm({
      status: (jornadaAtual.status || 'ATIVA') as JornadaStatus,
      fluxoId: jornadaAtual.fluxo_id ? String(jornadaAtual.fluxo_id) : '',
      dataInicio: toDate(jornadaAtual.data_inicio),
      responsavelUserId: jornadaAtual.responsavel_user_id ? String(jornadaAtual.responsavel_user_id) : '',
      observacoes: jornadaAtual.observacoes ?? '',
    });
  }, [jornadaAtual]);

  useEffect(() => {
    if (!Array.isArray(etapaItens)) return;
    setItens(
      etapaItens.map((item: any) => ({
        ...item,
        item_id: Number(item.item_id),
        fluxo_etapa_id: Number(item.fluxo_etapa_id),
        ordem: Number(item.ordem) || 0,
        status: (item.status || 'PENDENTE') as EtapaStatus,
        checklist: Array.isArray(item.checklist) ? item.checklist : [],
      })),
    );
  }, [etapaItens]);

  const totalConsiderado = itens.filter((item) => item.status !== 'NAO_APLICAVEL').length;
  const totalConcluidas = itens.filter((item) => item.status === 'CONCLUIDA').length;
  const progressoAtual = totalConsiderado > 0 ? Math.round((totalConcluidas * 100) / totalConsiderado) : 0;
  const etapasAtrasadas = itens.filter(
    (item) =>
      item.status !== 'CONCLUIDA' &&
      item.status !== 'NAO_APLICAVEL' &&
      !isAguardando(item.status) &&
      toNumber(item.dias_atraso) > 0,
  ).length;
  const etapasAguardando = itens.filter((item) => isAguardando(item.status)).length;
  const jornadaIniciada = itens.some((item) => item.status !== 'PENDENTE');

  const handleApplySearch = () => setAppliedSearch(searchInput.trim());

  const handleClearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('ATIVA');
    setEntityTypeFilter('all');
    setFluxoFilter('all');
    setApenasAtrasadas(false);
  };

  const updateItemLocal = (itemId: number, patch: Partial<EtapaItemRow>) => {
    setItens((prev) => prev.map((item) => (item.item_id === itemId ? { ...item, ...patch } : item)));
  };

  const refreshTudo = () => {
    refreshDetalhe();
    refreshItens();
    refreshJornadas();
    if (historicoAberto) refreshHistorico();
  };

  const handleOpenNew = () => {
    const padrao = (Array.isArray(fluxos) ? fluxos : []).find((fluxo: any) => fluxo.padrao);
    setNovaEntidade('');
    setNovoFluxo(padrao ? String(padrao.id) : '');
    setNovaDataInicio(new Date());
    setNovoResponsavel(currentUser?.legacy_user_id ? String(currentUser.legacy_user_id) : '');
    refreshEntidades();
    setIsNewOpen(true);
  };

  const handleCreate = async () => {
    if (!novaEntidade || !novoFluxo) {
      toast({
        title: 'Dados incompletos',
        description: 'Escolha o cliente e o fluxo que a jornada vai seguir.',
        variant: 'destructive',
      });
      return;
    }

    const [entityType, entityId] = novaEntidade.split(':');

    setIsCreating(true);
    try {
      const result = await saveJornada({
        payload: encodeSqlJsonPayload({
          id: null,
          entity_type: entityType,
          entity_id: Number(entityId),
          fluxo_id: Number(novoFluxo),
          status: 'ATIVA',
          data_inicio: novaDataInicio ? formatDateForDatabase(novaDataInicio) : null,
          responsavel_user_id: novoResponsavel ? Number(novoResponsavel) : null,
          observacoes: null,
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      const novaJornadaId = Number(result?.[0]?.result?.id);
      toast({
        title: 'Jornada iniciada',
        description: 'As etapas do fluxo foram criadas e a primeira já está em andamento.',
      });
      setIsNewOpen(false);
      refreshJornadas();
      refreshEntidades();

      if (novaJornadaId) {
        setSelectedJornadaId(novaJornadaId);
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao criar jornada',
        description: err?.message || 'Não foi possível criar a jornada.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveHeader = async () => {
    if (!jornadaAtual) return;

    setIsSaving(true);
    try {
      await saveJornada({
        payload: encodeSqlJsonPayload({
          id: jornadaAtual.id,
          fluxo_id: headerForm.fluxoId ? Number(headerForm.fluxoId) : null,
          status: headerForm.status,
          data_inicio: headerForm.dataInicio ? formatDateForDatabase(headerForm.dataInicio) : null,
          responsavel_user_id: headerForm.responsavelUserId ? Number(headerForm.responsavelUserId) : null,
          observacoes: headerForm.observacoes || null,
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      toast({ title: 'Jornada atualizada', description: 'Os dados da jornada foram salvos.' });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar jornada',
        description: err?.message || 'Não foi possível salvar a jornada.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Mudança de status vai para o banco na hora: é lá que a pausa do SLA, o
   * bloqueio por checklist e o avanço automático acontecem.
   */
  const handleStatusChange = async (item: EtapaItemRow, status: EtapaStatus) => {
    setSavingItemId(item.item_id);
    try {
      await saveJornadaItem({
        payload: encodeSqlJsonPayload({ item_id: item.item_id, status }),
        userId: currentUser?.legacy_user_id || null,
      });

      if (status === 'CONCLUIDA') {
        toast({ title: 'Etapa concluída', description: 'A próxima etapa pendente foi iniciada automaticamente.' });
      }
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Não foi possível mudar o status',
        description: err?.message || 'Verifique o checklist obrigatório da etapa.',
        variant: 'destructive',
      });
      refreshItens();
    } finally {
      setSavingItemId(null);
    }
  };

  const handleSaveItem = async (item: EtapaItemRow) => {
    setSavingItemId(item.item_id);
    try {
      await saveJornadaItem({
        payload: encodeSqlJsonPayload({
          item_id: item.item_id,
          prazo_dias: item.prazo_dias === '' || item.prazo_dias === null ? null : Number(item.prazo_dias),
          data_prevista: item.data_prevista,
          responsavel_user_id: item.responsavel_user_id,
          observacoes: item.observacoes || null,
          aguardando_motivo: item.aguardando_motivo || null,
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      toast({ description: `Etapa "${item.etapa_nome}" atualizada.` });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar etapa',
        description: err?.message || 'Não foi possível salvar a etapa.',
        variant: 'destructive',
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleSincronizar = async () => {
    if (!selectedJornadaId) return;

    try {
      await sincronizarEtapas({ jornadaId: selectedJornadaId });
      toast({
        title: 'Etapas sincronizadas',
        description: 'A jornada recebeu as etapas que o fluxo ganhou depois que ela começou.',
      });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: err?.message || 'Não foi possível sincronizar as etapas.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (jornada: JornadaRow) => {
    if (!window.confirm(`Excluir a jornada de "${jornada.entity_name || 'cliente'}"?`)) return;

    try {
      await deleteJornada({ id: jornada.id });
      toast({ title: 'Jornada excluída', description: 'A jornada foi removida com sucesso.' });
      if (selectedJornadaId === jornada.id) setSelectedJornadaId(null);
      refreshJornadas();
      refreshEntidades();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir jornada',
        description: err?.message || 'Não foi possível excluir a jornada.',
        variant: 'destructive',
      });
    }
  };

  if (selectedJornadaId) {
    if (loadingDetalhe && !jornadaAtual) {
      return <div className="p-8 text-center text-sm text-slate-500">Carregando jornada...</div>;
    }

    if (!jornadaAtual) {
      return (
        <div className="space-y-4">
          <div className="p-8 text-center text-sm text-slate-500">Jornada não encontrada.</div>
          <div className="flex justify-center">
            <Button className={listingSecondaryButtonClassName} onClick={() => setSelectedJornadaId(null)}>
              Voltar para a lista
            </Button>
          </div>
        </div>
      );
    }

    const historicoLista = Array.isArray(historico) ? historico : [];

    return (
      <div className="space-y-6">
        <FinanceDetailHeader
          title={jornadaAtual.entity_name || 'Jornada'}
          subtitle={`${entityTypeLabels[jornadaAtual.entity_type]} · ${jornadaAtual.fluxo_nome || 'Sem fluxo'} · ${totalConcluidas} de ${totalConsiderado} etapas concluídas`}
          onBack={() => setSelectedJornadaId(null)}
        />

        <FinanceDetailSectionCard
          title="Dados da jornada"
          description="Situação geral do acompanhamento deste cliente."
        >
          <div className="space-y-5">
            <div className={financeDetailMutedPanelClassName}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-700">Progresso: {progressoAtual}%</span>
                <span className="text-sm text-slate-500">
                  Etapa atual: {jornadaAtual.etapa_atual_nome || 'Todas as etapas concluídas'}
                </span>
              </div>
              <Progress value={progressoAtual} className="mt-3" />

              {etapasAtrasadas > 0 || etapasAguardando > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {etapasAtrasadas > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {etapasAtrasadas} etapa{etapasAtrasadas > 1 ? 's' : ''} em atraso
                    </span>
                  ) : null}
                  {etapasAguardando > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <PauseCircle className="h-3.5 w-3.5" />
                      {etapasAguardando} aguardando terceiros
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Fluxo</Label>
                <Combobox
                  value={headerForm.fluxoId}
                  onValueChange={(value) => setHeaderForm((prev) => ({ ...prev, fluxoId: value }))}
                  options={fluxoOptions}
                  placeholder="Selecionar fluxo"
                  disabled={jornadaIniciada}
                />
                {jornadaIniciada ? (
                  <p className="text-[11px] text-slate-400">
                    O fluxo trava assim que a primeira etapa sai de pendente.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={headerForm.status}
                  onValueChange={(value) => setHeaderForm((prev) => ({ ...prev, status: value as JornadaStatus }))}
                >
                  <SelectTrigger className={financeDetailFieldClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jornadaStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Início</Label>
                <DatePickerWithYearSelector
                  date={headerForm.dataInicio}
                  onDateChange={(date) => setHeaderForm((prev) => ({ ...prev, dataInicio: date }))}
                  triggerClassName={financeDetailFieldClassName}
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Combobox
                  value={headerForm.responsavelUserId}
                  onValueChange={(value) => setHeaderForm((prev) => ({ ...prev, responsavelUserId: value }))}
                  options={usuarioOptions}
                  placeholder="Selecionar responsável"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={headerForm.observacoes}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                placeholder="Anotações gerais sobre a jornada deste cliente"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveHeader} disabled={isSaving} className={listingPrimaryButtonClassName}>
                {isSaving ? 'Salvando...' : 'Salvar dados da jornada'}
              </Button>
            </div>
          </div>
        </FinanceDetailSectionCard>

        <FinanceDetailSectionCard
          title="Etapas"
          description="Mudar o status grava na hora: é ele que pausa o SLA, trava pelo checklist e libera a próxima etapa."
        >
          <div className="mb-4 flex justify-end">
            <Button variant="outline" className={listingSecondaryButtonClassName} onClick={handleSincronizar}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar com o fluxo
            </Button>
          </div>

          {loadingItens && itens.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">Carregando etapas...</div>
          ) : itens.length === 0 ? (
            <ListingEmptyState
              icon={Route}
              title="Nenhuma etapa nesta jornada"
              description="Configure as etapas do fluxo em Operação > Fluxos e Etapas e use Sincronizar com o fluxo."
            />
          ) : (
            <div className="space-y-4">
              {itens.map((item) => {
                const aguardando = isAguardando(item.status);
                const salvando = savingItemId === item.item_id;

                return (
                  <div
                    key={item.item_id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {item.ordem}. {item.etapa_nome}
                          </span>
                          <OperacaoStatusBadge status={item.status} />
                          {item.setor ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {item.setor}
                            </span>
                          ) : null}
                          {item.etapa_ativa === false ? (
                            <FinanceStatusBadge label="Etapa fora do fluxo" tone="warning" />
                          ) : null}
                          <ChecklistProgress total={item.checklist_total} concluidos={item.checklist_concluidos} />
                        </div>
                        {item.etapa_descricao ? (
                          <p className="text-sm text-slate-500">{item.etapa_descricao}</p>
                        ) : null}
                        {toNumber(item.dias_pausados) > 0 ? (
                          <p className="text-[11px] text-amber-700">
                            {toNumber(item.dias_pausados)} dia(s) já devolvidos ao prazo por espera de terceiros.
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0">
                        {item.status === 'CONCLUIDA' ? (
                          <span className="text-xs text-slate-500">
                            Concluída em {formatDateForDisplay(item.data_conclusao)}
                          </span>
                        ) : (
                          <PrazoBadge
                            dataLimite={item.data_limite}
                            diasAtraso={item.dias_atraso}
                            aguardando={aguardando}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Situação</Label>
                        <Select
                          value={item.status}
                          disabled={salvando}
                          onValueChange={(value) => handleStatusChange(item, value as EtapaStatus)}
                        >
                          <SelectTrigger className={financeDetailFieldClassName}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {etapaStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Prazo (dias)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.prazo_dias ?? ''}
                          onChange={(event) =>
                            updateItemLocal(item.item_id, { prazo_dias: event.target.value })
                          }
                          placeholder="Sem SLA"
                          className={financeDetailFieldClassName}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Previsão manual</Label>
                        <DatePickerWithYearSelector
                          date={toDate(item.data_prevista)}
                          onDateChange={(date) =>
                            updateItemLocal(item.item_id, {
                              data_prevista: date ? formatDateForDatabase(date) : null,
                            })
                          }
                          triggerClassName={financeDetailFieldClassName}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Responsável</Label>
                        <Combobox
                          value={item.responsavel_user_id ? String(item.responsavel_user_id) : ''}
                          onValueChange={(value) =>
                            updateItemLocal(item.item_id, { responsavel_user_id: value ? Number(value) : null })
                          }
                          options={usuarioOptions}
                          placeholder="Selecionar"
                        />
                      </div>
                    </div>

                    {aguardando ? (
                      <div className="mt-4 space-y-2">
                        <Label>
                          {item.status === 'AGUARDANDO_CLIENTE' ? 'O que falta do cliente' : 'O que falta do órgão'}
                        </Label>
                        <Input
                          value={item.aguardando_motivo ?? ''}
                          onChange={(event) =>
                            updateItemLocal(item.item_id, { aguardando_motivo: event.target.value })
                          }
                          placeholder="Ex.: aguardando comprovante de endereço"
                          className={financeDetailFieldClassName}
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-2">
                      <Label>Observação</Label>
                      <Input
                        value={item.observacoes ?? ''}
                        onChange={(event) => updateItemLocal(item.item_id, { observacoes: event.target.value })}
                        placeholder="O que aconteceu nesta etapa"
                        className={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                        <JornadaEtapaChecklist
                          itemId={item.item_id}
                          checklist={item.checklist ?? []}
                          readOnly={item.status === 'NAO_APLICAVEL'}
                          onChange={refreshItens}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Anexos
                        </span>
                        <JornadaEtapaAnexos itemId={item.item_id} onChange={refreshItens} />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={salvando}
                        onClick={() => handleSaveItem(item)}
                        className={listingSecondaryButtonClassName}
                      >
                        {salvando ? 'Salvando...' : 'Salvar etapa'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FinanceDetailSectionCard>

        <FinanceDetailSectionCard
          title="Histórico"
          description="Toda mudança de status, com quanto tempo a etapa ficou parada em cada um."
        >
          {!historicoAberto ? (
            <Button
              variant="outline"
              className={listingSecondaryButtonClassName}
              onClick={() => setHistoricoAberto(true)}
            >
              <History className="mr-2 h-4 w-4" />
              Mostrar histórico
            </Button>
          ) : historicoLista.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={listingTableHeadClassName}>Quando</TableHead>
                    <TableHead className={listingTableHeadClassName}>Etapa</TableHead>
                    <TableHead className={listingTableHeadClassName}>De</TableHead>
                    <TableHead className={listingTableHeadClassName}>Para</TableHead>
                    <TableHead className={listingTableHeadClassName}>Dias no status</TableHead>
                    <TableHead className={listingTableHeadClassName}>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoLista.map((linha: any) => (
                    <TableRow key={linha.id}>
                      <TableCell className={listingTableCellClassName}>
                        {formatDateForDisplay(linha.created_at)}
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{linha.etapa_nome || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {linha.status_anterior ? operacaoStatusLabels[linha.status_anterior] ?? linha.status_anterior : '—'}
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <OperacaoStatusBadge status={linha.status_novo} />
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{toNumber(linha.dias_no_status)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{linha.user_nome || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </FinanceDetailSectionCard>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className={listingSecondaryButtonClassName}
            onClick={() => setSelectedJornadaId(null)}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Jornada do Cliente"
        description="Acompanhe o onboarding por fluxo, com prazo por etapa e checklist obrigatório."
        action={
          <Button onClick={handleOpenNew} className={listingPrimaryButtonClassName}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Jornada
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleApplySearch()}
              placeholder="Buscar por cliente, empresa ou grupo"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {jornadaStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entityTypeFilter}
            onValueChange={(value) => setEntityTypeFilter(value as typeof entityTypeFilter)}
          >
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="empresa">Empresa</SelectItem>
              <SelectItem value="grupo">Grupo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={fluxoFilter} onValueChange={setFluxoFilter}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Fluxo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fluxos</SelectItem>
              {fluxoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={handleApplySearch} className={listingPrimaryButtonClassName}>
              Buscar
            </Button>
            <Button onClick={handleClearFilters} variant="outline" className={listingSecondaryButtonClassName}>
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Switch id="jornada-apenas-atrasadas" checked={apenasAtrasadas} onCheckedChange={setApenasAtrasadas} />
          <Label htmlFor="jornada-apenas-atrasadas" className="cursor-pointer text-sm text-slate-600">
            Só jornadas com etapa em atraso
          </Label>
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        {loadingJornadas ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando jornadas...</div>
        ) : errorJornadas ? (
          <div className="p-8 text-center text-sm text-rose-600">
            Erro ao carregar jornadas: {errorJornadas?.message || 'tente novamente'}
          </div>
        ) : lista.length === 0 ? (
          <ListingEmptyState
            icon={Route}
            title="Nenhuma jornada encontrada"
            description="Inicie a jornada de um cliente, empresa ou grupo escolhendo o fluxo que ele vai seguir."
            action={
              <Button onClick={handleOpenNew} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Jornada
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={listingTableHeadClassName}>Cliente</TableHead>
                  <TableHead className={listingTableHeadClassName}>Fluxo</TableHead>
                  <TableHead className={listingTableHeadClassName}>Etapa atual</TableHead>
                  <TableHead className={listingTableHeadClassName}>Prazo</TableHead>
                  <TableHead className={listingTableHeadClassName}>Progresso</TableHead>
                  <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((jornada) => {
                  const total = toNumber(jornada.total_etapas);
                  const concluidas = toNumber(jornada.etapas_concluidas);
                  const progresso = toNumber(jornada.progresso);
                  const atrasadas = toNumber(jornada.etapas_atrasadas);
                  const aguardando = toNumber(jornada.etapas_aguardando);
                  const etapaAguardando = isAguardando(jornada.etapa_atual_status);

                  return (
                    <TableRow
                      key={jornada.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedJornadaId(jornada.id)}
                    >
                      <TableCell className={listingTableCellClassName}>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{jornada.entity_name || '-'}</p>
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            {entityTypeLabels[jornada.entity_type]}
                          </p>
                          {atrasadas > 0 || aguardando > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {atrasadas > 0 ? (
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  {atrasadas} em atraso
                                </span>
                              ) : null}
                              {aguardando > 0 ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  {aguardando} aguardando
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{jornada.fluxo_nome || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <div className="space-y-1">
                          <p>{jornada.etapa_atual_nome || 'Todas concluídas'}</p>
                          {jornada.etapa_atual_status ? (
                            <OperacaoStatusBadge status={jornada.etapa_atual_status} />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <PrazoBadge
                          dataLimite={jornada.etapa_atual_limite}
                          diasAtraso={
                            jornada.etapa_atual_limite
                              ? Math.round(
                                  (new Date().setHours(0, 0, 0, 0) -
                                    parseLocalDate(String(jornada.etapa_atual_limite)).setHours(0, 0, 0, 0)) /
                                    86400000,
                                )
                              : null
                          }
                          aguardando={etapaAguardando}
                        />
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <div className="min-w-[150px] space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>
                              {concluidas}/{total} etapas
                            </span>
                            <span className="font-semibold text-slate-700">{Math.round(progresso)}%</span>
                          </div>
                          <Progress value={progresso} />
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{jornada.responsavel_nome || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <FinanceStatusBadge
                          label={
                            jornadaStatusOptions.find((option) => option.value === jornada.status)?.label ??
                            jornada.status
                          }
                          tone={jornadaStatusTone(jornada.status)}
                        />
                      </TableCell>
                      <TableCell
                        className={`${listingTableCellClassName} text-right`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <FinanceActionButton
                            icon={Pencil}
                            title="Abrir jornada"
                            tone="brand"
                            onClick={() => setSelectedJornadaId(jornada.id)}
                          />
                          <FinanceActionButton
                            icon={Trash2}
                            title="Excluir jornada"
                            tone="danger"
                            onClick={() => handleDelete(jornada)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ListingTableCard>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Jornada</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente, empresa ou grupo *</Label>
              <Combobox
                value={novaEntidade}
                onValueChange={setNovaEntidade}
                options={entidadeOptions}
                placeholder="Selecionar"
                searchPlaceholder="Buscar cliente, empresa ou grupo"
                emptyText="Todos já possuem jornada cadastrada."
              />
            </div>

            <div className="space-y-2">
              <Label>Fluxo *</Label>
              <Combobox
                value={novoFluxo}
                onValueChange={setNovoFluxo}
                options={fluxoOptions}
                placeholder="Selecionar fluxo"
                emptyText="Cadastre um fluxo em Operação > Fluxos e Etapas."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Início</Label>
                <DatePickerWithYearSelector date={novaDataInicio} onDateChange={setNovaDataInicio} />
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Combobox
                  value={novoResponsavel}
                  onValueChange={setNovoResponsavel}
                  options={usuarioOptions}
                  placeholder="Selecionar responsável"
                />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              As etapas do fluxo são copiadas com prazo e checklist, e a primeira já entra em andamento.
            </p>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className={listingSecondaryButtonClassName} onClick={() => setIsNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className={listingPrimaryButtonClassName}>
              {isCreating ? 'Criando...' : 'Iniciar jornada'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
