'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ImageIcon, Eye, Pencil, Trash2 } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import loadProjetosCardsAction from '@/actions/loadProjetosCards';
import getFileAction from '@/actions/getFile';
import { FinanceActionButton, FinanceStatusBadge } from '@/components/finance/listing-ui';

interface CardMember {
  cliente_name?: string;
  empresa_name?: string;
  grupo_name?: string;
  percentage: number;
}

interface ProjetoCardData {
  id: number;
  name: string;
  city?: string;
  status?: string;
  predicted_sale_value?: number;
  cover_file_id?: number | null;
  total_orcado?: number;
  total_realizado_orc?: number;
  total_previsto_aporte?: number;
  total_realizado_aporte?: number;
  pct_orcamento_realizado?: number;
  pct_aportes_realizado?: number;
  members: CardMember[];
}

interface ProjetoCardsProps {
  status: string;
  filterName: string;
  filterMember: string;
  reloadToken?: number;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}

type LoadFile = (params: { fileId: number }) => Promise<any[]>;

// Lazily loads a project's cover image: only fetches the binary once the card
// scrolls near the viewport, so a large grid doesn't fire dozens of getFile calls at once.
function ProjetoCardImage({
  fileId,
  projetoName,
  loadFile,
}: {
  fileId?: number | null;
  projetoName: string;
  loadFile: LoadFile;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const requestedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileId) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fileId]);

  useEffect(() => {
    // `requestedRef` (not state) guards the single fetch: putting a loading flag
    // in the deps array would re-run this effect and cancel the in-flight request.
    if (!visible || !fileId || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    loadFile({ fileId })
      .then((rows: any[]) => {
        if (cancelled) return;
        const f = rows?.[0];
        if (f?.file_data) {
          const data: string = f.file_data.startsWith('data:')
            ? f.file_data
            : `data:${f.content_type || 'image/jpeg'};base64,${f.file_data}`;
          setSrc(data);
        }
      })
      .catch((err) => {
        console.error('Error loading cover image:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fileId, loadFile]);


  // No cover set → neutral placeholder with the project name.
  if (!fileId) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
        <ImageIcon className="h-8 w-8" />
        <span className="px-4 text-center text-xs font-medium text-slate-500 line-clamp-2">{projetoName}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="h-40 w-full overflow-hidden bg-slate-100">
      {src ? (
        <img src={src} alt={projetoName} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
    </div>
  );
}

export function ProjetoCards({ status, filterName, filterMember, reloadToken, onView, onEdit, onDelete }: ProjetoCardsProps) {
  const { formatCurrency } = useCurrency();
  // `reloadToken` is not used by the SQL — it only changes the params so the query re-runs
  // after a mutation (create/edit/delete) performed by the parent.
  const [projetos, loading, error] = useLoadAction(loadProjetosCardsAction, [], { status, reloadToken });
  const [getFile] = useMutateAction(getFileAction);

  const filtered = useMemo(() => {
    const nameFilter = filterName.toLowerCase();
    const memberFilter = filterMember.toLowerCase();
    return (projetos as ProjetoCardData[]).filter((p) => {
      const matchName = !nameFilter || p.name.toLowerCase().includes(nameFilter);
      const matchMember =
        !memberFilter ||
        (p.members || []).some((m) =>
          (m.cliente_name || '').toLowerCase().includes(memberFilter) ||
          (m.empresa_name || '').toLowerCase().includes(memberFilter) ||
          (m.grupo_name || '').toLowerCase().includes(memberFilter)
        );
      return matchName && matchMember;
    });
  }, [projetos, filterName, filterMember]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-40 w-full animate-pulse bg-slate-200" />
            <CardContent className="space-y-3 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar projetos</div>
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Nenhum projeto encontrado para os filtros aplicados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((projeto) => {
        const pctOrc = Number(projeto.pct_orcamento_realizado) || 0;
        const pctApo = Number(projeto.pct_aportes_realizado) || 0;
        return (
          <Card key={projeto.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
            <ProjetoCardImage
              fileId={projeto.cover_file_id}
              projetoName={projeto.name}
              loadFile={getFile}
            />

            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight text-slate-900 line-clamp-2" title={projeto.name}>
                  {projeto.name}
                </h3>
                <FinanceStatusBadge
                  label={projeto.status || 'Em andamento'}
                  tone={projeto.status === 'Concluído' ? 'success' : 'warning'}
                />
              </div>

              <div className="text-sm text-slate-500">{projeto.city || 'Sem cidade'}</div>

              {(projeto.members || []).length > 0 && (
                <div className="space-y-0.5">
                  {projeto.members.slice(0, 3).map((member, idx) => (
                    <div key={idx} className="text-xs text-slate-600">
                      {member.cliente_name || member.empresa_name || member.grupo_name}
                      <span className="ml-1 text-slate-400">({member.percentage}%)</span>
                    </div>
                  ))}
                  {projeto.members.length > 3 && (
                    <div className="text-xs text-slate-400">+{projeto.members.length - 3} membro(s)</div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Valor previsto</span>
                <span className="font-medium text-slate-800">
                  {projeto.predicted_sale_value ? formatCurrency(projeto.predicted_sale_value) : '-'}
                </span>
              </div>

              <div className="mt-auto space-y-2 pt-1">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Orçamento realizado</span>
                    <span className="font-medium text-slate-700">{pctOrc.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(pctOrc, 100)} className="h-2" />
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {formatCurrency(Number(projeto.total_realizado_orc) || 0)} de {formatCurrency(Number(projeto.total_orcado) || 0)}
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Aportes realizados</span>
                    <span className="font-medium text-slate-700">{pctApo.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(pctApo, 100)} className="h-2" />
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {formatCurrency(Number(projeto.total_realizado_aporte) || 0)} de {formatCurrency(Number(projeto.total_previsto_aporte) || 0)}
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-3">
              <FinanceActionButton icon={Eye} title="Visualizar Projeto" onClick={() => onView(projeto.id)} />
              <FinanceActionButton icon={Pencil} title="Editar Projeto" onClick={() => onEdit(projeto.id)} tone="brand" />
              <FinanceActionButton
                icon={Trash2}
                title="Excluir Projeto"
                onClick={() => onDelete(projeto.id, projeto.name)}
                tone="danger"
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
