'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Pencil, Plus, Route, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import loadJornadasAction from '@/actions/loadJornadas';
import loadJornadaByIdAction from '@/actions/loadJornadaById';
import loadJornadaEtapaItensAction from '@/actions/loadJornadaEtapaItens';
import loadJornadaEtapasAction from '@/actions/loadJornadaEtapas';
import loadJornadaEntidadesDisponiveisAction from '@/actions/loadJornadaEntidadesDisponiveis';
import saveJornadaAction from '@/actions/saveJornada';
import deleteJornadaAction from '@/actions/deleteJornada';
import loadUsersAction from '@/actions/loadUsers';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';
import { formatDateForDatabase, formatDateForDisplay, parseLocalDate } from '@/utils/timezone';

type JornadaStatus = 'ATIVA' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA';
type EtapaStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'NAO_APLICAVEL';
type EntityType = 'cliente' | 'empresa' | 'grupo';

interface JornadaRow {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  entity_name?: string | null;
  status: JornadaStatus;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  observacoes?: string | null;
  responsavel_user_id?: number | null;
  responsavel_nome?: string | null;
  etapa_atual_id?: number | null;
  etapa_atual_nome?: string | null;
  total_etapas?: number | string | null;
  etapas_concluidas?: number | string | null;
  progresso?: number | string | null;
  updated_at?: string | null;
}

interface EtapaItemRow {
  item_id?: number | null;
  etapa_id: number;
  etapa_nome: string;
  etapa_descricao?: string | null;
  etapa_ativa?: boolean;
  ordem: number;
  status: EtapaStatus;
  data_prevista?: string | null;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  responsavel_user_id?: number | null;
  observacoes?: string | null;
}

const jornadaStatusOptions: Array<{ value: JornadaStatus; label: string }> = [
  { value: 'ATIVA', label: 'Ativa' },
  { value: 'PAUSADA', label: 'Pausada' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const etapaStatusOptions: Array<{ value: EtapaStatus; label: string }> = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'NAO_APLICAVEL', label: 'Não aplicável' },
];

const entityTypeLabels: Record<EntityType, string> = {
  cliente: 'Cliente',
  empresa: 'Empresa',
  grupo: 'Grupo',
};

function jornadaStatusTone(status: JornadaStatus) {
  if (status === 'ATIVA') return 'success' as const;
  if (status === 'PAUSADA') return 'warning' as const;
  if (status === 'CANCELADA') return 'danger' as const;
  return 'neutral' as const;
}

function etapaStatusTone(status: EtapaStatus) {
  if (status === 'CONCLUIDA') return 'success' as const;
  if (status === 'EM_ANDAMENTO') return 'warning' as const;
  return 'neutral' as const;
}

function statusLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
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

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [novaEntidade, setNovaEntidade] = useState('');
  const [novaDataInicio, setNovaDataInicio] = useState<Date | undefined>(new Date());
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [headerForm, setHeaderForm] = useState({
    status: 'ATIVA' as JornadaStatus,
    dataInicio: undefined as Date | undefined,
    responsavelUserId: '',
    observacoes: '',
  });
  const [itens, setItens] = useState<EtapaItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [jornadas, loadingJornadas, errorJornadas, refreshJornadas] = useLoadAction(loadJornadasAction, [], {
    status: statusFilter,
    entityType: entityTypeFilter,
    searchTerm: appliedSearch || null,
  });
  const [jornadaDetalhe, loadingDetalhe, , refreshDetalhe] = useLoadAction(loadJornadaByIdAction, [], {
    id: selectedJornadaId,
  });
  const [etapaItens, loadingItens, , refreshItens] = useLoadAction(loadJornadaEtapaItensAction, [], {
    jornadaId: selectedJornadaId,
  });
  const [etapasCatalogo] = useLoadAction(loadJornadaEtapasAction, [], { apenasAtivas: true });
  const [entidadesDisponiveis, , , refreshEntidades] = useLoadAction(loadJornadaEntidadesDisponiveisAction, []);
  const [usuarios] = useLoadAction(loadUsersAction, []);

  const [saveJornada] = useMutateAction(saveJornadaAction);
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

  const entidadeOptions = useMemo(
    () =>
      (Array.isArray(entidadesDisponiveis) ? entidadesDisponiveis : []).map((entidade: any) => ({
        value: `${entidade.entity_type}:${entidade.id}`,
        label: entidade.display_name || entidade.name,
      })),
    [entidadesDisponiveis],
  );

  // Sincroniza o formulário sempre que outra jornada é aberta ou recarregada.
  useEffect(() => {
    if (!jornadaAtual) return;
    setHeaderForm({
      status: (jornadaAtual.status || 'ATIVA') as JornadaStatus,
      dataInicio: toDate(jornadaAtual.data_inicio),
      responsavelUserId: jornadaAtual.responsavel_user_id ? String(jornadaAtual.responsavel_user_id) : '',
      observacoes: jornadaAtual.observacoes ?? '',
    });
  }, [jornadaAtual]);

  useEffect(() => {
    if (!Array.isArray(etapaItens)) return;
    setItens(
      etapaItens.map((item: any, index: number) => ({
        item_id: item.item_id ?? null,
        etapa_id: Number(item.etapa_id),
        etapa_nome: item.etapa_nome,
        etapa_descricao: item.etapa_descricao,
        etapa_ativa: item.etapa_ativa !== false,
        ordem: Number(item.ordem) || index + 1,
        status: (item.status || 'PENDENTE') as EtapaStatus,
        data_prevista: item.data_prevista ?? null,
        data_inicio: item.data_inicio ?? null,
        data_conclusao: item.data_conclusao ?? null,
        responsavel_user_id: item.responsavel_user_id ?? null,
        observacoes: item.observacoes ?? '',
      })),
    );
  }, [etapaItens]);

  const totalConsiderado = itens.filter((item) => item.status !== 'NAO_APLICAVEL').length;
  const totalConcluidas = itens.filter((item) => item.status === 'CONCLUIDA').length;
  const progressoAtual = totalConsiderado > 0 ? Math.round((totalConcluidas * 100) / totalConsiderado) : 0;

  const handleApplySearch = () => setAppliedSearch(searchInput.trim());

  const handleClearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('ATIVA');
    setEntityTypeFilter('all');
  };

  const updateItem = (etapaId: number, patch: Partial<EtapaItemRow>) => {
    setItens((prev) => prev.map((item) => (item.etapa_id === etapaId ? { ...item, ...patch } : item)));
  };

  const handleOpenNew = () => {
    setNovaEntidade('');
    setNovaDataInicio(new Date());
    setNovoResponsavel(currentUser?.legacy_user_id ? String(currentUser.legacy_user_id) : '');
    refreshEntidades();
    setIsNewOpen(true);
  };

  const handleCreate = async () => {
    if (!novaEntidade) {
      toast({
        title: 'Selecione o cliente',
        description: 'Escolha o cliente, empresa ou grupo da nova jornada.',
        variant: 'destructive',
      });
      return;
    }

    const [entityType, entityId] = novaEntidade.split(':');
    const catalogo = Array.isArray(etapasCatalogo) ? etapasCatalogo : [];

    setIsCreating(true);
    try {
      const result = await saveJornada({
        payload: encodeSqlJsonPayload({
          id: null,
          entity_type: entityType,
          entity_id: Number(entityId),
          status: 'ATIVA',
          data_inicio: novaDataInicio ? formatDateForDatabase(novaDataInicio) : null,
          responsavel_user_id: novoResponsavel ? Number(novoResponsavel) : null,
          observacoes: null,
          itens: catalogo.map((etapa: any, index: number) => ({
            etapa_id: Number(etapa.id),
            ordem: Number(etapa.ordem) || index + 1,
            status: 'PENDENTE',
          })),
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      const novaJornadaId = Number(result?.[0]?.result?.id);
      toast({
        title: 'Jornada iniciada',
        description: 'A jornada foi criada e já está disponível para acompanhamento.',
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

  const handleSave = async () => {
    if (!jornadaAtual) return;

    setIsSaving(true);
    try {
      await saveJornada({
        payload: encodeSqlJsonPayload({
          id: jornadaAtual.id,
          status: headerForm.status,
          data_inicio: headerForm.dataInicio ? formatDateForDatabase(headerForm.dataInicio) : null,
          responsavel_user_id: headerForm.responsavelUserId ? Number(headerForm.responsavelUserId) : null,
          observacoes: headerForm.observacoes || null,
          itens: itens.map((item) => ({
            etapa_id: item.etapa_id,
            ordem: item.ordem,
            status: item.status,
            data_prevista: item.data_prevista,
            data_inicio: item.data_inicio,
            data_conclusao: item.data_conclusao,
            responsavel_user_id: item.responsavel_user_id,
            observacoes: item.observacoes || null,
          })),
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      toast({
        title: 'Jornada atualizada',
        description: 'As etapas da jornada foram salvas com sucesso.',
      });
      refreshDetalhe();
      refreshItens();
      refreshJornadas();
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

  const handleDelete = async (jornada: JornadaRow) => {
    if (!window.confirm(`Excluir a jornada de "${jornada.entity_name || 'cliente'}"?`)) {
      return;
    }

    try {
      await deleteJornada({ id: jornada.id });
      toast({
        title: 'Jornada excluída',
        description: 'A jornada foi removida com sucesso.',
      });
      if (selectedJornadaId === jornada.id) {
        setSelectedJornadaId(null);
      }
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

    return (
      <div className="space-y-6">
        <FinanceDetailHeader
          title={jornadaAtual.entity_name || 'Jornada'}
          subtitle={`${entityTypeLabels[jornadaAtual.entity_type]} · ${totalConcluidas} de ${totalConsiderado} etapas concluídas`}
          onBack={() => setSelectedJornadaId(null)}
        />

        <FinanceDetailSectionCard
          title="Dados da jornada"
          description="Situação geral do acompanhamento deste cliente."
        >
          <div className="space-y-5">
            <div className={financeDetailMutedPanelClassName}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Progresso: {progressoAtual}%
                </span>
                <span className="text-sm text-slate-500">
                  Etapa atual: {jornadaAtual.etapa_atual_nome || 'Todas as etapas concluídas'}
                </span>
              </div>
              <Progress value={progressoAtual} className="mt-3" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </FinanceDetailSectionCard>

        <FinanceDetailSectionCard
          title="Etapas"
          description="Atualize o andamento de cada etapa da jornada."
        >
          {loadingItens && itens.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">Carregando etapas...</div>
          ) : itens.length === 0 ? (
            <ListingEmptyState
              icon={Route}
              title="Nenhuma etapa configurada"
              description="Cadastre as etapas em Operação > Etapas da Jornada para acompanhar este cliente."
            />
          ) : (
            <div className="space-y-4">
              {itens.map((item) => (
                <div
                  key={item.etapa_id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.ordem}. {item.etapa_nome}
                        </span>
                        <FinanceStatusBadge
                          label={statusLabel(etapaStatusOptions, item.status)}
                          tone={etapaStatusTone(item.status)}
                        />
                        {item.etapa_ativa === false ? (
                          <FinanceStatusBadge label="Etapa inativa" tone="warning" />
                        ) : null}
                      </div>
                      {item.etapa_descricao ? (
                        <p className="text-sm text-slate-500">{item.etapa_descricao}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Situação</Label>
                      <Select
                        value={item.status}
                        onValueChange={(value) => updateItem(item.etapa_id, { status: value as EtapaStatus })}
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
                      <Label>Previsão</Label>
                      <DatePickerWithYearSelector
                        date={toDate(item.data_prevista)}
                        onDateChange={(date) =>
                          updateItem(item.etapa_id, {
                            data_prevista: date ? formatDateForDatabase(date) : null,
                          })
                        }
                        triggerClassName={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Conclusão</Label>
                      <DatePickerWithYearSelector
                        date={toDate(item.data_conclusao)}
                        onDateChange={(date) =>
                          updateItem(item.etapa_id, {
                            data_conclusao: date ? formatDateForDatabase(date) : null,
                          })
                        }
                        disabled={item.status !== 'CONCLUIDA'}
                        triggerClassName={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Combobox
                        value={item.responsavel_user_id ? String(item.responsavel_user_id) : ''}
                        onValueChange={(value) =>
                          updateItem(item.etapa_id, {
                            responsavel_user_id: value ? Number(value) : null,
                          })
                        }
                        options={usuarioOptions}
                        placeholder="Selecionar"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label>Observação</Label>
                    <Input
                      value={item.observacoes ?? ''}
                      onChange={(event) => updateItem(item.etapa_id, { observacoes: event.target.value })}
                      placeholder="O que aconteceu nesta etapa"
                      className={financeDetailFieldClassName}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </FinanceDetailSectionCard>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className={listingSecondaryButtonClassName}
            onClick={() => setSelectedJornadaId(null)}
          >
            Voltar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className={listingPrimaryButtonClassName}>
            {isSaving ? 'Salvando...' : 'Salvar jornada'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Jornada do Cliente"
        description="Acompanhe a jornada de clientes, empresas e grupos e atualize cada etapa."
        action={
          <Button onClick={handleOpenNew} className={listingPrimaryButtonClassName}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Jornada
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
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
            description="Inicie a jornada de um cliente, empresa ou grupo para acompanhar a evolução por etapas."
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
                  <TableHead className={listingTableHeadClassName}>Etapa atual</TableHead>
                  <TableHead className={listingTableHeadClassName}>Progresso</TableHead>
                  <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                  <TableHead className={listingTableHeadClassName}>Início</TableHead>
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((jornada) => {
                  const total = Number(jornada.total_etapas ?? 0);
                  const concluidas = Number(jornada.etapas_concluidas ?? 0);
                  const progresso = Number(jornada.progresso ?? 0);

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
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {jornada.etapa_atual_nome || 'Todas concluídas'}
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
                      <TableCell className={listingTableCellClassName}>
                        {jornada.responsavel_nome || '-'}
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {formatDateForDisplay(jornada.data_inicio)}
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <FinanceStatusBadge
                          label={statusLabel(jornadaStatusOptions, jornada.status)}
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
                            title="Editar jornada"
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
              A jornada é criada com todas as etapas ativas do catálogo como pendentes.
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
