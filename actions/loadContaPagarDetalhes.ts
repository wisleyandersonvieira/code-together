import { action } from '@uibakery/data';

function loadContaPagarDetalhes() {
  return action('loadContaPagarDetalhes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        cpi.conta_pagar_id,
        'item'::text AS tipo,
        cpi.id::int AS ord,
        p.descricao AS produto_nome,
        g.descricao AS grupo_nome,
        s.descricao AS subgrupo_nome,
        cpi.valor_total,
        NULL::text AS projeto_nome
      FROM contas_pagar_itens cpi
      JOIN produtos p ON p.id = cpi.produto_id
      LEFT JOIN grupos_contabeis g ON g.id = p.grupo_id
      LEFT JOIN subgrupos_contabeis s ON s.id = p.subgrupo_id
      WHERE cpi.conta_pagar_id = ANY(ARRAY[{{ params.contaIds.join(',') }}]::int[])

      UNION ALL

      SELECT
        cpp.conta_pagar_id,
        'projeto'::text AS tipo,
        cpp.projeto_id::int AS ord,
        NULL::text AS produto_nome,
        NULL::text AS grupo_nome,
        NULL::text AS subgrupo_nome,
        NULL::numeric AS valor_total,
        pr.name AS projeto_nome
      FROM contas_pagar_projetos cpp
      JOIN projetos pr ON pr.id = cpp.projeto_id
      WHERE cpp.conta_pagar_id = ANY(ARRAY[{{ params.contaIds.join(',') }}]::int[])

      ORDER BY conta_pagar_id, tipo, ord;
    `,
  });
}

export default loadContaPagarDetalhes;
