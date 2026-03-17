'use client';

import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserCheck, 
  Building, 
  Building2, 
  Truck, 
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle
} from 'lucide-react';
import loadDashboardDataAction from '@/actions/loadDashboardData';

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

  const statsSkeleton = (
    <div className="animate-pulse flex items-center gap-4">
      <div className="p-2 bg-muted rounded-lg w-10 h-10" />
      <div>
        <div className="h-3 bg-muted rounded w-24 mb-2" />
        <div className="h-7 bg-muted rounded w-12" />
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={!loading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!loading ? () => onNavigate('projetos') : undefined}>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Home className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Projetos em Andamento</p>
                  <p className="text-2xl font-bold">{stats.projetos_em_andamento}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={!loading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!loading ? () => onNavigate('projetos') : undefined}>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Projetos Concluídos</p>
                  <p className="text-2xl font-bold">{stats.projetos_concluidos}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={!loading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!loading ? () => onNavigate('clientes') : undefined}>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes</p>
                  <p className="text-2xl font-bold">{stats.total_clientes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={!loading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!loading ? () => onNavigate('empresas') : undefined}>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Building className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empresas</p>
                  <p className="text-2xl font-bold">{stats.total_empresas}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupos</p>
                  <p className="text-2xl font-bold">{stats.total_grupos}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Truck className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedores</p>
                  <p className="text-2xl font-bold">{stats.total_fornecedores}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {loading ? statsSkeleton : (
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">VGV Previsto</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.vgv_previsto)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saldo Contas - inline, no extra query */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Saldo Contas
            </CardTitle>
            {contas.length > 1 && !loading && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">Total Geral:</span>
                <span className={`font-bold text-lg ${totalSaldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalSaldo)}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-24 mb-1" />
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                ))}
              </div>
            ) : contas.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma conta marcada como destaque encontrada.
              </p>
            ) : (
              <div className="space-y-3">
                {contas.map((conta) => {
                  const saldoAtual = conta.saldo_atual != null ? parseFloat(conta.saldo_atual.toString()) : 0;
                  const saldoInicial = conta.saldo_inicial != null ? parseFloat(conta.saldo_inicial.toString()) : 0;
                  const variacao = saldoAtual - saldoInicial;
                  return (
                    <div key={conta.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{conta.nome}</span>
                          <Badge variant="outline" className="text-xs">{conta.banco}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Conta: {conta.numero}</span>
                          {variacao !== 0 && (
                            <span className="flex items-center gap-1">
                              {variacao > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                              <span className={`text-xs ${variacao > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {variacao > 0 ? '+' : ''}{formatCurrency(Math.abs(variacao))}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(saldoAtual)}
                        </div>
                        {saldoInicial !== saldoAtual && (
                          <div className="text-xs text-muted-foreground">Base: {formatCurrency(saldoInicial)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colunas do Painel Kanban */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Painel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="h-6 bg-muted rounded w-8" />
                  </div>
                ))}
              </div>
            ) : kanbanColumns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma coluna encontrada.</p>
            ) : (
              <div className="space-y-3">
                {kanbanColumns.map((column) => (
                  <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: column.color || '#6B7280' }} />
                      <span className="font-medium">{column.name}</span>
                    </div>
                    <Badge variant="secondary" className="font-semibold">{column.projeto_count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
