import { action } from '@uibakery/data';

function updateModelagemSocio() {
  return action('updateModelagemSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_socios SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        nome = '{{params.nome}}',
        participacao_pct = COALESCE({{params.participacaoPct}}::decimal, 0),
        cota_disponivel = COALESCE({{params.cotaDisponivel}}::boolean, FALSE),
        observacoes = '{{params.observacoes}}'
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemSocio;
