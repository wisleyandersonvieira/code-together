'use client';

import { useEffect, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { numeroSql, percentuaisInteiros } from '@/lib/numeroSql';
import { iconeDaColuna } from '@/lib/kanbanIcons';
import {
  ArrowRight,
  Building,
  Building2,
  CheckCircle,
  ChevronRight,
  DollarSign,
  Home,
  Info,
  LayoutGrid,
  MoreHorizontal,
  RefreshCw,
  Truck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import loadDashboardDataAction from '@/actions/loadDashboardData';

/* ── Escala do dashboard ──────────────────────────────────────────────────
   Ritmo unico: gap-4 entre cards, gap-6 entre blocos, p-5 dentro do card.
   Todo numero recebe tabular-nums para as colunas de valores alinharem.    */
const KPI_CARD = 'flex min-h-[104px] flex-col justify-between p-5';
const KPI_LABEL = 'text-[13px] font-medium text-muted-foreground';
const KPI_VALUE = 'text-2xl font-semibold tracking-tight tabular-nums';
const KPI_ICON = 'h-4 w-4';
const KPI_INTERACTIVE =
  'text-left transition-all hover:border-foreground/20 hover:shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const LIST_ROW = '-mx-2 rounded-md px-2 py-3 transition-colors hover:bg-muted/50';
const CARD_PAD = 'p-5';
/** Cor de coluna ausente: o neutro do tema, que muda junto no modo escuro. */
const COR_NEUTRA = 'hsl(var(--muted-foreground))';

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

interface Metricas {
  projetos_novos_mes: number;
  clientes_novos_mes: number;
}

interface PontoVgv {
  /** Primeiro dia do mês, ISO. */
  mes: string;
  vgv: number | string;
}

interface KanbanColumnStats {
  id: number;
  name: string;
  position: number;
  color: string;
  /** Nome lucide-react. NULL = ícone padrão. Ver lib/kanbanIcons.ts. */
  icon: string | null;
  projeto_count: number;
}

interface ContaDestaque {
  id: number;
  nome: string;
  banco: string;
  numero: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  /** NULL quando a conta não tem nenhum movimento que entrou no saldo. */
  ultima_movimentacao: string | null;
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
  metricas: null,
  vgv_serie: [],
  kanban: [],
  contas_destaque: [],
  parametros: [],
};

/**
 * Paleta dos avatares de conta. Classes escritas por extenso de propósito: o
 * Tailwind varre o código-fonte, então classe montada por template não existe
 * no CSS final.
 */
const CLASSES_AVATAR = [
  'bg-avatar-1/15 text-avatar-1',
  'bg-avatar-2/15 text-avatar-2',
  'bg-avatar-3/15 text-avatar-3',
  'bg-avatar-4/15 text-avatar-4',
  'bg-avatar-5/15 text-avatar-5',
  'bg-avatar-6/15 text-avatar-6',
  'bg-avatar-7/15 text-avatar-7',
  'bg-avatar-8/15 text-avatar-8',
];

/**
 * Hash estável do nome → índice na paleta. Depende só do próprio nome, então
 * renomear uma conta não troca a cor das outras.
 */
function corDoAvatar(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return CLASSES_AVATAR[Math.abs(h) % CLASSES_AVATAR.length];
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa'. Sem `new Date()`: evita deslocar por fuso. */
function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

interface StatCardProps {
  icon: LucideIcon;
  /** Cor só quando ela significa algo; caso contrário o ícone fica neutro. */
  iconClassName?: string;
  label: string;
  value: string;
  /** Só é renderizado quando existe dado — nunca placeholder decorativo. */
  sublabel?: string | null;
  onClick?: () => void;
  ariaLabel?: string;
}

function StatCard({ icon: Icon, iconClassName, label, value, sublabel, onClick, ariaLabel }: StatCardProps) {
  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className={cn(KPI_ICON, iconClassName ?? 'text-muted-foreground')} />
        </span>
        <p className={KPI_LABEL}>{label}</p>
      </div>
      <div>
        <p className={KPI_VALUE}>{value}</p>
        {sublabel ? <p className="text-xs text-muted-foreground">{sublabel}</p> : null}
      </div>
    </>
  );

  // <button> de verdade: com div + role o card não recebe foco de teclado em
  // todos os navegadores e o Enter depende de handler manual.
  if (onClick) {
    return (
      <Card asChild>
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(KPI_CARD, KPI_INTERACTIVE)}>
          {conteudo}
        </button>
      </Card>
    );
  }
  return <Card className={KPI_CARD}>{conteudo}</Card>;
}

/** Mesma estrutura, alturas e paddings do card final — sem layout shift. */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(KPI_CARD, 'animate-pulse', className)}>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div>
        <div className="h-7 w-16 rounded bg-muted" />
      </div>
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

