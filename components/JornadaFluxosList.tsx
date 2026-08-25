'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/finance/detail-ui';
import { OperacaoSectionTitle, entityTypeLabels, toNumber } from '@/components/operacao/operacao-ui';
import { useToast } from '@/hooks/use-toast';
import loadJornadaFluxosAction from '@/actions/loadJornadaFluxos';
import loadJornadaFluxoEtapasAction from '@/actions/loadJornadaFluxoEtapas';
import saveJornadaFluxoAction from '@/actions/saveJornadaFluxo';
import deleteJornadaFluxoAction from '@/actions/deleteJornadaFluxo';
import loadUsersAction from '@/actions/loadUsers';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';

interface FluxoRow {
  id: number;
  nome: string;
  descricao?: string | null;
  entity_type?: string | null;
  avanco_automatico: boolean;
  padrao: boolean;
  ativo: boolean;
  total_etapas?: number | string | null;
  total_checklist?: number | string | null;
  jornadas_vinculadas?: number | string | null;
}

interface ChecklistModelo {
  id: number | null;
  descricao: string;
  ordem: number;
  obrigatorio: boolean;
}

interface EtapaModelo {
  id: number | null;
  nome: string;
  descricao: string;
  ordem: number;
  prazo_dias: string;
  setor: string;
  responsavel_padrao_user_id: string;
  ativo: boolean;
  em_uso: number;
  checklist: ChecklistModelo[];
}

const novaEtapa = (ordem: number): EtapaModelo => ({
  id: null,
  nome: '',
  descricao: '',
  ordem,
  prazo_dias: '',
  setor: '',
  responsavel_padrao_user_id: '',
  ativo: true,
  em_uso: 0,
  checklist: [],
});

