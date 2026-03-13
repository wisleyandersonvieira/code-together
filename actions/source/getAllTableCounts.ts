import { action } from '@uibakery/data';

function getAllTableCounts() {
  return action('getAllTableCounts', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        'users' as table_name,
        (SELECT COUNT(*) FROM users) as record_count
      UNION ALL SELECT 'app_users', (SELECT COUNT(*) FROM app_users)
      UNION ALL SELECT 'clientes', (SELECT COUNT(*) FROM clientes)  
      UNION ALL SELECT 'empresas', (SELECT COUNT(*) FROM empresas)
      UNION ALL SELECT 'grupos', (SELECT COUNT(*) FROM grupos)
      UNION ALL SELECT 'fornecedores', (SELECT COUNT(*) FROM fornecedores)
      UNION ALL SELECT 'contas', (SELECT COUNT(*) FROM contas)
      UNION ALL SELECT 'grupos_contabeis', (SELECT COUNT(*) FROM grupos_contabeis)
      UNION ALL SELECT 'subgrupos_contabeis', (SELECT COUNT(*) FROM subgrupos_contabeis)
      UNION ALL SELECT 'produtos', (SELECT COUNT(*) FROM produtos)
      UNION ALL SELECT 'tipos_documento', (SELECT COUNT(*) FROM tipos_documento)
      UNION ALL SELECT 'parametros', (SELECT COUNT(*) FROM parametros)
      UNION ALL SELECT 'projetos', (SELECT COUNT(*) FROM projetos)
      UNION ALL SELECT 'kanban_columns', (SELECT COUNT(*) FROM kanban_columns)
      UNION ALL SELECT 'empresa_clientes', (SELECT COUNT(*) FROM empresa_clientes)
      UNION ALL SELECT 'grupo_members', (SELECT COUNT(*) FROM grupo_members)
      UNION ALL SELECT 'projeto_members', (SELECT COUNT(*) FROM projeto_members)
      UNION ALL SELECT 'contas_pagar', (SELECT COUNT(*) FROM contas_pagar)
      UNION ALL SELECT 'contas_receber', (SELECT COUNT(*) FROM contas_receber)
      UNION ALL SELECT 'titulos_pagar', (SELECT COUNT(*) FROM titulos_pagar)
      UNION ALL SELECT 'titulos_receber', (SELECT COUNT(*) FROM titulos_receber)
      UNION ALL SELECT 'socios', (SELECT COUNT(*) FROM socios)
      UNION ALL SELECT 'matrizes', (SELECT COUNT(*) FROM matrizes)
      UNION ALL SELECT 'matriz_socios', (SELECT COUNT(*) FROM matriz_socios)
      UNION ALL SELECT 'aportes', (SELECT COUNT(*) FROM aportes)
      UNION ALL SELECT 'retiradas', (SELECT COUNT(*) FROM retiradas)
      UNION ALL SELECT 'estruturas_dre', (SELECT COUNT(*) FROM estruturas_dre)
      UNION ALL SELECT 'estruturas_dre_itens', (SELECT COUNT(*) FROM estruturas_dre_itens)
      UNION ALL SELECT 'estruturas_dre_soma_itens', (SELECT COUNT(*) FROM estruturas_dre_soma_itens)
      UNION ALL SELECT 'transferencias', (SELECT COUNT(*) FROM transferencias)
      UNION ALL SELECT 'contas_pagar_itens', (SELECT COUNT(*) FROM contas_pagar_itens)
      UNION ALL SELECT 'contas_receber_itens', (SELECT COUNT(*) FROM contas_receber_itens)
      UNION ALL SELECT 'files', (SELECT COUNT(*) FROM files)
      ORDER BY table_name;
    `,
  });
}

export default getAllTableCounts;
