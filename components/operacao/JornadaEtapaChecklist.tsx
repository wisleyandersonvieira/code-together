'use client';

import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Plus, Trash2 } from 'lucide-react';

import deleteJornadaItemChecklistAction from '@/actions/deleteJornadaItemChecklist';
import saveJornadaItemChecklistAction from '@/actions/saveJornadaItemChecklist';
import toggleJornadaChecklistAction from '@/actions/toggleJornadaChecklist';
import { FinanceActionButton } from '@/components/finance/listing-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import { encodeSqlJsonPayload } from '@/utils/sql-payload';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  id: number;
  descricao: string;
  ordem: number;
  obrigatorio: boolean;
  concluido: boolean;
  concluido_em?: string | null;
  concluido_por?: string | null;
  avulso?: boolean;
}

interface JornadaEtapaChecklistProps {
  itemId: number;
  checklist: ChecklistItem[];
  readOnly?: boolean;
  onChange: () => void;
}

export function JornadaEtapaChecklist({ itemId, checklist, readOnly = false, onChange }: JornadaEtapaChecklistProps) {
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const [toggleChecklist] = useMutateAction(toggleJornadaChecklistAction);
  const [saveChecklistItem] = useMutateAction(saveJornadaItemChecklistAction);
  const [deleteChecklistItem] = useMutateAction(deleteJornadaItemChecklistAction);

  const [novoItem, setNovoItem] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pendentesObrigatorios = checklist.filter((item) => item.obrigatorio && !item.concluido).length;

  const handleToggle = async (item: ChecklistItem, checked: boolean) => {
    try {
      setBusyId(item.id);
      await toggleChecklist({
        id: item.id,
        concluido: checked,
        userId: currentUser?.legacy_user_id || null,
      });
      onChange();
    } catch (err: any) {
      toast({
        title: 'Erro no checklist',
        description: err?.message || 'Não foi possível atualizar o item.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    const descricao = novoItem.trim();
    if (!descricao) return;

    setIsAdding(true);
    try {
      await saveChecklistItem({
        payload: encodeSqlJsonPayload({ item_id: itemId, descricao, obrigatorio: true }),
      });
      setNovoItem('');
      onChange();
    } catch (err: any) {
      toast({
        title: 'Erro ao adicionar item',
        description: err?.message || 'Não foi possível adicionar o item.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (item: ChecklistItem) => {
    try {
      setBusyId(item.id);
      await deleteChecklistItem({ id: item.id });
      onChange();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir item',
        description: err?.message || 'Não foi possível excluir o item.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</span>
        {pendentesObrigatorios > 0 ? (
          <span className="text-[11px] font-semibold text-amber-700">
            {pendentesObrigatorios} obrigatório{pendentesObrigatorios > 1 ? 's' : ''} em aberto
          </span>
        ) : checklist.length > 0 ? (
          <span className="text-[11px] font-semibold text-emerald-700">Checklist completo</span>
        ) : null}
      </div>

      {checklist.length === 0 ? (
        <p className="text-xs text-slate-400">
          Nenhum item. O checklist modelo é definido em Operação &gt; Fluxos e Etapas.
        </p>
      ) : (
        <div className="space-y-1">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <Checkbox
                  checked={item.concluido}
                  disabled={readOnly || busyId === item.id}
                  onCheckedChange={(checked) => handleToggle(item, checked === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm',
                      item.concluido ? 'text-slate-400 line-through' : 'text-slate-700',
                    )}
                  >
                    {item.descricao}
                    {item.obrigatorio ? <span className="ml-1 text-rose-500">*</span> : null}
                  </span>
                  {item.concluido && item.concluido_por ? (
                    <span className="block text-[11px] text-slate-400">por {item.concluido_por}</span>
                  ) : null}
                </span>
              </label>

              {!readOnly && item.avulso ? (
                <FinanceActionButton
                  icon={Trash2}
                  title="Remover item avulso"
                  onClick={() => handleDelete(item)}
                  tone="danger"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="flex gap-2">
          <Input
            value={novoItem}
            onChange={(event) => setNovoItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Adicionar item só deste cliente"
            className="h-9 rounded-xl border-slate-200 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={isAdding || !novoItem.trim()}
            className="h-9 shrink-0 rounded-xl border-slate-200 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
