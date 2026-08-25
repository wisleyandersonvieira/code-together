'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { AlertTriangle, CalendarClock, CalendarDays, PauseCircle, Search, UserX, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
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
  ChecklistProgress,
  OperacaoStatusBadge,
  PrazoBadge,
  ResumoCard,
  competenciaStatusOptions,
  etapaStatusOptions,
  toNumber,
} from '@/components/operacao/operacao-ui';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import loadOperacaoTarefasAction from '@/actions/loadOperacaoTarefas';
import loadOperacaoResumoAction from '@/actions/loadOperacaoResumo';
import loadOperacaoSetoresAction from '@/actions/loadOperacaoSetores';
import loadUsersAction from '@/actions/loadUsers';
import saveJornadaItemAction from '@/actions/saveJornadaItem';
import saveObrigacaoCompetenciaAction from '@/actions/saveObrigacaoCompetencia';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';
import { formatDateForDisplay } from '@/utils/timezone';

interface TarefaRow {
  origem: 'ETAPA' | 'OBRIGACAO';
  referencia_id: number;
  jornada_id?: number | null;
  entity_type: string;
  entity_id: number;
  cliente_nome?: string | null;
  titulo: string;
  contexto?: string | null;
  setor?: string | null;
  status: string;
  aguardando: boolean;
  aguardando_motivo?: string | null;
  responsavel_user_id?: number | null;
  responsavel_nome?: string | null;
  data_limite?: string | null;
  data_vencimento_legal?: string | null;
  dias_atraso?: number | string | null;
  dias_parados?: number | string | null;
  dias_no_status?: number | string | null;
  checklist_total?: number | string | null;
  checklist_concluidos?: number | string | null;
}

interface OperacaoTarefasPanelProps {
  /** 'minhas' trava o filtro no usuário logado e esconde a coluna de responsável. */
  modo: 'painel' | 'minhas';
  onAbrirJornada?: (jornadaId: number) => void;
}

