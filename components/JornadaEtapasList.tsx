'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { ListChecks, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import loadJornadaEtapasAction from '@/actions/loadJornadaEtapas';
import saveJornadaEtapaAction from '@/actions/saveJornadaEtapa';
import deleteJornadaEtapaAction from '@/actions/deleteJornadaEtapa';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';

interface JornadaEtapa {
  id: number;
  nome: string;
  descricao?: string | null;
  ordem: number;
  ativo: boolean;
  jornadas_vinculadas?: number | string;
}

interface EtapaFormState {
  id: number | null;
  nome: string;
  descricao: string;
  ordem: string;
  ativo: boolean;
}

const emptyForm: EtapaFormState = {
  id: null,
  nome: '',
  descricao: '',
  ordem: '1',
  ativo: true,
};

export function JornadaEtapasList() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<EtapaFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [etapas, loading, error, refreshEtapas] = useLoadAction(loadJornadaEtapasAction, [], {
    searchTerm: appliedSearch || null,
  });
  const [saveEtapa] = useMutateAction(saveJornadaEtapaAction);
  const [deleteEtapa] = useMutateAction(deleteJornadaEtapaAction);

  const lista: JornadaEtapa[] = Array.isArray(etapas) ? etapas : [];
  const proximaOrdem = lista.length > 0 ? Math.max(...lista.map((e) => Number(e.ordem) || 0)) + 1 : 1;

  const openCreate = () => {
    setForm({ ...emptyForm, ordem: String(proximaOrdem) });
    setIsFormOpen(true);
  };

  const openEdit = (etapa: JornadaEtapa) => {
    setForm({
      id: etapa.id,
      nome: etapa.nome ?? '',
      descricao: etapa.descricao ?? '',
      ordem: String(etapa.ordem ?? 1),
      ativo: Boolean(etapa.ativo),
    });
    setIsFormOpen(true);
  };

  const handleApplySearch = () => setAppliedSearch(searchInput.trim());

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({
        title: 'Informe o nome',
        description: 'O nome da etapa é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveEtapa({
        payload: encodeSqlJsonPayload({
          id: form.id,
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          ordem: Number(form.ordem) || 1,
          ativo: form.ativo,
        }),
      });

      toast({
        title: form.id ? 'Etapa atualizada' : 'Etapa criada',
        description: `A etapa "${form.nome.trim()}" foi salva com sucesso.`,
      });
      setIsFormOpen(false);
      setForm(emptyForm);
      refreshEtapas();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar etapa',
        description: err?.message || 'Não foi possível salvar a etapa.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (etapa: JornadaEtapa) => {
    if (!window.confirm(`Tem certeza que deseja excluir a etapa "${etapa.nome}"?`)) {
      return;
    }

    try {
      await deleteEtapa({ id: etapa.id });
      toast({
        title: 'Etapa excluída',
        description: `A etapa "${etapa.nome}" foi removida.`,
      });
      refreshEtapas();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir etapa',
        description: err?.message || 'Não foi possível excluir a etapa.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Etapas da Jornada"
        description="Configure as etapas que compõem a jornada de clientes, empresas e grupos."
        action={
          <Button onClick={openCreate} className={listingPrimaryButtonClassName}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Etapa
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleApplySearch()}
              placeholder="Buscar etapa pelo nome"
              className={`${listingFilterFieldClassName} pl-9`}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApplySearch} className={listingPrimaryButtonClassName}>
              Buscar
            </Button>
            {appliedSearch ? (
              <Button onClick={handleClearSearch} variant="outline" className={listingSecondaryButtonClassName}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            ) : null}
          </div>
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando etapas...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">
            Erro ao carregar etapas: {error?.message || 'tente novamente'}
          </div>
        ) : lista.length === 0 ? (
          <ListingEmptyState
            icon={ListChecks}
            title="Nenhuma etapa cadastrada"
            description="Cadastre as etapas da jornada para começar a acompanhar seus clientes."
            action={
              <Button onClick={openCreate} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Etapa
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={listingTableHeadClassName}>Ordem</TableHead>
                  <TableHead className={listingTableHeadClassName}>Etapa</TableHead>
                  <TableHead className={listingTableHeadClassName}>Descrição</TableHead>
                  <TableHead className={listingTableHeadClassName}>Jornadas</TableHead>
                  <TableHead className={listingTableHeadClassName}>Situação</TableHead>
                  <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((etapa) => (
                  <TableRow key={etapa.id}>
                    <TableCell className={`${listingTableCellClassName} font-semibold text-slate-700`}>
                      {etapa.ordem}
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                      {etapa.nome}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{etapa.descricao || '-'}</TableCell>
                    <TableCell className={listingTableCellClassName}>
                      {Number(etapa.jornadas_vinculadas ?? 0)}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>
                      <FinanceStatusBadge
                        label={etapa.ativo ? 'Ativa' : 'Inativa'}
                        tone={etapa.ativo ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right`}>
                      <div className="flex justify-end gap-2">
                        <FinanceActionButton
                          icon={Pencil}
                          title="Editar etapa"
                          tone="brand"
                          onClick={() => openEdit(etapa)}
                        />
                        <FinanceActionButton
                          icon={Trash2}
                          title="Excluir etapa"
                          tone="danger"
                          onClick={() => handleDelete(etapa)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="etapa-nome">Nome *</Label>
              <Input
                id="etapa-nome"
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex.: Onboarding"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="etapa-descricao">Descrição</Label>
              <Textarea
                id="etapa-descricao"
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="O que precisa acontecer nesta etapa"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="etapa-ordem">Ordem</Label>
                <Input
                  id="etapa-ordem"
                  type="number"
                  min={1}
                  value={form.ordem}
                  onChange={(event) => setForm((prev) => ({ ...prev, ordem: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="etapa-ativo">Situação</Label>
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    id="etapa-ativo"
                    checked={form.ativo}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ativo: checked }))}
                  />
                  <span className="text-sm text-slate-600">{form.ativo ? 'Ativa' : 'Inativa'}</span>
                </div>
              </div>
            </div>
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
