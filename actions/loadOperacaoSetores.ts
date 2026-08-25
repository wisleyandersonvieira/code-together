import { action } from '@uibakery/data';

/** Setores em uso (etapas de fluxo + obrigações), para alimentar os filtros. */
function loadOperacaoSetores() {
  return action('loadOperacaoSetores', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT setor
      FROM (
        SELECT setor FROM jornada_fluxo_etapas WHERE setor IS NOT NULL
        UNION ALL
        SELECT setor FROM obrigacoes_catalogo WHERE setor IS NOT NULL
      ) s
      ORDER BY setor;
    `,
  });
}

export default loadOperacaoSetores;
