import { action } from '@uibakery/data';

/** Gera as competências que faltam. Idempotente: rodar de novo não duplica. */
function gerarObrigacoesCompetencias() {
  return action('gerarObrigacoesCompetencias', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.gerar_obrigacoes_competencias(
        {{ params && params.mesesFuturo ? Number(params.mesesFuturo) : 3 }},
        {{ params && params.mesesPassado ? Number(params.mesesPassado) : 12 }},
        {{ params && params.obrigacaoClienteId ? Number(params.obrigacaoClienteId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default gerarObrigacoesCompetencias;
