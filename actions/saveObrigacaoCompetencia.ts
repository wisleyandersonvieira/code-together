import { action } from '@uibakery/data';

function saveObrigacaoCompetencia() {
  return action('saveObrigacaoCompetencia', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_obrigacao_competencia(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb,
        {{ params && params.userId ? Number(params.userId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default saveObrigacaoCompetencia;
