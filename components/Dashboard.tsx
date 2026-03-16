'use client';

import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Clock,
  CheckCircle
} from 'lucide-react';
import loadDashboardStatsAction from '@/actions/loadDashboardStats';
import loadKanbanColumnStatsAction from '@/actions/loadKanbanColumnStats';
import { useCurrency } from '@/hooks/use-currency';
import { SaldoContas } from '@/components/SaldoContas';

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

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { formatCurrency } = useCurrency();
  const [statsData, statsLoading, statsError] = useLoadAction(loadDashboardStatsAction, [{}]);
  const [kanbanData, kanbanLoading, kanbanError] = useLoadAction(loadKanbanColumnStatsAction, []);

  const stats: DashboardStats = statsData[0] || {
    total_users: 0,
    total_clientes: 0,
    total_empresas: 0,
    total_grupos: 0,
    total_fornecedores: 0,
    projetos_em_andamento: 0,
    projetos_concluidos: 0,
    vgv_previsto: 0,
    total_orcamentos_value: 0,
  };

  const kanbanColumns: KanbanColumnStats[] = kanbanData || [];



  const statsSkeleton = (
    <div className="animate-pulse flex items-center gap-4">
      <div className="p-2 bg-gray-200 rounded-lg w-10 h-10" />
      <div>
        <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-7 bg-gray-200 rounded w-12" />
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={!statsLoading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!statsLoading ? () => onNavigate('projetos') : undefined}>
          <CardContent className="p-6">
            {statsLoading ? statsSkeleton : (
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

        <Card className={!statsLoading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!statsLoading ? () => onNavigate('projetos') : undefined}>
          <CardContent className="p-6">
            {statsLoading ? statsSkeleton : (
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

        <Card className={!statsLoading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!statsLoading ? () => onNavigate('clientes') : undefined}>
          <CardContent className="p-6">
            {statsLoading ? statsSkeleton : (
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

        <Card className={!statsLoading ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={!statsLoading ? () => onNavigate('empresas') : undefined}>
          <CardContent className="p-6">
            {statsLoading ? statsSkeleton : (
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
            {statsLoading ? statsSkeleton : (
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
            {statsLoading ? statsSkeleton : (
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
            {statsLoading ? statsSkeleton : (
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
        {/* Saldo Contas */}
        <SaldoContas />

        {/* Colunas do Painel Kanban */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Painel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kanbanLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-6 bg-gray-200 rounded w-8"></div>
                  </div>
                ))}
              </div>
            ) : kanbanColumns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma coluna encontrada.
              </p>
            ) : (
              <div className="space-y-3">
                {kanbanColumns.map((column) => (
                  <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: column.color || '#6B7280' }}
                      ></div>
                      <span className="font-medium">{column.name}</span>
                    </div>
                    <Badge variant="secondary" className="font-semibold">
                      {column.projeto_count}
                    </Badge>
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
