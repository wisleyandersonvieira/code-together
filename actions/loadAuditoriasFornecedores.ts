import { action } from '@uibakery/data';

function loadAuditoriasFornecedores() {
  return action('loadAuditoriasFornecedores', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        a.id,
        a.data_auditoria,
        a.status,
        a.quantidade_itens,
        a.valor_total,
        a.valor_pago,
        a.valor_a_pagar,
        a.created_at,
        a.updated_at,
        STRING_AGG(DISTINCT fs.nome_razao_social, ', ') AS fornecedores,
        STRING_AGG(DISTINCT p.name, ', ') AS projetos
      FROM auditorias_fornecedores a
      LEFT JOIN auditoria_fornecedor_itens i ON i.auditoria_id = a.id
      LEFT JOIN fornecedores_subcontratados fs ON fs.id = i.fornecedor_subcontratado_id
      LEFT JOIN projetos p ON p.id = i.projeto_id
      WHERE 1 = 1
        {{ params && params.dataInicial ? "AND a.data_auditoria >= '" + params.dataInicial + "'" : "" }}
        {{ params && params.dataFinal ? "AND a.data_auditoria <= '" + params.dataFinal + "'" : "" }}
        {{ params && params.status && params.status !== 'all' ? "AND a.status = '" + params.status + "'" : "" }}
        {{ params && params.fornecedorId ? "AND i.fornecedor_subcontratado_id = " + params.fornecedorId : "" }}
        {{ params && params.projetoId ? "AND i.projeto_id = " + params.projetoId : "" }}
      GROUP BY a.id
      ORDER BY a.data_auditoria DESC, a.id DESC;
    `,
  });
}

export default loadAuditoriasFornecedores;
