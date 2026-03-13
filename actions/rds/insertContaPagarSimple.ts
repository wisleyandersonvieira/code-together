import { action } from '@uibakery/data';

function insertContaPagarSimple() {
  return action('insertContaPagarSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_pagar (id, fornecedor_id, tipo_documento_id, numero_documento, data_emissao, data_vencimento, data_competencia, observacoes, valor_total, status)
      VALUES ({{params.id}}, {{params.fornecedor_id || 1}}, {{params.tipo_documento_id || 1}}, '{{params.numero_documento || "DOC-" + params.id}}', {{params.data_emissao ? "'" + params.data_emissao + "'" : params.date ? "'" + params.date + "'" : "CURRENT_DATE"}}, {{params.data_vencimento ? "'" + params.data_vencimento + "'" : params.due_date ? "'" + params.due_date + "'" : "CURRENT_DATE"}}, {{params.data_competencia ? "'" + params.data_competencia + "'" : params.date ? "'" + params.date + "'" : "CURRENT_DATE"}}, '{{params.observacoes || params.description || ""}}', {{params.valor_total || params.value || 0}}, '{{params.status || "PENDENTE"}}')
      ON CONFLICT (id) DO UPDATE SET
        fornecedor_id = EXCLUDED.fornecedor_id,
        tipo_documento_id = EXCLUDED.tipo_documento_id,
        numero_documento = EXCLUDED.numero_documento,
        data_emissao = EXCLUDED.data_emissao,
        data_vencimento = EXCLUDED.data_vencimento,
        data_competencia = EXCLUDED.data_competencia,
        observacoes = EXCLUDED.observacoes,
        valor_total = EXCLUDED.valor_total,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertContaPagarSimple;
