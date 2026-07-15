import { action } from '@uibakery/data';

// UPSERT do estado de conciliação de um lançamento, identificado por
// (origem, origem_id). Grava conciliado = true/false, conta_id,
// conciliado_em = NOW() e conciliado_por (id do usuário GoTrue, opcional).
//
// Statement ÚNICO (INSERT ... ON CONFLICT ... DO UPDATE) para respeitar a
// guarda de statements da edge function execute-sql.
function setConciliacao() {
  return action('setConciliacao', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO conciliacoes_extrato (origem, origem_id, conta_id, conciliado, conciliado_em, conciliado_por)
      VALUES (
        '{{params.origem}}',
        {{params.origemId}}::int,
        {{params.contaId}}::int,
        {{params.conciliado}}::boolean,
        NOW(),
        {{ params.conciliadoPor ? "'" + params.conciliadoPor + "'::uuid" : "NULL" }}
      )
      ON CONFLICT (origem, origem_id) DO UPDATE SET
        conciliado     = EXCLUDED.conciliado,
        conta_id       = EXCLUDED.conta_id,
        conciliado_em  = NOW(),
        conciliado_por = EXCLUDED.conciliado_por
      RETURNING id, origem, origem_id, conciliado;
    `,
  });
}

export default setConciliacao;
