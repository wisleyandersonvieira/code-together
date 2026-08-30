'use client';

import type { KeyboardEvent } from 'react';
import { useLoadAction } from '@uibakery/data';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  UserCheck,
  Building,
  Building2,
  Truck,
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Wallet,
  LayoutGrid,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import loadDashboardDataAction from '@/actions/loadDashboardData';

/* ── Escala do dashboard ──────────────────────────────────────────────────
   Ritmo unico: gap-4 entre cards, gap-6 entre blocos, p-5 dentro do card.
   Todo numero recebe tabular-nums para as colunas de valores alinharem.    */
const KPI_CARD = 'flex min-h-[104px] flex-col justify-between p-5';
const KPI_LABEL = 'text-[13px] font-medium text-muted-foreground';
const KPI_VALUE = 'text-2xl font-semibold tracking-tight tabular-nums md:text-3xl';
const KPI_ICON = 'h-4 w-4';
const KPI_INTERACTIVE =
  'cursor-pointer transition-all hover:border-foreground/20 hover:shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const LIST_ROW = '-mx-2 rounded-md px-2 py-3 transition-colors hover:bg-muted/50';
const CARD_PAD = 'p-5';

interface DashboardStats {
  total_users: number;
  total_clientes: number;
  total_empresas: number;
  total_grupos: number;
  total_fornecedores: number;
  projetos_em_andamento: number;
  projetos_concluidos: number;
  vgv_previsto: number;
  total_orcamentos_value: number;
}

interface KanbanColumnStats {
  id: number;
  name: string;
  position: number;
  color: string;
  projeto_count: number;
}

interface ContaDestaque {
  id: number;
  nome: string;
  banco: string;
  numero: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  saldo_atual: number;
}

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const defaultData = {
  stats: {
    total_users: 0, total_clientes: 0, total_empresas: 0, total_grupos: 0,
    total_fornecedores: 0, projetos_em_andamento: 0, projetos_concluidos: 0,
    vgv_previsto: 0, total_orcamentos_value: 0,
  },
  kanban: [],
  contas_destaque: [],
  parametros: [],
};