/**
 * Sparkline da série de VGV. SVG à mão: uma polyline normalizada entre o mínimo
 * e o máximo da própria série. `preserveAspectRatio="none"` estica na largura e
 * `vector-effect` mantém a espessura do traço apesar do estiramento.
 */
function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min;
  const pontos = valores
    .map((v, i) => {
      const x = (i / (valores.length - 1)) * 100;
      // 2..26 em vez de 0..28: o traço tem espessura e seria cortado nas bordas.
      const y = amplitude === 0 ? 14 : 26 - ((v - min) / amplitude) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline
        points={pontos}
        fill="none"
        stroke="hsl(var(--highlight-accent))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface FatiaDonut {
  id: number;
  nome: string;
  cor: string;
  quantidade: number;
  percentual: number;
}

/**
 * Donut em SVG puro: um <circle> por fatia, com o arco desenhado pelo
 * stroke-dasharray e posicionado pelo stroke-dashoffset. O +25 no offset gira o
 * início para o topo (o círculo começa às 3h).
 */
function Donut({ fatias, total }: { fatias: FatiaDonut[]; total: number }) {
  let acumulado = 0;
  return (
    <div className="relative h-[168px] w-[168px] shrink-0">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-0">
        <circle
          cx="21" cy="21" r="15.9155" fill="none"
          stroke="hsl(var(--muted))" strokeWidth="5"
        />
        {fatias.map((fatia) => {
          const offset = 100 - acumulado + 25;
          acumulado += fatia.percentual;
          return (
            <circle
              key={fatia.id}
              cx="21" cy="21" r="15.9155" fill="none"
              stroke={fatia.cor}
              strokeWidth="5"
              strokeDasharray={`${fatia.percentual} ${100 - fatia.percentual}`}
              strokeDashoffset={offset}
            >
              <title>{`${fatia.nome}: ${fatia.quantidade}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Total de projetos</span>
        <span
          className="text-3xl font-semibold tabular-nums"
          title="Soma dos projetos em todas as colunas do quadro, inclusive os já concluídos que permaneceram no Painel. Pode divergir de “Projetos em Andamento”, que conta por status."
        >
          {total}
        </span>
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [rawData, loading, , recarregar] = useLoadAction(loadDashboardDataAction, [{ data: defaultData }]);
  const data = rawData?.[0]?.data || defaultData;

  // Momento em que os dados na tela chegaram — é o que o rodapé do Painel data.
  const [carregadoEm, setCarregadoEm] = useState<Date | null>(null);
  useEffect(() => {
    if (!loading) setCarregadoEm(new Date());
  }, [loading, rawData]);

  const stats: DashboardStats = data.stats || defaultData.stats;
  const metricas: Metricas | null = data.metricas ?? null;
  const serieVgv: PontoVgv[] = data.vgv_serie || [];
  const kanbanColumns: KanbanColumnStats[] = data.kanban || [];
  const contas: ContaDestaque[] = data.contas_destaque || [];
  const parametros = data.parametros || [];

  // Derive currency from parametros directly (no extra query)
  const moedaParam = parametros.find((p: { chave?: string; valor?: string }) => p.chave === 'MOEDA');
  const currency = moedaParam?.valor === 'BRL' ? 'BRL' : 'USD';
  const formatCurrency = (value: unknown) => {
    const num = numeroSql(value);
    if (currency === 'BRL') {
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const totalSaldo = contas.reduce((total, conta) => total + numeroSql(conta.saldo_atual), 0);

  // ── Série do VGV ────────────────────────────────────────────────────────
  const valoresVgv = serieVgv.map((p) => numeroSql(p.vgv));
  const ultimoVgv = valoresVgv[valoresVgv.length - 1];
  const penultimoVgv = valoresVgv[valoresVgv.length - 2];
  // Sem dois pontos ou com base zero não há variação a calcular — e um número
  // inventado aqui teria exatamente a cara de um número real.
  const variacaoVgv =
    valoresVgv.length >= 2 && penultimoVgv > 0
      ? ((ultimoVgv - penultimoVgv) / penultimoVgv) * 100
      : null;

  // ── Painel de etapas ────────────────────────────────────────────────────
  const contagens = kanbanColumns.map((c) => numeroSql(c.projeto_count));
  const totalProjetosNoQuadro = contagens.reduce((a, v) => a + v, 0);
  const percentuais = percentuaisInteiros(contagens);
  const maiorProjetoCount = contagens.reduce((maior, v) => Math.max(maior, v), 0);
  const fatias: FatiaDonut[] = kanbanColumns
    .map((column, i) => ({
      id: column.id,
      nome: column.name,
      // Coluna sem cor cadastrada cai no neutro do TEMA, não num cinza fixo:
      // um hex cravado aqui ficaria errado no modo escuro.
      cor: column.color || COR_NEUTRA,
      quantidade: contagens[i],
      percentual: percentuais[i],
    }))
    // Coluna zerada não vira arco (um dasharray de 0 desenharia um ponto),
    // mas continua na lista abaixo.
    .filter((f) => f.quantidade > 0);

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const contasComRolagem = contas.length > 6;

  // TODO: o Painel Kanban ainda não aceita filtro por coluna (<Kanban /> não
  // recebe props). Quando aceitar, passar o id da coluna aqui.
  const irParaKanban = () => onNavigate('kanban');

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{hoje}</p>
      </header>

      <div className="grid gap-6">
        {/* ── Faixa de indicadores ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            <>
              <Card className={cn(KPI_CARD, 'col-span-2 animate-pulse bg-highlight xl:col-span-2')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="h-3 w-24 rounded bg-highlight-foreground/10" />
                  <div className="h-9 w-9 rounded-full bg-highlight-foreground/10" />
                </div>
                <div className="h-8 w-44 rounded bg-highlight-foreground/10" />
              </Card>
              {[...Array(6)].map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </>
          ) : (
            <>
              {/* VGV Previsto — card destaque escuro */}
              <Card className={cn(KPI_CARD, 'col-span-2 border-transparent bg-highlight text-highlight-foreground xl:col-span-2')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-highlight-foreground/70">VGV Previsto</span>
                    {/* O title vai no <span>, não no <svg>: tooltip em elemento
                        SVG não é confiável entre navegadores. */}
                    <span
                      title="Soma do valor de venda previsto (predicted_sale_value) dos projetos com status “Em andamento”."
                      className="inline-flex"
                    >
                      <Info className="h-3.5 w-3.5 text-highlight-foreground/50" aria-hidden="true" />
                      <span className="sr-only">
                        Soma do valor de venda previsto dos projetos em andamento.
                      </span>
                    </span>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight-foreground/10">
                    <DollarSign className="h-4 w-4" />
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {formatCurrency(stats.vgv_previsto)}
                  </p>
                  {valoresVgv.length >= 2 && (
                    <div className="mt-2">
                      <Sparkline valores={valoresVgv} />
                    </div>
                  )}
                  {variacaoVgv !== null && (
                    <p className="mt-1 text-xs tabular-nums">
                      <span className={variacaoVgv >= 0 ? 'text-success' : 'text-danger'}>
                        {variacaoVgv >= 0 ? '+' : ''}{variacaoVgv.toFixed(1)}%
                      </span>
                      <span className="text-highlight-foreground/60">
                        {' '}vs mês anterior · projetos cadastrados
                      </span>
                    </p>
                  )}
                </div>
              </Card>

              <StatCard
                icon={Home}
                iconClassName="text-brand"
                label="Projetos em Andamento"
                value={String(stats.projetos_em_andamento)}
                sublabel={
                  metricas && numeroSql(metricas.projetos_novos_mes) > 0
                    ? `${numeroSql(metricas.projetos_novos_mes)} novos este mês`
                    : null
                }
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
                sublabel={
                  metricas && numeroSql(metricas.clientes_novos_mes) > 0
                    ? `+${numeroSql(metricas.clientes_novos_mes)} novos este mês`
                    : null
                }
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
              <StatCard
                icon={Building2}
                label="Grupos"
                value={String(stats.total_grupos)}
                onClick={() => onNavigate('grupos')}
                ariaLabel={`Grupos: ${stats.total_grupos}. Abrir grupos.`}
              />
              <StatCard
                icon={Truck}
                label="Fornecedores"
                value={String(stats.total_fornecedores)}
                onClick={() => onNavigate('fornecedores')}
                ariaLabel={`Fornecedores: ${stats.total_fornecedores}. Abrir fornecedores.`}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Saldo em contas ────────────────────────────────────────── */}
          <Card className="flex flex-col">
            <CardHeader className={cn(CARD_PAD, 'pb-3')}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle size="section">Saldo em contas</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="-mr-2 h-7 w-7 p-0" aria-label="Ações de saldo em contas">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onNavigate('contas')}>
                      Ver todas as contas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!loading && contas.length > 0 && (
                <div className="mt-1 flex items-baseline justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
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
            <CardContent className={cn(CARD_PAD, 'flex flex-1 flex-col pt-0')}>
              {loading ? (
                <div className="divide-y divide-border">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex animate-pulse items-center justify-between gap-4 px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted" />
                        <div>
                          <div className="mb-1.5 h-4 w-28 rounded bg-muted" />
                          <div className="h-3 w-40 rounded bg-muted" />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-5 w-24 rounded bg-muted" />
                        <div className="h-3 w-24 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : contas.length === 0 ? (
                <EmptyState icon={Wallet} message="Nenhuma conta marcada como destaque encontrada." />
              ) : (
                <>
                  <div
                    className={cn(
                      'divide-y divide-border',
                      contasComRolagem && 'max-h-[380px] overflow-y-auto',
                    )}
                  >
                    {contas.map((conta) => {
                      const saldoAtual = numeroSql(conta.saldo_atual);
                      const ultimaMov = dataCurta(conta.ultima_movimentacao);
                      const nome = conta.nome || '—';
                      return (
                        <div key={conta.id} className={cn(LIST_ROW, 'flex items-center justify-between gap-4')}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                corDoAvatar(nome),
                              )}
                              aria-hidden="true"
                            >
                              {nome.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{nome}</p>
                              <p className="truncate text-xs tabular-nums text-muted-foreground">
                                Conta {conta.numero} · {conta.banco}
                              </p>
                            </div>
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
                            <div className="text-xs tabular-nums text-muted-foreground">
                              {ultimaMov ? `Última mov. ${ultimaMov}` : 'Sem movimentação'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-1">
                    <Button variant="outline" size="sm" onClick={() => onNavigate('contas')}>
                      Ver todas as contas
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Painel de etapas ───────────────────────────────────────── */}
          <Card className="flex flex-col">
            <CardHeader className={cn(CARD_PAD, 'pb-3')}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle size="section">Painel de etapas</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="-mr-2 h-7 w-7 p-0" aria-label="Ações do painel de etapas">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={irParaKanban}>
                      Ir para o Painel Kanban
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className={cn(CARD_PAD, 'flex flex-1 flex-col pt-0')}>
              {loading ? (
                <div className="flex animate-pulse flex-col gap-4 md:flex-row md:items-center">
                  <div className="h-[168px] w-[168px] shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 divide-y divide-border">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="px-2 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-muted" />
                            <div className="h-4 w-28 rounded bg-muted" />
                          </div>
                          <div className="h-4 w-8 rounded bg-muted" />
                        </div>
                        <div className="mt-2 h-[3px] w-full rounded-full bg-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : kanbanColumns.length === 0 ? (
                <EmptyState icon={LayoutGrid} message="Nenhuma coluna encontrada." />
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <Donut fatias={fatias} total={totalProjetosNoQuadro} />

                    <div className="min-w-0 flex-1 divide-y divide-border">
                      {kanbanColumns.map((column, i) => {
                        // Sem cor: o quadrado e o ícone usam classes de token
                        // em vez de style inline, para o tema escuro funcionar.
                        const cor = column.color || null;
                        const Icone = iconeDaColuna(column.icon);
                        const quantidade = contagens[i];
                        const proporcao = maiorProjetoCount > 0 ? (quantidade / maiorProjetoCount) * 100 : 0;
                        return (
                          <button
                            key={column.id}
                            type="button"
                            onClick={irParaKanban}
                            aria-label={`${column.name}: ${quantidade} projeto(s). Abrir o Painel Kanban.`}
                            className={cn(
                              LIST_ROW,
                              'block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                    !cor && 'bg-muted',
                                  )}
                                  style={cor ? { backgroundColor: `${cor}1F` } : undefined}
                                >
                                  <Icone
                                    className={cn('h-4 w-4', !cor && 'text-muted-foreground')}
                                    style={cor ? { color: cor } : undefined}
                                  />
                                </span>
                                <span className="truncate text-sm font-medium">{column.name}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <div className="text-right">
                                  <div className="text-sm font-semibold tabular-nums">{quantidade}</div>
                                  <div className="text-xs tabular-nums text-muted-foreground">
                                    {percentuais[i]}%
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn('h-full rounded-full', !cor && 'bg-muted-foreground')}
                                style={{
                                  width: `${proporcao}%`,
                                  ...(cor ? { backgroundColor: cor } : {}),
                                  opacity: 0.55,
                                }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {carregadoEm && (
                        <span>
                          Atualizado {formatDistanceToNow(carregadoEm, { locale: ptBR, addSuffix: true })}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => recarregar()}
                        disabled={loading}
                        aria-label="Recarregar os dados do dashboard"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onNavigate('projetos')}>
                      Ver todos os projetos
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
