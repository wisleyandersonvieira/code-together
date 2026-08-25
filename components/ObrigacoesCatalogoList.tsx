'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { CalendarClock, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { mesesLabels, periodicidadeLabels, toNumber } from '@/components/operacao/operacao-ui';
import { useToast } from '@/hooks/use-toast';
import loadObrigacoesCatalogoAction from '@/actions/loadObrigacoesCatalogo';
import saveObrigacaoCatalogoAction from '@/actions/saveObrigacaoCatalogo';
import deleteObrigacaoCatalogoAction from '@/actions/deleteObrigacaoCatalogo';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';

interface ObrigacaoRow {
  id: number;
  nome: string;
  descricao?: string | null;
  periodicidade: string;
  mes_ancora?: number | null;
  dia_vencimento: number;
  mes_offset: number;
  prazo_interno_dias: number;
  setor?: string | null;
  ativo: boolean;
  clientes_vinculados?: number | string | null;
}

interface FormState {
  id: number | null;
  nome: string;
  descricao: string;
  periodicidade: string;
  mesAncora: string;
  diaVencimento: string;
  mesOffset: string;
  prazoInternoDias: string;
  setor: string;
  ativo: boolean;
}

const emptyForm: FormState = {
  id: null,
  nome: '',
  descricao: '',
  periodicidade: 'MENSAL',
  mesAncora: '',
  diaVencimento: '15',
  mesOffset: '1',
  prazoInternoDias: '0',
  setor: '',
  ativo: true,
};

/**
 * Repete a regra do banco (dia fixo, ajustado para o último dia do mês) só para
 * mostrar um exemplo enquanto o usuário digita.
 */
function calcularExemplo(form: FormState) {
  const hoje = new Date();
  const ancora = Number(form.mesAncora);
  const mesBase = form.periodicidade === 'MENSAL' || !Number.isFinite(ancora) || ancora < 1
    ? hoje.getMonth()
    : ancora - 1;

  const offset = Number(form.mesOffset);
  const dia = Number(form.diaVencimento);

  if (!Number.isFinite(offset) || !Number.isFinite(dia)) return null;

  const base = new Date(hoje.getFullYear(), mesBase + offset, 1);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const vencimento = new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(dia, 1), ultimoDia));

  const interno = new Date(vencimento);
  interno.setDate(interno.getDate() - (Number(form.prazoInternoDias) || 0));

  return {
    competencia: `${String(mesBase + 1).padStart(2, '0')}/${hoje.getFullYear()}`,
    vencimento: vencimento.toLocaleDateString('pt-BR'),
    interno: interno.toLocaleDateString('pt-BR'),
  };
}