export function JornadaFluxosList() {
  const { toast } = useToast();

  const [selectedFluxoId, setSelectedFluxoId] = useState<number | 'novo' | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    entityType: 'todos',
    avancoAutomatico: true,
    padrao: false,
    ativo: true,
  });
  const [etapas, setEtapas] = useState<EtapaModelo[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [fluxos, loading, error, refreshFluxos] = useLoadAction(loadJornadaFluxosAction, [], {
    searchTerm: appliedSearch || null,
  });
  const [etapasCarregadas, loadingEtapas] = useLoadAction(loadJornadaFluxoEtapasAction, [], {
    fluxoId: typeof selectedFluxoId === 'number' ? selectedFluxoId : null,
  });
  const [usuarios] = useLoadAction(loadUsersAction, []);

  const [saveFluxo] = useMutateAction(saveJornadaFluxoAction);
  const [deleteFluxo] = useMutateAction(deleteJornadaFluxoAction);

  const lista: FluxoRow[] = Array.isArray(fluxos) ? fluxos : [];
  const fluxoAtual = typeof selectedFluxoId === 'number'
    ? lista.find((fluxo) => fluxo.id === selectedFluxoId) ?? null
    : null;

  const usuarioOptions = useMemo(
    () => [
      { value: '', label: 'Sem responsável padrão' },
      ...(Array.isArray(usuarios) ? usuarios : []).map((user: any) => ({
        value: String(user.id),
        label: user.name || user.email || `Usuário ${user.id}`,
      })),
    ],
    [usuarios],
  );

  useEffect(() => {
    if (selectedFluxoId === 'novo') {
      setForm({ nome: '', descricao: '', entityType: 'todos', avancoAutomatico: true, padrao: false, ativo: true });
      setEtapas([novaEtapa(1)]);
      return;
    }

    if (!fluxoAtual) return;

    setForm({
      nome: fluxoAtual.nome ?? '',
      descricao: fluxoAtual.descricao ?? '',
      entityType: fluxoAtual.entity_type || 'todos',
      avancoAutomatico: Boolean(fluxoAtual.avanco_automatico),
      padrao: Boolean(fluxoAtual.padrao),
      ativo: Boolean(fluxoAtual.ativo),
    });
  }, [selectedFluxoId, fluxoAtual]);

  useEffect(() => {
    if (selectedFluxoId === 'novo' || !Array.isArray(etapasCarregadas)) return;

    setEtapas(
      etapasCarregadas.map((etapa: any, index: number) => ({
        id: Number(etapa.id),
        nome: etapa.nome ?? '',
        descricao: etapa.descricao ?? '',
        ordem: Number(etapa.ordem) || index + 1,
        prazo_dias: etapa.prazo_dias === null || etapa.prazo_dias === undefined ? '' : String(etapa.prazo_dias),
        setor: etapa.setor ?? '',
        responsavel_padrao_user_id: etapa.responsavel_padrao_user_id
          ? String(etapa.responsavel_padrao_user_id)
          : '',
        ativo: etapa.ativo !== false,
        em_uso: toNumber(etapa.em_uso),
        checklist: (Array.isArray(etapa.checklist) ? etapa.checklist : []).map((item: any, i: number) => ({
          id: Number(item.id),
          descricao: item.descricao ?? '',
          ordem: Number(item.ordem) || i + 1,
          obrigatorio: item.obrigatorio !== false,
        })),
      })),
    );
  }, [etapasCarregadas, selectedFluxoId]);

  const updateEtapa = (index: number, patch: Partial<EtapaModelo>) => {
    setEtapas((prev) => prev.map((etapa, i) => (i === index ? { ...etapa, ...patch } : etapa)));
  };

  const moveEtapa = (index: number, direcao: -1 | 1) => {
    setEtapas((prev) => {
      const destino = index + direcao;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia.map((etapa, i) => ({ ...etapa, ordem: i + 1 }));
    });
  };

  const removeEtapa = (index: number) => {
    const etapa = etapas[index];
    if (etapa.em_uso > 0) {
      toast({
        title: 'Etapa em uso',
        description: `Esta etapa está em ${etapa.em_uso} jornada(s). Ao salvar ela será apenas inativada, sem apagar o andamento.`,
      });
    }
    setEtapas((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, ordem: i + 1 })));
  };

  const updateChecklist = (etapaIndex: number, itemIndex: number, patch: Partial<ChecklistModelo>) => {
    setEtapas((prev) =>
      prev.map((etapa, i) =>
        i === etapaIndex
          ? {
              ...etapa,
              checklist: etapa.checklist.map((item, j) => (j === itemIndex ? { ...item, ...patch } : item)),
            }
          : etapa,
      ),
    );
  };

  const addChecklist = (etapaIndex: number) => {
    setEtapas((prev) =>
      prev.map((etapa, i) =>
        i === etapaIndex
          ? {
              ...etapa,
              checklist: [
                ...etapa.checklist,
                { id: null, descricao: '', ordem: etapa.checklist.length + 1, obrigatorio: true },
              ],
            }
          : etapa,
      ),
    );
  };

  const removeChecklist = (etapaIndex: number, itemIndex: number) => {
    setEtapas((prev) =>
      prev.map((etapa, i) =>
        i === etapaIndex
          ? {
              ...etapa,
              checklist: etapa.checklist
                .filter((_, j) => j !== itemIndex)
                .map((item, j) => ({ ...item, ordem: j + 1 })),
            }
          : etapa,
      ),
    );
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome', description: 'O nome do fluxo é obrigatório.', variant: 'destructive' });
      return;
    }

    const etapasValidas = etapas.filter((etapa) => etapa.nome.trim());

    if (etapasValidas.length === 0) {
      toast({
        title: 'Fluxo sem etapas',
        description: 'Cadastre ao menos uma etapa para o fluxo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveFluxo({
        payload: encodeSqlJsonPayload({
          id: typeof selectedFluxoId === 'number' ? selectedFluxoId : null,
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          entity_type: form.entityType === 'todos' ? null : form.entityType,
          avanco_automatico: form.avancoAutomatico,
          padrao: form.padrao,
          ativo: form.ativo,
          etapas: etapasValidas.map((etapa, index) => ({
            id: etapa.id,
            nome: etapa.nome.trim(),
            descricao: etapa.descricao.trim() || null,
            ordem: index + 1,
            prazo_dias: etapa.prazo_dias === '' ? null : Number(etapa.prazo_dias),
            setor: etapa.setor.trim() || null,
            responsavel_padrao_user_id: etapa.responsavel_padrao_user_id
              ? Number(etapa.responsavel_padrao_user_id)
              : null,
            ativo: etapa.ativo,
            checklist: etapa.checklist
              .filter((item) => item.descricao.trim())
              .map((item, i) => ({
                id: item.id,
                descricao: item.descricao.trim(),
                ordem: i + 1,
                obrigatorio: item.obrigatorio,
              })),
          })),
        }),
      });

      toast({ title: 'Fluxo salvo', description: 'As etapas e o checklist modelo foram gravados.' });
      refreshFluxos();

      const novoId = Number(result?.[0]?.result?.id);
      if (selectedFluxoId === 'novo' && novoId) {
        setSelectedFluxoId(novoId);
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar fluxo',
        description: err?.message || 'Não foi possível salvar o fluxo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (fluxo: FluxoRow) => {
    if (!window.confirm(`Excluir o fluxo "${fluxo.nome}"?`)) return;

    try {
      await deleteFluxo({ id: fluxo.id });
      toast({ title: 'Fluxo excluído', description: 'O fluxo foi removido com sucesso.' });
      if (selectedFluxoId === fluxo.id) setSelectedFluxoId(null);
      refreshFluxos();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir fluxo',
        description: err?.message || 'Não foi possível excluir o fluxo.',
        variant: 'destructive',
      });
    }
  };

  if (selectedFluxoId !== null) {
    return (
      <div className="space-y-6">
        <FinanceDetailHeader
          title={selectedFluxoId === 'novo' ? 'Novo fluxo' : form.nome || 'Fluxo'}
          subtitle="Modelo de etapas, prazos e checklist aplicado às jornadas deste tipo de cliente ou serviço."
          onBack={() => setSelectedFluxoId(null)}
        />

        <FinanceDetailSectionCard title="Dados do fluxo" description="Como este fluxo se comporta nas jornadas.">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                  placeholder="Ex.: Abertura de MEI, Migração de contabilidade"
                  className={financeDetailFieldClassName}
                />
              </div>

              <div className="space-y-2">
                <Label>Aplica-se a</Label>
                <Select
                  value={form.entityType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, entityType: value }))}
                >
                  <SelectTrigger className={financeDetailFieldClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Qualquer tipo</SelectItem>
                    <SelectItem value="cliente">{entityTypeLabels.cliente}</SelectItem>
                    <SelectItem value="empresa">{entityTypeLabels.empresa}</SelectItem>
                    <SelectItem value="grupo">{entityTypeLabels.grupo}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Quando este fluxo deve ser usado"
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="fluxo-avanco"
                  checked={form.avancoAutomatico}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, avancoAutomatico: checked }))}
                />
                <Label htmlFor="fluxo-avanco" className="cursor-pointer text-sm">
                  Avanço automático
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="fluxo-padrao"
                  checked={form.padrao}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, padrao: checked }))}
                />
                <Label htmlFor="fluxo-padrao" className="cursor-pointer text-sm">
                  Fluxo padrão
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="fluxo-ativo"
                  checked={form.ativo}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="fluxo-ativo" className="cursor-pointer text-sm">
                  Ativo
                </Label>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Com o avanço automático ligado, concluir uma etapa coloca a próxima em andamento e o prazo dela
              começa a contar na hora.
            </p>
          </div>
        </FinanceDetailSectionCard>

        <FinanceDetailSectionCard
          title="Etapas do fluxo"
          description="A ordem aqui é a ordem da jornada. O prazo é em dias corridos a partir do início da etapa."
        >
          {loadingEtapas && etapas.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">Carregando etapas...</div>
          ) : (
            <div className="space-y-4">
              {etapas.map((etapa, index) => (
                <div key={etapa.id ?? `nova-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">Etapa {index + 1}</span>
                    <div className="flex items-center gap-1">
                      {etapa.em_uso > 0 ? (
                        <FinanceStatusBadge label={`${etapa.em_uso} em uso`} tone="neutral" />
                      ) : null}
                      <FinanceActionButton
                        icon={ArrowUp}
                        title="Subir"
                        onClick={() => moveEtapa(index, -1)}
                        tone="neutral"
                      />
                      <FinanceActionButton
                        icon={ArrowDown}
                        title="Descer"
                        onClick={() => moveEtapa(index, 1)}
                        tone="neutral"
                      />
                      <FinanceActionButton
                        icon={Trash2}
                        title="Remover etapa"
                        onClick={() => removeEtapa(index)}
                        tone="danger"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2 lg:col-span-2">
                      <Label>Nome *</Label>
                      <Input
                        value={etapa.nome}
                        onChange={(event) => updateEtapa(index, { nome: event.target.value })}
                        placeholder="Ex.: Coleta de documentos"
                        className={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Prazo (dias)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={etapa.prazo_dias}
                        onChange={(event) => updateEtapa(index, { prazo_dias: event.target.value })}
                        placeholder="Sem SLA"
                        className={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Setor</Label>
                      <Input
                        value={etapa.setor}
                        onChange={(event) => updateEtapa(index, { setor: event.target.value })}
                        placeholder="Ex.: Fiscal"
                        className={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <Label>Descrição</Label>
                      <Input
                        value={etapa.descricao}
                        onChange={(event) => updateEtapa(index, { descricao: event.target.value })}
                        placeholder="O que precisa acontecer nesta etapa"
                        className={financeDetailFieldClassName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Responsável padrão</Label>
                      <Combobox
                        value={etapa.responsavel_padrao_user_id}
                        onValueChange={(value) => updateEtapa(index, { responsavel_padrao_user_id: value })}
                        options={usuarioOptions}
                        placeholder="Selecionar"
                      />
                    </div>

                    <div className="flex items-end gap-2 pb-2">
                      <Switch
                        id={`etapa-ativa-${index}`}
                        checked={etapa.ativo}
                        onCheckedChange={(checked) => updateEtapa(index, { ativo: checked })}
                      />
                      <Label htmlFor={`etapa-ativa-${index}`} className="cursor-pointer text-sm">
                        Ativa
                      </Label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <OperacaoSectionTitle
                      title="Checklist modelo"
                      description="Itens marcados como obrigatórios impedem concluir a etapa."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addChecklist(index)}
                          className="h-8 rounded-lg border-slate-200 px-2.5 text-xs"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Item
                        </Button>
                      }
                    />

                    <div className="mt-3 space-y-2">
                      {etapa.checklist.length === 0 ? (
                        <p className="text-xs text-slate-400">Sem checklist. A etapa fecha sem verificação.</p>
                      ) : (
                        etapa.checklist.map((item, itemIndex) => (
                          <div key={item.id ?? `novo-${itemIndex}`} className="flex items-center gap-2">
                            <Input
                              value={item.descricao}
                              onChange={(event) =>
                                updateChecklist(index, itemIndex, { descricao: event.target.value })
                              }
                              placeholder="Ex.: Cópia do contrato social"
                              className="h-9 rounded-xl border-slate-200 text-sm"
                            />
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Switch
                                id={`check-${index}-${itemIndex}`}
                                checked={item.obrigatorio}
                                onCheckedChange={(checked) =>
                                  updateChecklist(index, itemIndex, { obrigatorio: checked })
                                }
                              />
                              <Label
                                htmlFor={`check-${index}-${itemIndex}`}
                                className="cursor-pointer text-[11px] text-slate-500"
                              >
                                Obrig.
                              </Label>
                            </div>
                            <FinanceActionButton
                              icon={Trash2}
                              title="Remover item"
                              onClick={() => removeChecklist(index, itemIndex)}
                              tone="danger"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => setEtapas((prev) => [...prev, novaEtapa(prev.length + 1)])}
                className={listingSecondaryButtonClassName}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar etapa
              </Button>
            </div>
          )}
        </FinanceDetailSectionCard>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className={listingSecondaryButtonClassName} onClick={() => setSelectedFluxoId(null)}>
            Voltar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className={listingPrimaryButtonClassName}>
            {isSaving ? 'Salvando...' : 'Salvar fluxo'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Fluxos e Etapas"
        description="Cada tipo de cliente ou serviço tem seu próprio roteiro, com prazo e checklist por etapa."
        action={
          <Button onClick={() => setSelectedFluxoId('novo')} className={listingPrimaryButtonClassName}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Fluxo
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-3 lg:grid-cols-[2fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && setAppliedSearch(searchInput.trim())}
              placeholder="Buscar fluxo"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAppliedSearch(searchInput.trim())} className={listingPrimaryButtonClassName}>
              Buscar
            </Button>
            <Button
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
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
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando fluxos...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">
            Erro ao carregar fluxos: {error?.message || 'tente novamente'}
          </div>
        ) : lista.length === 0 ? (
          <ListingEmptyState
            icon={ListChecks}
            title="Nenhum fluxo cadastrado"
            description="Crie o roteiro de cada serviço para que as jornadas nasçam com etapas, prazos e checklist."
            action={
              <Button onClick={() => setSelectedFluxoId('novo')} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Fluxo
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={listingTableHeadClassName}>Fluxo</TableHead>
                  <TableHead className={listingTableHeadClassName}>Aplica-se a</TableHead>
                  <TableHead className={listingTableHeadClassName}>Etapas</TableHead>
                  <TableHead className={listingTableHeadClassName}>Checklist</TableHead>
                  <TableHead className={listingTableHeadClassName}>Jornadas</TableHead>
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((fluxo) => (
                  <TableRow key={fluxo.id} className="cursor-pointer" onClick={() => setSelectedFluxoId(fluxo.id)}>
                    <TableCell className={listingTableCellClassName}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{fluxo.nome}</p>
                          {fluxo.padrao ? <FinanceStatusBadge label="Padrão" tone="success" /> : null}
                        </div>
                        {fluxo.descricao ? <p className="text-xs text-slate-500">{fluxo.descricao}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      {fluxo.entity_type
                        ? entityTypeLabels[fluxo.entity_type as keyof typeof entityTypeLabels]
                        : 'Qualquer tipo'}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{toNumber(fluxo.total_etapas)}</TableCell>
                    <TableCell className={listingTableCellClassName}>{toNumber(fluxo.total_checklist)}</TableCell>
                    <TableCell className={listingTableCellClassName}>{toNumber(fluxo.jornadas_vinculadas)}</TableCell>
                    <TableCell className={listingTableCellClassName}>
                      <FinanceStatusBadge
                        label={fluxo.ativo ? 'Ativo' : 'Inativo'}
                        tone={fluxo.ativo ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell
                      className={`${listingTableCellClassName} text-right`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end gap-2">
                        <FinanceActionButton
                          icon={Pencil}
                          title="Editar fluxo"
                          tone="brand"
                          onClick={() => setSelectedFluxoId(fluxo.id)}
                        />
                        <FinanceActionButton
                          icon={Trash2}
                          title="Excluir fluxo"
                          tone="danger"
                          onClick={() => handleDelete(fluxo)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ListingTableCard>
    </div>
  );
}
