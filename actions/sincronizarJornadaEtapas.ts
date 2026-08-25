import { action } from '@uibakery/data';

/** Traz para a jornada as etapas que o fluxo ganhou depois que ela começou. */
function sincronizarJornadaEtapas() {
  return action('sincronizarJornadaEtapas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.sincronizar_jornada_etapas(
        {{ params && params.jornadaId ? Number(params.jornadaId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default sincronizarJornadaEtapas;
