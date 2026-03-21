import { action } from '@uibakery/data';

function loadAuditoriaFornecedoresReport() {
  return action('loadAuditoriaFornecedoresReport', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        COALESCE(p.name, 'Sem projeto') AS projeto_nome,
        fs.nome_razao_social AS fornecedor_nome,
        COUNT(DISTINCT a.id) AS total_auditorias,
        COUNT(i.id) AS total_itens,
        COALESCE(SUM(i.valor_total), 0) AS valor_total,
        COALESCE(SUM(i.valor_pago), 0) AS valor_pago,
        COALESCE(SUM(i.valor_a_pagar), 0) AS valor_a_pagar
      FROM auditoria_fornecedor_itens i
      JOIN auditorias_fornecedores a ON a.id = i.auditoria_id
      JOIN fornecedores_subcontratados fs ON fs.id = i.fornecedor_subcontratado_id
      LEFT JOIN projetos p ON p.id = i.projeto_id
      WHERE 1 = 1
        {{ params && params.dataInicial ? "AND a.data_auditoria >= '" + params.dataInicial + "'" : "" }}
        {{ params && params.dataFinal ? "AND a.data_auditoria <= '" + params.dataFinal + "'" : "" }}
        {{ params && params.status && params.status !== 'all' ? "AND a.status = '" + params.status + "'" : "" }}
        {{ params && params.fornecedorId ? "AND i.fornecedor_subcontratado_id = " + params.fornecedorId : "" }}
        {{ params && params.projetoId ? "AND i.projeto_id = " + params.projetoId : "" }}
      GROUP BY COALESCE(p.name, 'Sem projeto'), fs.nome_razao_social
      ORDER BY projeto_nome ASC, fornecedor_nome ASC;
    `,
  });
}

export default loadAuditoriaFornecedoresReport;
