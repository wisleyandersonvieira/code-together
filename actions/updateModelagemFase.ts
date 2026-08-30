import { action } from '@uibakery/data';

function updateModelagemFase() {
  return action('updateModelagemFase', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_fases SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        nome = '{{params.nome}}',
        data_inicio = '{{params.dataInicio}}'::date,
        data_fim = '{{params.dataFim}}'::date
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemFase;
