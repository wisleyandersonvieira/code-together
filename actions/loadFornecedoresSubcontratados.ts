import { action } from '@uibakery/data';

function loadFornecedoresSubcontratados() {
  return action('loadFornecedoresSubcontratados', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        fs.id,
        fs.nome_razao_social,
        fs.nome_fantasia,
        fs.cpf_cnpj,
        fs.telefone,
        fs.email,
        fs.contato_responsavel,
        fs.observacoes,
        fs.status,
        fs.created_at,
        fs.updated_at,
        COUNT(DISTINCT afi.id) AS auditorias_vinculadas
      FROM fornecedores_subcontratados fs
      LEFT JOIN auditoria_fornecedor_itens afi
        ON afi.fornecedor_subcontratado_id = fs.id
      WHERE 1 = 1
        {{ params && params.searchTerm ? "AND (fs.nome_razao_social ILIKE '%" + params.searchTerm + "%' OR COALESCE(fs.nome_fantasia, '') ILIKE '%" + params.searchTerm + "%' OR fs.cpf_cnpj ILIKE '%" + params.searchTerm + "%')" : "" }}
        {{ params && params.status && params.status !== 'all' ? "AND fs.status = '" + params.status + "'" : "" }}
        {{ params && params.onlyActive ? "AND fs.status = 'ativo'" : "" }}
      GROUP BY fs.id
      ORDER BY fs.nome_razao_social ASC;
    `,
  });
}

export default loadFornecedoresSubcontratados;
