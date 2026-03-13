import { action } from '@uibakery/data';

function loadDashboardStats() {
  return action('loadDashboardStats', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM clientes) as total_clientes,
        (SELECT COUNT(*) FROM empresas) as total_empresas,
        (SELECT COUNT(*) FROM grupos) as total_grupos,
        (SELECT COUNT(*) FROM fornecedores) as total_fornecedores,
        (SELECT COUNT(*) FROM projetos WHERE status = 'Em andamento') as projetos_em_andamento,
        (SELECT COUNT(*) FROM projetos WHERE status = 'Concluído') as projetos_concluidos,
        (SELECT COALESCE(SUM(predicted_sale_value), 0) FROM projetos WHERE predicted_sale_value IS NOT NULL AND status = 'Em andamento') as vgv_previsto,
        (SELECT COALESCE(SUM(value), 0) FROM orcamentos) as total_orcamentos_value;
    `,
  });
}

export default loadDashboardStats;
