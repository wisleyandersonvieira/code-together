import { action } from '@uibakery/data';

/**
 * Limpa TODOS os aportes de um sócio.
 *
 * Usada só quando o gerador substituiu o cronograma inteiro — a lista nova não
 * tem id nenhum, então o diff por id viraria N DELETEs seguidos de M INSERTs.
 * Um DELETE só faz a mesma coisa numa ida ao banco, e a substituição fica
 * atômica para quem lê no meio do salvamento. Mesmo padrão de
 * `deleteModelagemCustoParcelasDoCusto`.
 *
 * Nunca chamada sem o usuário ter confirmado a substituição na aba Sócios:
 * aporte do usuário não some em silêncio.
 */
function deleteModelagemSocioAportesDoSocio() {
  return action('deleteModelagemSocioAportesDoSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_socio_aportes
      WHERE socio_id = {{params.socioId}}::int
    `,
  });
}

export default deleteModelagemSocioAportesDoSocio;
