import { action } from '@uibakery/data';

function loadRelatorioProjetoDespesasPorGrupo() {
  return action('loadRelatorioProjetoDespesasPorGrupo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        f.name as grupo_nome,
        'Despesa' as grupo_tipo,
        SUM(cpi.valor_total) as valor_total
      FROM contas_pagar cp
      INNER JOIN contas_pagar_itens cpi ON cp.id = cpi.conta_pagar_id
      INNER JOIN fornecedores f ON cp.fornecedor_id = f.id
      LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
      WHERE 
        ({{params.projetoId}} IS NULL OR cpp.projeto_id = {{params.projetoId}})
      GROUP BY f.id, f.name
      ORDER BY SUM(cpi.valor_total) DESC;
    `,
  });
}

export default loadRelatorioProjetoDespesasPorGrupo;
