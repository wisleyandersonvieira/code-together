import { action } from '@uibakery/data';

function insertRetiradasSimple() {
  return action('insertRetiradasSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO retiradas (
        id, socio_id, matriz_id, conta_id, data_retirada, valor, observacoes, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.socio_id}}, {{params.matriz_id}}, {{params.conta_id}}, 
        {{params.data_retirada}}, {{params.valor}}, {{params.observacoes}}, 
        {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        socio_id = EXCLUDED.socio_id,
        matriz_id = EXCLUDED.matriz_id,
        conta_id = EXCLUDED.conta_id,
        data_retirada = EXCLUDED.data_retirada,
        valor = EXCLUDED.valor,
        observacoes = EXCLUDED.observacoes,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertRetiradasSimple;
