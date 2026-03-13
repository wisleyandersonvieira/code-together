import { action } from '@uibakery/data';

function insertParametroSimple() {
  return action('insertParametroSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO parametros (id, chave, valor, descricao, tipo)
      VALUES ({{params.id}}, '{{params.chave || ""}}', '{{params.valor || ""}}', '{{params.descricao || ""}}', '{{params.tipo || "texto"}}')
      ON CONFLICT (id) DO UPDATE SET
        chave = EXCLUDED.chave,
        valor = EXCLUDED.valor,
        descricao = EXCLUDED.descricao,
        tipo = EXCLUDED.tipo,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertParametroSimple;
