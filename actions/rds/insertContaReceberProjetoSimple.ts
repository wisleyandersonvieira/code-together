import { action } from '@uibakery/data';

function insertContaReceberProjetoSimple() {
  return action('insertContaReceberProjetoSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_projetos (
        id, conta_receber_id, projeto_id, percentual, valor_rateio, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.conta_receber_id}}, {{params.projeto_id}}, 
        {{params.percentual}}, {{params.valor_rateio}}, 
        {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        conta_receber_id = EXCLUDED.conta_receber_id,
        projeto_id = EXCLUDED.projeto_id,
        percentual = EXCLUDED.percentual,
        valor_rateio = EXCLUDED.valor_rateio,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertContaReceberProjetoSimple;
