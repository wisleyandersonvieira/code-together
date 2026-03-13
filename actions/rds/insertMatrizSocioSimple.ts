import { action } from '@uibakery/data';

function insertMatrizSocioSimple() {
  return action('insertMatrizSocioSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO matriz_socios (
        id, matriz_id, socio_id, percentual_participacao, valor_aporte, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.matriz_id}}, {{params.socio_id}}, {{params.percentual_participacao}}, 
        {{params.valor_aporte}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        matriz_id = EXCLUDED.matriz_id,
        socio_id = EXCLUDED.socio_id,
        percentual_participacao = EXCLUDED.percentual_participacao,
        valor_aporte = EXCLUDED.valor_aporte,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertMatrizSocioSimple;