const activateOnKey = (action: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

interface StatCardProps {
  icon: LucideIcon;
  /** Cor só quando ela significa algo; caso contrário o ícone fica neutro. */
  iconClassName?: string;
  label: string;
  value: string;
  onClick?: () => void;
  ariaLabel?: string;
}

function StatCard({ icon: Icon, iconClassName, label, value, onClick, ariaLabel }: StatCardProps) {
  return (
    <Card
      className={cn(KPI_CARD, onClick && KPI_INTERACTIVE)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      onKeyDown={onClick ? activateOnKey(onClick) : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn(KPI_ICON, iconClassName ?? 'text-muted-foreground')} />
        <p className={KPI_LABEL}>{label}</p>
      </div>
      <p className={KPI_VALUE}>{value}</p>
    </Card>
  );
}

/** Mesma estrutura, alturas e paddings do card final — sem layout shift. */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(KPI_CARD, 'animate-pulse', className)}>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="h-8 w-16 rounded bg-muted md:h-9" />
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [rawData, loading] = useLoadAction(loadDashboardDataAction, [{ data: defaultData }]);
  const data = rawData?.[0]?.data || defaultData;

  const stats: DashboardStats = data.stats || defaultData.stats;
  const kanbanColumns: KanbanColumnStats[] = data.kanban || [];
  const contas: ContaDestaque[] = data.contas_destaque || [];
  const parametros = data.parametros || [];

  // Derive currency from parametros directly (no extra query)
  const moedaParam = parametros.find((p: any) => p.chave === 'MOEDA');
  const currency = moedaParam?.valor === 'BRL' ? 'BRL' : 'USD';
  const formatCurrency = (value: number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return currency === 'BRL' ? 'R$ 0,00' : '$0.00';
    if (currency === 'BRL') {
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalSaldo = contas.reduce((total, conta) => {
    const saldo = conta.saldo_atual != null ? parseFloat(conta.saldo_atual.toString()) : 0;
    return total + saldo;
  }, 0);

  // Escala da barra de proporção do Painel — só apresentação, nenhum dado novo.
  const maiorProjetoCount = kanbanColumns.reduce(
    (maior, column) => Math.max(maior, column.projeto_count || 0),
    0,
  );

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const contasComRolagem = contas.length > 6;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">{hoje}</p>
        </div>
        {/* slot para filtros/ações */}
      </header>

      <div className="grid gap-6">
        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            <>
              <Card className={cn(KPI_CARD, 'col-span-2 animate-pulse border-brand/20 bg-brand-muted')}>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-foreground/10" />
                  <div className="h-3 w-24 rounded bg-foreground/10" />
                </div>
                <div className="h-9 w-48 rounded bg-foreground/10 xl:h-10" />
              </Card>
              {[...Array(6)].map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </>
          ) : (
            <>
              {/* VGV Previsto — card destaque */}
              <Card className={cn(KPI_CARD, 'col-span-2 border-brand/20 bg-brand-muted xl:col-span-2')}>
                <div className="flex items-center gap-2">
                  <DollarSign className={cn(KPI_ICON, 'text-brand')} />
                  <p className="text-[13px] font-medium text-brand">VGV Previsto</p>
                </div>
                <p className="text-3xl font-semibold tracking-tight tabular-nums xl:text-4xl">
                  {formatCurrency(stats.vgv_previsto)}
                </p>
              </Card>

              <StatCard
                icon={Home}
                iconClassName="text-brand"
                label="Projetos em Andamento"
                value={String(stats.projetos_em_andamento)}
                onClick={() => onNavigate('projetos')}
                ariaLabel={`Projetos em andamento: ${stats.projetos_em_andamento}. Abrir projetos.`}
              />
              <StatCard
                icon={CheckCircle}
                iconClassName="text-success"
                label="Projetos Concluídos"
                value={String(stats.projetos_concluidos)}
                onClick={() => onNavigate('projetos')}
                ariaLabel={`Projetos concluídos: ${stats.projetos_concluidos}. Abrir projetos.`}
              />
              <StatCard
                icon={UserCheck}
                label="Clientes"
                value={String(stats.total_clientes)}
                onClick={() => onNavigate('clientes')}
                ariaLabel={`Clientes: ${stats.total_clientes}. Abrir clientes.`}
              />
              <StatCard
                icon={Building}
                label="Empresas"
                value={String(stats.total_empresas)}
                onClick={() => onNavigate('empresas')}
                ariaLabel={`Empresas: ${stats.total_empresas}. Abrir empresas.`}
              />
              <StatCard icon={Building2} label="Grupos" value={String(stats.total_grupos)} />
              <StatCard icon={Truck} label="Fornecedores" value={String(stats.total_fornecedores)} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Saldo Contas - inline, no extra query */}
          <Card>
            <CardHeader className={cn(CARD_PAD, 'pb-3')}>
              <CardTitle size="section">Saldo em contas</CardTitle>
              {contas.length > 1 && !loading && (
                <div className="flex items-baseline justify-between gap-4 pt-1">
                  <span className="text-sm text-muted-foreground">Total Geral</span>
                  <span
                    className={cn(
                      'text-2xl font-semibold tabular-nums',
                      totalSaldo < 0 ? 'text-danger' : 'text-foreground',
                    )}
                  >
                    {formatCurrency(totalSaldo)}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className={cn(CARD_PAD, 'pt-0')}>
              {loading ? (
                <div className="divide-y divide-border">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex animate-pulse items-start justify-between gap-4 px-2 py-3">
                      <div className="flex-1">
                        <div className="mb-1.5 h-4 w-28 rounded bg-muted" />
                        <div className="h-3 w-40 rounded bg-muted" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-5 w-24 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : contas.length === 0 ? (
                <EmptyState icon={Wallet} message="Nenhuma conta marcada como destaque encontrada." />
              ) : (
                <div className="relative">
                  <div
                    className={cn(
                      'divide-y divide-border',
                      contasComRolagem && 'max-h-[380px] overflow-y-auto',
                    )}
                  >
                    {contas.map((conta) => {
                      const saldoAtual = conta.saldo_atual != null ? parseFloat(conta.saldo_atual.toString()) : 0;
                      const saldoInicial = conta.saldo_inicial != null ? parseFloat(conta.saldo_inicial.toString()) : 0;
                      const variacao = saldoAtual - saldoInicial;
                      return (
                        <div key={conta.id} className={cn(LIST_ROW, 'flex items-start justify-between gap-4')}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{conta.nome}</p>
                            <p className="truncate text-xs tabular-nums text-muted-foreground">
                              Conta {conta.numero} · {conta.banco}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div
                              className={cn(
                                'text-base font-semibold tabular-nums',
                                saldoAtual > 0 && 'text-foreground',
                                saldoAtual < 0 && 'text-danger',
                                saldoAtual === 0 && 'text-muted-foreground',
                              )}
                            >
                              {formatCurrency(saldoAtual)}
                            </div>
                            {variacao !== 0 && (
                              <div
                                className={cn(
                                  'flex items-center justify-end gap-1 text-xs tabular-nums',
                                  variacao > 0 ? 'text-success' : 'text-danger',
                                )}
                              >
                                {variacao > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                <span>
                                  {variacao > 0 ? '+' : ''}{formatCurrency(Math.abs(variacao))}
                                </span>
                              </div>
                            )}
                            {saldoInicial !== saldoAtual && (
                              <div className="text-xs tabular-nums text-muted-foreground">
                                Base: {formatCurrency(saldoInicial)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {contasComRolagem && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Colunas do Painel Kanban */}
          <Card>
            <CardHeader className={cn(CARD_PAD, 'pb-3')}>
              <CardTitle size="section">Painel</CardTitle>
            </CardHeader>
            <CardContent className={cn(CARD_PAD, 'pt-0')}>
              {loading ? (
                <div className="divide-y divide-border">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse px-2 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
                          <div className="h-4 w-28 rounded bg-muted" />
                        </div>
                        <div className="h-4 w-6 rounded bg-muted" />
                      </div>
                      <div className="mt-2 h-[3px] w-full rounded-full bg-muted" />
                    </div>
                  ))}
                </div>
              ) : kanbanColumns.length === 0 ? (
                <EmptyState icon={LayoutGrid} message="Nenhuma coluna encontrada." />
              ) : (
                <div className="divide-y divide-border">
                  {kanbanColumns.map((column) => {
                    const cor = column.color || '#6B7280';
                    const proporcao = maiorProjetoCount > 0
                      ? ((column.projeto_count || 0) / maiorProjetoCount) * 100
                      : 0;
                    return (
                      <div key={column.id} className={LIST_ROW}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cor }}
                            />
                            <span className="truncate text-sm font-medium">{column.name}</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {column.projeto_count}
                          </span>
                        </div>
                        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${proporcao}%`, backgroundColor: cor, opacity: 0.55 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
