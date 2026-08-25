'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { CalendarClock, Link2, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { financeDetailTabsListClassName, financeDetailTabsTriggerClassName } from '@/components/finance/detail-ui';
import {
  OperacaoStatusBadge,
  PrazoBadge,
  competenciaStatusOptions,
  isAguardando,
  periodicidadeLabels,
  toNumber,
} from '@/components/operacao/operacao-ui';
import { useToast } from '@/hooks/use-toast';
import loadObrigacoesCatalogoAction from '@/actions/loadObrigacoesCatalogo';
import loadObrigacoesClienteAction from '@/actions/loadObrigacoesCliente';
import loadObrigacoesCompetenciasAction from '@/actions/loadObrigacoesCompetencias';
import saveObrigacaoClienteAction from '@/actions/saveObrigacaoCliente';
import deleteObrigacaoClienteAction from '@/actions/deleteObrigacaoCliente';
import saveObrigacaoCompetenciaAction from '@/actions/saveObrigacaoCompetencia';
import gerarObrigacoesCompetenciasAction from '@/actions/gerarObrigacoesCompetencias';
import loadOperacaoEntidadesAction from '@/actions/loadOperacaoEntidades';
import loadUsersAction from '@/actions/loadUsers';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';
import { useCurrentUser } from '@/lib/userContext';
import { formatDateForDatabase, formatDateForDisplay, parseLocalDate } from '@/utils/timezone';

interface VinculoRow {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name?: string | null;
  obrigacao_id: number;
  obrigacao_nome: string;
  periodicidade: string;
  setor?: string | null;
  responsavel_user_id?: number | null;
  responsavel_nome?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  competencias_abertas?: number | string | null;
  competencias_atrasadas?: number | string | null;
  proximo_vencimento?: string | null;
}

interface CompetenciaRow {
  id: number;
  entity_name?: string | null;
  obrigacao_nome: string;
  periodicidade: string;
  setor?: string | null;
  competencia_label: string;
  data_vencimento: string;
  data_limite_interna: string;
  status: string;
  data_entrega?: string | null;
  protocolo?: string | null;
  observacoes?: string | null;
  aguardando_motivo?: string | null;
  dias_atraso?: number | string | null;
  responsavel_nome?: string | null;
  responsavel_user_id?: number | null;
}

const situacaoOptions = [
  { value: 'abertas', label: 'Em aberto' },
  { value: 'atrasadas', label: 'Vencidas' },
  { value: 'vence_hoje', label: 'Vence hoje' },
  { value: 'proximos_7', label: 'Próximos 7 dias' },
  { value: 'aguardando', label: 'Aguardando terceiros' },
  { value: 'entregues', label: 'Entregues' },
  { value: 'all', label: 'Todas' },
];

const emptyVinculo = {
  id: null as number | null,
  entidade: '',
  obrigacaoId: '',
  responsavelUserId: '',
  dataInicio: new Date() as Date | undefined,
  dataFim: undefined as Date | undefined,
  ativo: true,
  observacoes: '',
};