export function OperacaoTarefasPanel({ modo, onAbrirJornada }: OperacaoTarefasPanelProps) {
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const meuId = currentUser?.legacy_user_id ? String(currentUser.legacy_user_id) : null;

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [situacao, setSituacao] = useState<string>(modo === 'minhas' ? 'proximos_7' : 'atrasadas');
  const [origem, setOrigem] = useState('all');
  const [setor, setSetor] = useState('all');
  const [responsavel, setResponsavel] = useState('all');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const responsavelEfetivo = modo === 'minhas' ? meuId ?? 'all' : responsavel;

  const [tarefas, loadingTarefas, errorTarefas, refreshTarefas] = useLoadAction(loadOperacaoTarefasAction, [], {
    searchTerm: appliedSearch || null,
    situacao,
    origem,
    setor,
    responsavelId: responsavelEfetivo,
  });
  const [resumo, , , refreshResumo] = useLoadAction(loadOperacaoResumoAction, [], {
    responsavelId: responsavelEfetivo,
  });
  const [setores] = useLoadAction(loadOperacaoSetoresAction, []);
  const [usuarios] = useLoadAction(loadUsersAction, []);

  const [saveJornadaItem] = useMutateAction(saveJornadaItemAction);
  const [saveCompetencia] = useMutateAction(saveObrigacaoCompetenciaAction);

  const lista: TarefaRow[] = Array.isArray(tarefas) ? tarefas : [];
  const contadores = (Array.isArray(resumo) ? resumo[0] : null) ?? {};

  const usuarioOptions = useMemo(
    () =>
      (Array.isArray(usuarios) ? usuarios : []).map((user: any) => ({
        value: String(user.id),
        label: user.name || user.email || `Usuário ${user.id}`,
      })),
    [usuarios],
  );

  const setorOptions = useMemo(
    () => (Array.isArray(setores) ? setores : []).map((linha: any) => String(linha.setor)),
    [setores],
  );

  const refreshTudo = () => {
    refreshTarefas();
    refreshResumo();
  };

  const handleStatusChange = async (tarefa: TarefaRow, status: string) => {
    const key = `${tarefa.origem}-${tarefa.referencia_id}`;
    setSavingKey(key);

    try {
      if (tarefa.origem === 'ETAPA') {
        await saveJornadaItem({
          payload: encodeSqlJsonPayload({ item_id: tarefa.referencia_id, status }),
          userId: currentUser?.legacy_user_id || null,
        });
      } else {
        await saveCompetencia({
          payload: encodeSqlJsonPayload({ id: tarefa.referencia_id, status }),
          userId: currentUser?.legacy_user_id || null,
        });
      }

      toast({ description: `"${tarefa.titulo}" atualizada.` });
      refreshTudo();
    } catch (err: any) {
      toast({
        title: 'Não foi possível mudar o status',
        description: err?.message || 'Verifique o checklist obrigatório da etapa.',
        variant: 'destructive',
      });
      refreshTarefas();
    } finally {
      setSavingKey(null);
    }
  };

  const cards = [
    {
      key: 'atrasadas',
      label: 'Atrasadas',
      value: toNumber(contadores.atrasadas),
      icon: AlertTriangle,
      tone: 'danger' as const,
      hint: 'Prazo estourado com a bola conosco',
    },
    {
      key: 'vence_hoje',
      label: 'Vence hoje',
      value: toNumber(contadores.vence_hoje),
      icon: CalendarDays,
      tone: 'warning' as const,
    },
    {
      key: 'proximos_7',
      label: 'Próximos 7 dias',
      value: toNumber(contadores.proximos_7),
      icon: CalendarClock,
      tone: 'brand' as const,
    },
    {
      key: 'aguardando',
      label: 'Aguardando terceiros',
      value: toNumber(contadores.aguardando),
      icon: PauseCircle,
      tone: 'neutral' as const,
      hint: 'SLA da equipe pausado',
    },
  ];

  if (modo === 'painel') {
    cards.push({
      key: 'sem_responsavel',
      label: 'Sem responsável',
      value: toNumber(contadores.sem_responsavel),
      icon: UserX,
      tone: 'neutral' as const,
      hint: 'Ninguém foi cobrado ainda',
    });
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title={modo === 'minhas' ? 'Minhas Tarefas' : 'Painel de Prazos'}
        description={
          modo === 'minhas'
            ? 'Tudo o que está no seu nome, de etapa de jornada a competência de obrigação.'
            : 'Etapas de jornada e competências de obrigação no mesmo lugar, ordenadas pelo que cobra primeiro.'
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <ResumoCard
            key={card.key}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            hint={card.hint}
            active={situacao === card.key}
            onClick={() =>
              setSituacao((prev) => {
                if (card.key === 'sem_responsavel') return prev;
                return prev === card.key ? 'all' : card.key;
              })
            }
          />
        ))}
      </div>

      <ListingFilterCard>
        <div className={`grid gap-3 ${modo === 'minhas' ? 'lg:grid-cols-[2fr_1fr_1fr_auto]' : 'lg:grid-cols-[2fr_1fr_1fr_1fr_auto]'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && setAppliedSearch(searchInput.trim())}
              placeholder="Buscar por cliente ou tarefa"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>

          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Jornada e obrigações</SelectItem>
              <SelectItem value="ETAPA">Só etapas de jornada</SelectItem>
              <SelectItem value="OBRIGACAO">Só obrigações</SelectItem>
            </SelectContent>
          </Select>

          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setorOptions.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {modo === 'painel' ? (
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger className={listingFilterFieldClassName}>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {usuarioOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={() => setAppliedSearch(searchInput.trim())} className={listingPrimaryButtonClassName}>
              Buscar
            </Button>
            <Button
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
                setSituacao('all');
                setOrigem('all');
                setSetor('all');
                setResponsavel('all');
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

      <ListingTableCard>
        {loadingTarefas ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando tarefas...</div>
        ) : errorTarefas ? (
          <div className="p-8 text-center text-sm text-rose-600">
            Erro ao carregar: {errorTarefas?.message || 'tente novamente'}
          </div>
        ) : lista.length === 0 ? (
          <ListingEmptyState
            icon={CalendarClock}
            title={modo === 'minhas' ? 'Nada no seu nome neste recorte' : 'Nada a cobrar neste recorte'}
            description="Troque o filtro de situação ou limpe os filtros para ver as demais tarefas."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={listingTableHeadClassName}>Cliente</TableHead>
                  <TableHead className={listingTableHeadClassName}>Tarefa</TableHead>
                  <TableHead className={listingTableHeadClassName}>Prazo</TableHead>
                  {modo === 'painel' ? (
                    <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                  ) : null}
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={listingTableHeadClassName}>Mudar para</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((tarefa) => {
                  const key = `${tarefa.origem}-${tarefa.referencia_id}`;
                  const opcoes = tarefa.origem === 'ETAPA' ? etapaStatusOptions : competenciaStatusOptions;

                  return (
                    <TableRow key={key}>
                      <TableCell className={listingTableCellClassName}>
                        {tarefa.origem === 'ETAPA' && tarefa.jornada_id && onAbrirJornada ? (
                          <button
                            type="button"
                            className="text-left font-medium text-slate-900 underline-offset-2 hover:underline"
                            onClick={() => onAbrirJornada(tarefa.jornada_id as number)}
                          >
                            {tarefa.cliente_nome || '-'}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-900">{tarefa.cliente_nome || '-'}</span>
                        )}
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {tarefa.origem === 'ETAPA' ? 'Jornada' : 'Obrigação'}
                        </p>
                      </TableCell>

                      <TableCell className={listingTableCellClassName}>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800">{tarefa.titulo}</p>
                          <p className="text-xs text-slate-400">
                            {tarefa.contexto}
                            {tarefa.setor ? ` · ${tarefa.setor}` : ''}
                          </p>
                          {tarefa.origem === 'ETAPA' && toNumber(tarefa.checklist_total) > 0 ? (
                            <ChecklistProgress
                              total={tarefa.checklist_total}
                              concluidos={tarefa.checklist_concluidos}
                            />
                          ) : null}
                          {tarefa.aguardando && tarefa.aguardando_motivo ? (
                            <p className="text-xs text-amber-700">Falta: {tarefa.aguardando_motivo}</p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className={listingTableCellClassName}>
                        <div className="space-y-1">
                          <PrazoBadge
                            dataLimite={tarefa.data_limite}
                            diasAtraso={tarefa.dias_atraso}
                            aguardando={tarefa.aguardando}
                          />
                          {tarefa.data_vencimento_legal ? (
                            <p className="text-[11px] text-slate-400">
                              Prazo legal {formatDateForDisplay(tarefa.data_vencimento_legal)}
                            </p>
                          ) : null}
                          {tarefa.aguardando ? (
                            <p className="text-[11px] text-slate-400">
                              Parado há {toNumber(tarefa.dias_no_status)} dia(s)
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      {modo === 'painel' ? (
                        <TableCell className={listingTableCellClassName}>
                          {tarefa.responsavel_nome || (
                            <span className="text-xs font-medium text-rose-600">Sem responsável</span>
                          )}
                        </TableCell>
                      ) : null}

                      <TableCell className={listingTableCellClassName}>
                        <OperacaoStatusBadge status={tarefa.status} />
                      </TableCell>

                      <TableCell className={listingTableCellClassName}>
                        <Select
                          value={tarefa.status}
                          disabled={savingKey === key}
                          onValueChange={(value) => handleStatusChange(tarefa, value)}
                        >
                          <SelectTrigger className="h-9 w-[190px] rounded-xl border-slate-200 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoes.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ListingTableCard>
    </div>
  );
}
