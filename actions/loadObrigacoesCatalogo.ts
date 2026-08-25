import { action } from '@uibakery/data';

function loadObrigacoesCatalogo() {
  return action('loadObrigacoesCatalogo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        o.id,
        o.nome,
        o.descricao,
        o.periodicidade,
        o.mes_ancora,
        o.dia_vencimento,
        o.mes_offset,
        o.prazo_interno_dias,
        o.setor,
        o.ativo,
        (SELECT COUNT(*) FROM obrigacoes_cliente oc WHERE oc.obrigacao_id = o.id) AS clientes_vinculados
      FROM obrigacoes_catalogo o
      WHERE 1 = 1
        {{ params && params.apenasAtivas ? "AND o.ativo = true" : "" }}
        {{ params && params.periodicidade && params.periodicidade !== 'all' ? "AND o.periodicidade = '" + params.periodicidade + "'" : "" }}
        {{ params && params.searchTerm ? "AND o.nome ILIKE '%" + params.searchTerm + "%'" : "" }}
      ORDER BY o.periodicidade, o.nome;
    `,
  });
}

export default loadObrigacoesCatalogo;