export function ObrigacoesCatalogoList() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [periodicidadeFilter, setPeriodicidadeFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [obrigacoes, loading, error, refreshObrigacoes] = useLoadAction(loadObrigacoesCatalogoAction, [], {
    searchTerm: appliedSearch || null,
    periodicidade: periodicidadeFilter,
  });
  const [saveObrigacao] = useMutateAction(saveObrigacaoCatalogoAction);
  const [deleteObrigacao] = useMutateAction(deleteObrigacaoCatalogoAction);

  const lista: ObrigacaoRow[] = Array.isArray(obrigacoes) ? obrigacoes : [];
  const exemplo = useMemo(() => calcularExemplo(form), [form]);

  const openCreate = () => {
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (obrigacao: ObrigacaoRow) => {
    setForm({
      id: obrigacao.id,
      nome: obrigacao.nome ?? '',
      descricao: obrigacao.descricao ?? '',
      periodicidade: obrigacao.periodicidade ?? 'MENSAL',
      mesAncora: obrigacao.mes_ancora ? String(obrigacao.mes_ancora) : '',
      diaVencimento: String(obrigacao.dia_vencimento ?? 15),
      mesOffset: String(obrigacao.mes_offset ?? 1),
      prazoInternoDias: String(obrigacao.prazo_interno_dias ?? 0),
      setor: obrigacao.setor ?? '',
      ativo: Boolean(obrigacao.ativo),
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome', description: 'O nome da obrigação é obrigatório.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await saveObrigacao({
        payload: encodeSqlJsonPayload({
          id: form.id,
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          periodicidade: form.periodicidade,
          mes_ancora: form.periodicidade === 'MENSAL' || !form.mesAncora ? null : Number(form.mesAncora),
          dia_vencimento: Number(form.diaVencimento) || 15,
          mes_offset: Number(form.mesOffset) || 0,
          prazo_interno_dias: Number(form.prazoInternoDias) || 0,
          setor: form.setor.trim() || null,
          ativo: form.ativo,
        }),
      });

      toast({ title: 'Obrigação salva', description: 'O catálogo foi atualizado.' });
      setIsFormOpen(false);
      refreshObrigacoes();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível salvar a obrigação.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (obrigacao: ObrigacaoRow) => {
    if (!window.confirm(`Excluir a obrigação "${obrigacao.nome}"?`)) return;

    try {
      await deleteObrigacao({ id: obrigacao.id });
      toast({ title: 'Obrigação excluída', description: 'O registro foi removido.' });
      refreshObrigacoes();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a obrigação.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Catálogo de Obrigações"
        description="O que se repete todo mês e todo ano, com a regra de vencimento de cada um."
        action={
          <Button onClick={openCreate} className={listingPrimaryButtonClassName}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Obrigação
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && setAppliedSearch(searchInput.trim())}
              placeholder="Buscar obrigação"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>

          <Select value={periodicidadeFilter} onValueChange={setPeriodicidadeFilter}>
            <SelectTrigger className={listingFilterFieldClassName}>
              <SelectValue placeholder="Periodicidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as periodicidades</SelectItem>
              {Object.entries(periodicidadeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
                setPeriodicidadeFilter('all');
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
          <div className="p-8 text-center text-sm text-slate-500">Carregando obrigações...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">
            Erro ao carregar: {error?.message || 'tente novamente'}
          </div>
        ) : lista.length === 0 ? (
          <ListingEmptyState
            icon={CalendarClock}
            title="Nenhuma obrigação cadastrada"
            description="Cadastre as declarações recorrentes para que as competências sejam geradas com vencimento."
            action={
              <Button onClick={openCreate} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Obrigação
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={listingTableHeadClassName}>Obrigação</TableHead>
                  <TableHead className={listingTableHeadClassName}>Periodicidade</TableHead>
                  <TableHead className={listingTableHeadClassName}>Regra de vencimento</TableHead>
                  <TableHead className={listingTableHeadClassName}>Antecedência</TableHead>
                  <TableHead className={listingTableHeadClassName}>Setor</TableHead>
                  <TableHead className={listingTableHeadClassName}>Clientes</TableHead>
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((obrigacao) => (
                  <TableRow key={obrigacao.id}>
                    <TableCell className={listingTableCellClassName}>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{obrigacao.nome}</p>
                        {obrigacao.descricao ? (
                          <p className="text-xs text-slate-500">{obrigacao.descricao}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      <div className="space-y-0.5">
                        <span>{periodicidadeLabels[obrigacao.periodicidade] ?? obrigacao.periodicidade}</span>
                        {obrigacao.mes_ancora ? (
                          <p className="text-xs text-slate-400">
                            Competência a partir de {mesesLabels[obrigacao.mes_ancora - 1]}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      Dia {obrigacao.dia_vencimento}
                      {obrigacao.mes_offset === 0
                        ? ' do mês da competência'
                        : obrigacao.mes_offset === 1
                          ? ' do mês seguinte'
                          : ` de ${obrigacao.mes_offset} meses depois`}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      {toNumber(obrigacao.prazo_interno_dias) > 0
                        ? `${toNumber(obrigacao.prazo_interno_dias)} dias antes`
                        : '—'}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{obrigacao.setor || '-'}</TableCell>
                    <TableCell className={listingTableCellClassName}>
                      {toNumber(obrigacao.clientes_vinculados)}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      <FinanceStatusBadge
                        label={obrigacao.ativo ? 'Ativa' : 'Inativa'}
                        tone={obrigacao.ativo ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right`}>
                      <div className="flex justify-end gap-2">
                        <FinanceActionButton
                          icon={Pencil}
                          title="Editar"
                          tone="brand"
                          onClick={() => openEdit(obrigacao)}
                        />
                        <FinanceActionButton
                          icon={Trash2}
                          title="Excluir"
                          tone="danger"
                          onClick={() => handleDelete(obrigacao)}
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar obrigação' : 'Nova obrigação'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                  placeholder="Ex.: DCTFWeb"
                />
              </div>

              <div className="space-y-2">
                <Label>Setor</Label>
                <Input
                  value={form.setor}
                  onChange={(event) => setForm((prev) => ({ ...prev, setor: event.target.value }))}
                  placeholder="Ex.: Fiscal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Periodicidade</Label>
                <Select
                  value={form.periodicidade}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, periodicidade: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodicidadeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mês da competência</Label>
                <Select
                  value={form.mesAncora || 'auto'}
                  disabled={form.periodicidade === 'MENSAL'}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, mesAncora: value === 'auto' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático</SelectItem>
                    {mesesLabels.map((mes, index) => (
                      <SelectItem key={mes} value={String(index + 1)}>
                        {mes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dia do vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaVencimento}
                  onChange={(event) => setForm((prev) => ({ ...prev, diaVencimento: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Meses após a competência</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.mesOffset}
                  onChange={(event) => setForm((prev) => ({ ...prev, mesOffset: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Antecedência interna (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.prazoInternoDias}
                  onChange={(event) => setForm((prev) => ({ ...prev, prazoInternoDias: event.target.value }))}
                />
                <p className="text-[11px] text-slate-500">
                  Quantos dias antes do prazo legal o painel começa a cobrar a equipe.
                </p>
              </div>

              <div className="flex items-end gap-2 pb-6">
                <Switch
                  id="obrigacao-ativa"
                  checked={form.ativo}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="obrigacao-ativa" className="cursor-pointer text-sm">
                  Ativa
                </Label>
              </div>
            </div>

            {exemplo ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Exemplo:</span> competência {exemplo.competencia} vence
                em {exemplo.vencimento}
                {exemplo.interno !== exemplo.vencimento ? ` e é cobrada internamente a partir de ${exemplo.interno}` : ''}.
                Dia maior que o mês é ajustado para o último dia.
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className={listingSecondaryButtonClassName} onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className={listingPrimaryButtonClassName}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
