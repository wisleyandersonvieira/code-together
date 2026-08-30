import { action } from '@uibakery/data';

function updateModelagemPremissas() {
  return action('updateModelagemPremissas', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagens SET
        nome = '{{params.nome}}',
        localizacao = '{{params.localizacao}}',
        tipo_uso = '{{params.tipoUso}}',
        moeda = COALESCE('{{params.moeda}}', 'USD'),
        data_inicio = '{{params.dataInicio}}'::date,
        meses_aprovacao = {{params.mesesAprovacao}}::int,
        meses_construcao = {{params.mesesConstrucao}}::int,
        meses_pos_obra = {{params.mesesPosObra}}::int,
        horizonte_maximo = {{params.horizonteMaximo}}::int,
        usa_fases = COALESCE({{params.usaFases}}::boolean, FALSE),
        terreno_por_fase = COALESCE({{params.terrenoPorFase}}::boolean, FALSE),
        data_base = {{params.dataBase}}::date,
        revisao = '{{params.revisao}}',
        status = COALESCE('{{params.status}}', status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemPremissas;