export function ObrigacoesClienteModule() {
  const { toast } = useToast();
  const currentUser = useCurrentUser();

  const [aba, setAba] = useState('competencias');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [situacao, setSituacao] = useState('abertas');
  const [obrigacaoFilter, setObrigacaoFilter] = useState('all');
  const [responsavelFilter, setResponsavelFilter] = useState('all');

  const [vinculoForm, setVinculoForm] = useState(emptyVinculo);
  const [isVinculoOpen, setIsVinculoOpen] = useState(false);
  const [isSavingVinculo, setIsSavingVinculo] = useState(false);

  const [competenciaEdit, setCompetenciaEdit] = useState<CompetenciaRow | null>(null);
  const [competenciaForm, setCompetenciaForm] = useState({
    status: 'PENDENTE',
    dataEntrega: undefined as Date | undefined,
    protocolo: '',
    responsavelUserId: '',
    observacoes: '',
    aguardandoMotivo: '',
  });
  const [isSavingCompetencia, setIsSavingCompetencia] = useState(false);
  const [isGerando, setIsGerando] = useState(false);

  const [competencias, loadingCompetencias, errorCompetencias, refreshCompetencias] = useLoadAction(
    loadObrigacoesCompetenciasAction,
    [],
    {
      searchTerm: appliedSearch || null,
      situacao,
      obrigacaoId: obrigacaoFilter,
      responsavelId: responsavelFilter,
    },
  );
  const [vinculos, loadingVinculos, , refreshVinculos] = useLoadAction(loadObrigacoesClienteAction, [], {
    searchTerm: appliedSearch || null,
    obrigacaoId: obrigacaoFilter,
    responsavelId: responsavelFilter,
  });
  const [catalogo] = useLoadAction(loadObrigacoesCatalogoAction, [], { apenasAtivas: true });
  const [entidades] = useLoadAction(loadOperacaoEntidadesAction, []);
  const [usuarios] = useLoadAction(loadUsersAction, []);

  const [saveVinculo] = useMutateAction(saveObrigacaoClienteAction);
  const [deleteVinculo] = useMutateAction(deleteObrigacaoClienteAction);
  const [saveCompetencia] = useMutateAction(saveObrigacaoCompetenciaAction);
  const [gerarCompetencias] = useMutateAction(gerarObrigacoesCompetenciasAction);

  const listaCompetencias: CompetenciaRow[] = Array.isArray(competencias) ? competencias : [];
  const listaVinculos: VinculoRow[] = Array.isArray(vinculos) ? vinculos : [];

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

  const obrigacaoOptions = useMemo(
    () =>
      (Array.isArray(catalogo) ? catalogo : []).map((obrigacao: any) => ({
        value: String(obrigacao.id),
        label: obrigacao.nome,
      })),
    [catalogo],
  );

  const entidadeOptions = useMemo(
    () =>
      (Array.isArray(entidades) ? entidades : []).map((entidade: any) => ({
        value: `${entidade.entity_type}:${entidade.id}`,
        label: entidade.display_name || entidade.name,
      })),
    [entidades],
  );

  const refreshTudo = () => {
    refreshCompetencias();
    refreshVinculos();
  };

  const handleGerar = async () => {
    setIsGerando(true);
    try {
      const result = await gerarCompetencias({ mesesFuturo: 3, mesesPassado: 12 });
      const criadas = toNumber(result?.[0]?.result?.criadas);
      toast({
        title: criadas > 0 ? `${criadas} competência(s) gerada(s)` : 'Nada a gerar',
        description:
          criadas > 0
            ? 'As novas competências já entraram no painel com vencimento calculado.'
            : 'Todas as competências dos próximos 3 meses já existem.',
      });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar competências',
        description: err?.message || 'Não foi possível gerar as competências.',
        variant: 'destructive',
      });
    } finally {
      setIsGerando(false);
    }
  };

  const openVinculoCreate = () => {
    setVinculoForm({
      ...emptyVinculo,
      dataInicio: new Date(),
      responsavelUserId: currentUser?.legacy_user_id ? String(currentUser.legacy_user_id) : '',
    });
    setIsVinculoOpen(true);
  };

  const openVinculoEdit = (vinculo: VinculoRow) => {
    setVinculoForm({
      id: vinculo.id,
      entidade: `${vinculo.entity_type}:${vinculo.entity_id}`,
      obrigacaoId: String(vinculo.obrigacao_id),
      responsavelUserId: vinculo.responsavel_user_id ? String(vinculo.responsavel_user_id) : '',
      dataInicio: vinculo.data_inicio ? parseLocalDate(String(vinculo.data_inicio)) : undefined,
      dataFim: vinculo.data_fim ? parseLocalDate(String(vinculo.data_fim)) : undefined,
      ativo: Boolean(vinculo.ativo),
      observacoes: vinculo.observacoes ?? '',
    });
    setIsVinculoOpen(true);
  };

  const handleSaveVinculo = async () => {
    if (!vinculoForm.id && (!vinculoForm.entidade || !vinculoForm.obrigacaoId)) {
      toast({
        title: 'Dados incompletos',
        description: 'Escolha o cliente e a obrigação.',
        variant: 'destructive',
      });
      return;
    }

    const [entityType, entityId] = vinculoForm.entidade.split(':');

    setIsSavingVinculo(true);
    try {
      await saveVinculo({
        payload: encodeSqlJsonPayload({
          id: vinculoForm.id,
          entity_type: entityType,
          entity_id: entityId ? Number(entityId) : null,
          obrigacao_id: vinculoForm.obrigacaoId ? Number(vinculoForm.obrigacaoId) : null,
          responsavel_user_id: vinculoForm.responsavelUserId ? Number(vinculoForm.responsavelUserId) : null,
          data_inicio: vinculoForm.dataInicio ? formatDateForDatabase(vinculoForm.dataInicio) : null,
          data_fim: vinculoForm.dataFim ? formatDateForDatabase(vinculoForm.dataFim) : null,
          ativo: vinculoForm.ativo,
          observacoes: vinculoForm.observacoes || null,
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      toast({
        title: 'Vínculo salvo',
        description: 'As competências deste cliente foram geradas até 3 meses à frente.',
      });
      setIsVinculoOpen(false);
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar vínculo',
        description: err?.message || 'Não foi possível salvar o vínculo.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingVinculo(false);
    }
  };

  const handleDeleteVinculo = async (vinculo: VinculoRow) => {
    if (!window.confirm(`Excluir "${vinculo.obrigacao_nome}" de ${vinculo.entity_name}?`)) return;

    try {
      await deleteVinculo({ id: vinculo.id });
      toast({ title: 'Vínculo excluído', description: 'A obrigação não é mais cobrada deste cliente.' });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o vínculo.',
        variant: 'destructive',
      });
    }
  };

  const openCompetencia = (competencia: CompetenciaRow) => {
    setCompetenciaEdit(competencia);
    setCompetenciaForm({
      status: competencia.status,
      dataEntrega: competencia.data_entrega ? parseLocalDate(String(competencia.data_entrega)) : undefined,
      protocolo: competencia.protocolo ?? '',
      responsavelUserId: competencia.responsavel_user_id ? String(competencia.responsavel_user_id) : '',
      observacoes: competencia.observacoes ?? '',
      aguardandoMotivo: competencia.aguardando_motivo ?? '',
    });
  };

  const handleSaveCompetencia = async () => {
    if (!competenciaEdit) return;

    setIsSavingCompetencia(true);
    try {
      await saveCompetencia({
        payload: encodeSqlJsonPayload({
          id: competenciaEdit.id,
          status: competenciaForm.status,
          data_entrega: competenciaForm.dataEntrega ? formatDateForDatabase(competenciaForm.dataEntrega) : null,
          protocolo: competenciaForm.protocolo || null,
          responsavel_user_id: competenciaForm.responsavelUserId
            ? Number(competenciaForm.responsavelUserId)
            : null,
          observacoes: competenciaForm.observacoes || null,
          aguardando_motivo: competenciaForm.aguardandoMotivo || null,
        }),
        userId: currentUser?.legacy_user_id || null,
      });

      toast({ description: 'Competência atualizada.' });
      setCompetenciaEdit(null);
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível salvar a competência.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCompetencia(false);
    }
  };

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Obrigações do Cliente"
        description="O trabalho que não acaba: competências geradas com vencimento e cobradas até a entrega."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGerar} disabled={isGerando} className={listingSecondaryButtonClassName}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isGerando ? 'Gerando...' : 'Gerar competências'}
            </Button>
            <Button onClick={openVinculoCreate} className={listingPrimaryButtonClassName}>
              <Plus className="mr-2 h-4 w-4" />
              Vincular obrigação
            </Button>
          </div>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && setAppliedSearch(searchInput.trim())}
              placeholder="Buscar por cliente ou obrigação"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>

          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              {situacaoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={obrigacaoFilter} onValueChange={setObrigacaoFilter}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Obrigação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obrigações</SelectItem>
              {obrigacaoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {usuarioOptions
                .filter((option) => option.value)
                .map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={() => setAppliedSearch(searchInput.trim())} className={listingPrimaryButtonClassName}>
              Buscar
            </Button>
            <Button
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
                setSituacao('abertas');
                setObrigacaoFilter('all');
                setResponsavelFilter('all');
              }}
              variant="outline"
              className={listingSecondaryButtonClassName}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </ListingFilterCard>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className={financeDetailTabsListClassName}>
          <TabsTrigger value="competencias" className={financeDetailTabsTriggerClassName}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Competências
          </TabsTrigger>
          <TabsTrigger value="vinculos" className={financeDetailTabsTriggerClassName}>
            <Link2 className="mr-2 h-4 w-4" />
            Vínculos por cliente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competencias" className="mt-4">
          <ListingTableCard>
            {loadingCompetencias ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando competências...</div>
            ) : errorCompetencias ? (
              <div className="p-8 text-center text-sm text-rose-600">
                Erro ao carregar: {errorCompetencias?.message || 'tente novamente'}
              </div>
            ) : listaCompetencias.length === 0 ? (
              <ListingEmptyState
                icon={CalendarClock}
                title="Nenhuma competência neste recorte"
                description="Vincule obrigações aos clientes e use Gerar competências para popular o calendário."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Cliente</TableHead>
                      <TableHead className={listingTableHeadClassName}>Obrigação</TableHead>
                      <TableHead className={listingTableHeadClassName}>Competência</TableHead>
                      <TableHead className={listingTableHeadClassName}>Vencimento legal</TableHead>
                      <TableHead className={listingTableHeadClassName}>Cobrança interna</TableHead>
                      <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                      <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaCompetencias.map((competencia) => (
                      <TableRow
                        key={competencia.id}
                        className="cursor-pointer"
                        onClick={() => openCompetencia(competencia)}
                      >
                        <TableCell className={listingTableCellClassName}>
                          {competencia.entity_name || '-'}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-900">{competencia.obrigacao_nome}</p>
                            <p className="text-xs text-slate-400">
                              {periodicidadeLabels[competencia.periodicidade] ?? competencia.periodicidade}
                              {competencia.setor ? ` · ${competencia.setor}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>{competencia.competencia_label}</TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {formatDateForDisplay(competencia.data_vencimento)}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {competencia.status === 'ENTREGUE' || competencia.status === 'DISPENSADA' ? (
                            <span className="text-xs text-slate-500">
                              {competencia.data_entrega
                                ? `Entregue em ${formatDateForDisplay(competencia.data_entrega)}`
                                : '—'}
                            </span>
                          ) : (
                            <PrazoBadge
                              dataLimite={competencia.data_vencimento}
                              diasAtraso={competencia.dias_atraso}
                              aguardando={isAguardando(competencia.status)}
                            />
                          )}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {competencia.responsavel_nome || '-'}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <OperacaoStatusBadge status={competencia.status} />
                        </TableCell>
                        <TableCell
                          className={`${listingTableCellClassName} text-right`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <FinanceActionButton
                            icon={Pencil}
                            title="Atualizar competência"
                            tone="brand"
                            onClick={() => openCompetencia(competencia)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="vinculos" className="mt-4">
          <ListingTableCard>
            {loadingVinculos ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando vínculos...</div>
            ) : listaVinculos.length === 0 ? (
              <ListingEmptyState
                icon={Link2}
                title="Nenhuma obrigação vinculada"
                description="Diga quais obrigações cada cliente tem para que as competências passem a ser geradas."
                action={
                  <Button onClick={openVinculoCreate} className={listingPrimaryButtonClassName}>
                    <Plus className="mr-2 h-4 w-4" />
                    Vincular obrigação
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Cliente</TableHead>
                      <TableHead className={listingTableHeadClassName}>Obrigação</TableHead>
                      <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                      <TableHead className={listingTableHeadClassName}>Vigência</TableHead>
                      <TableHead className={listingTableHeadClassName}>Em aberto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Próximo vencimento</TableHead>
                      <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaVinculos.map((vinculo) => {
                      const atrasadas = toNumber(vinculo.competencias_atrasadas);

                      return (
                        <TableRow key={vinculo.id}>
                          <TableCell className={listingTableCellClassName}>{vinculo.entity_name || '-'}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="space-y-0.5">
                              <p className="font-medium text-slate-900">{vinculo.obrigacao_nome}</p>
                              <p className="text-xs text-slate-400">
                                {periodicidadeLabels[vinculo.periodicidade] ?? vinculo.periodicidade}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{vinculo.responsavel_nome || '-'}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {formatDateForDisplay(vinculo.data_inicio)}
                            {vinculo.data_fim ? ` até ${formatDateForDisplay(vinculo.data_fim)}` : ''}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="flex items-center gap-2">
                              <span>{toNumber(vinculo.competencias_abertas)}</span>
                              {atrasadas > 0 ? (
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  {atrasadas} vencida{atrasadas > 1 ? 's' : ''}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {formatDateForDisplay(vinculo.proximo_vencimento)}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <FinanceStatusBadge
                              label={vinculo.ativo ? 'Ativo' : 'Encerrado'}
                              tone={vinculo.ativo ? 'success' : 'neutral'}
                            />
                          </TableCell>
                          <TableCell className={`${listingTableCellClassName} text-right`}>
                            <div className="flex justify-end gap-2">
                              <FinanceActionButton
                                icon={Pencil}
                                title="Editar vínculo"
                                tone="brand"
                                onClick={() => openVinculoEdit(vinculo)}
                              />
                              <FinanceActionButton
                                icon={Trash2}
                                title="Excluir vínculo"
                                tone="danger"
                                onClick={() => handleDeleteVinculo(vinculo)}
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
        </TabsContent>
      </Tabs>

      <Dialog open={isVinculoOpen} onOpenChange={setIsVinculoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{vinculoForm.id ? 'Editar vínculo' : 'Vincular obrigação ao cliente'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente, empresa ou grupo *</Label>
              <Combobox
                value={vinculoForm.entidade}
                onValueChange={(value) => setVinculoForm((prev) => ({ ...prev, entidade: value }))}
                options={entidadeOptions}
                placeholder="Selecionar"
                searchPlaceholder="Buscar"
                disabled={Boolean(vinculoForm.id)}
              />
            </div>

            <div className="space-y-2">
              <Label>Obrigação *</Label>
              <Combobox
                value={vinculoForm.obrigacaoId}
                onValueChange={(value) => setVinculoForm((prev) => ({ ...prev, obrigacaoId: value }))}
                options={obrigacaoOptions}
                placeholder="Selecionar"
                disabled={Boolean(vinculoForm.id)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Início da vigência</Label>
                <DatePickerWithYearSelector
                  date={vinculoForm.dataInicio}
                  onDateChange={(date) => setVinculoForm((prev) => ({ ...prev, dataInicio: date }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Fim da vigência</Label>
                <DatePickerWithYearSelector
                  date={vinculoForm.dataFim}
                  onDateChange={(date) => setVinculoForm((prev) => ({ ...prev, dataFim: date }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Combobox
                value={vinculoForm.responsavelUserId}
                onValueChange={(value) => setVinculoForm((prev) => ({ ...prev, responsavelUserId: value }))}
                options={usuarioOptions}
                placeholder="Selecionar responsável"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={vinculoForm.observacoes}
                onChange={(event) => setVinculoForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="vinculo-ativo"
                checked={vinculoForm.ativo}
                onCheckedChange={(checked) => setVinculoForm((prev) => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="vinculo-ativo" className="cursor-pointer text-sm">
                Vínculo ativo
              </Label>
            </div>

            <p className="text-xs text-slate-500">
              Ao salvar, as competências são geradas dos últimos 12 meses até 3 meses à frente.
            </p>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className={listingSecondaryButtonClassName} onClick={() => setIsVinculoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveVinculo} disabled={isSavingVinculo} className={listingPrimaryButtonClassName}>
              {isSavingVinculo ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(competenciaEdit)} onOpenChange={(open) => !open && setCompetenciaEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {competenciaEdit?.obrigacao_nome} · {competenciaEdit?.competencia_label}
            </DialogTitle>
          </DialogHeader>

          {competenciaEdit ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {competenciaEdit.entity_name} · vencimento legal em{' '}
                <span className="font-semibold text-slate-800">
                  {formatDateForDisplay(competenciaEdit.data_vencimento)}
                </span>
                . O prazo legal não se move: marcar &quot;aguardando&quot; registra de quem é a demora, não adia a
                entrega.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Select
                    value={competenciaForm.status}
                    onValueChange={(value) => setCompetenciaForm((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {competenciaStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data de entrega</Label>
                  <DatePickerWithYearSelector
                    date={competenciaForm.dataEntrega}
                    onDateChange={(date) => setCompetenciaForm((prev) => ({ ...prev, dataEntrega: date }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Protocolo / recibo</Label>
                  <Input
                    value={competenciaForm.protocolo}
                    onChange={(event) => setCompetenciaForm((prev) => ({ ...prev, protocolo: event.target.value }))}
                    placeholder="Número do recibo de entrega"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Combobox
                    value={competenciaForm.responsavelUserId}
                    onValueChange={(value) =>
                      setCompetenciaForm((prev) => ({ ...prev, responsavelUserId: value }))
                    }
                    options={usuarioOptions}
                    placeholder="Selecionar"
                  />
                </div>
              </div>

              {isAguardando(competenciaForm.status) ? (
                <div className="space-y-2">
                  <Label>
                    {competenciaForm.status === 'AGUARDANDO_CLIENTE'
                      ? 'O que falta do cliente'
                      : 'O que falta do órgão'}
                  </Label>
                  <Input
                    value={competenciaForm.aguardandoMotivo}
                    onChange={(event) =>
                      setCompetenciaForm((prev) => ({ ...prev, aguardandoMotivo: event.target.value }))
                    }
                    placeholder="Ex.: aguardando extratos bancários"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={competenciaForm.observacoes}
                  onChange={(event) => setCompetenciaForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              className={listingSecondaryButtonClassName}
              onClick={() => setCompetenciaEdit(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCompetencia}
              disabled={isSavingCompetencia}
              className={listingPrimaryButtonClassName}
            >
              {isSavingCompetencia ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
