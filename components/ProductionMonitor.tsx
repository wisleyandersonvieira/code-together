import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Users, TrendingUp } from 'lucide-react';
import loadDashboardStats from '@/actions/loadDashboardStats';

export function ProductionMonitor() {
  const [stats, loading, error] = useLoadAction(loadDashboardStats, []);

  if (loading) return <div>Carregando métricas...</div>;
  if (error) return <div>Erro ao carregar métricas</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Usuários
              </p>
              <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Projetos Ativos
              </p>
              <p className="text-2xl font-bold">{stats?.totalProjetos || 0}</p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status Sistema
              </p>
              <Badge variant="default" className="bg-green-500">
                Online
              </Badge>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Banco de Dados
              </p>
              <Badge variant="default" className="bg-green-500">
                Conectado
              </Badge>
            </div>
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
