import { action } from '@uibakery/data';

function loadAuditoriaFornecedorById() {
  return action('loadAuditoriaFornecedorById', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        a.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', i.id,
              'fornecedor_subcontratado_id', i.fornecedor_subcontratado_id,
              'fornecedor_nome', fs.nome_razao_social,
              'data_emissao', i.data_emissao,
              'valor_total', i.valor_total,
              'parcelas', i.parcelas,
              'projeto_id', i.projeto_id,
              'projeto_nome', p.name,
              'status_pagamento', i.status_pagamento,
              'valor_pago', i.valor_pago,
              'valor_a_pagar', i.valor_a_pagar,
              'observacoes', i.observacoes,
              'auditado', i.auditado,
              'parcelas_detalhes', COALESCE((
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', ip.id,
                    'numero_parcela', ip.numero_parcela,
                    'valor_parcela', ip.valor_parcela,
                    'status', ip.status,
                    'data_pagamento', ip.data_pagamento,
                    'data_registro_baixa', ip.data_registro_baixa,
                    'usuario_id', ip.usuario_id,
                    'observacao', ip.observacao
                  )
                  ORDER BY ip.numero_parcela
                )
                FROM auditoria_fornecedor_item_parcelas ip
                WHERE ip.auditoria_item_id = i.id
              ), '[]'::json),
              'historico_pagamentos', COALESCE((
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', h.id,
                    'numero_parcela', h.numero_parcela,
                    'valor_pago', h.valor_pago,
                    'status', h.status,
                    'data_pagamento', h.data_pagamento,
                    'created_at', h.created_at,
                    'usuario_id', h.usuario_id,
                    'usuario_nome', u.name,
                    'observacao', h.observacao
                  )
                  ORDER BY h.created_at DESC
                )
                FROM auditoria_fornecedor_historico_pagamentos h
                LEFT JOIN users u ON u.id = h.usuario_id
                WHERE h.auditoria_item_id = i.id
              ), '[]'::json),
              'anexos', COALESCE((
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', f.id,
                    'filename', f.filename,
                    'content_type', f.content_type,
                    'file_size', f.file_size,
                    'created_at', f.created_at
                  )
                  ORDER BY f.created_at DESC
                )
                FROM files f
                WHERE f.entity_type = 'auditoria_item'
                  AND f.entity_id = i.id
              ), '[]'::json)
            )
            ORDER BY i.id
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM auditorias_fornecedores a
      LEFT JOIN auditoria_fornecedor_itens i ON i.auditoria_id = a.id
      LEFT JOIN fornecedores_subcontratados fs ON fs.id = i.fornecedor_subcontratado_id
      LEFT JOIN projetos p ON p.id = i.projeto_id
      WHERE a.id = {{params.id}}
      GROUP BY a.id;
    `,
  });
}

export default loadAuditoriaFornecedorById;
