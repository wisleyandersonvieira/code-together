import { action } from '@uibakery/data';

function insertSubgrupoContabilSimple() {
  return action('insertSubgrupoContabilSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO subgrupos_contabeis (
        id, grupo_contabil_id, nome, descricao, funcao, ativo, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.grupo_contabil_id}}, {{params.nome}}, {{params.descricao}}, 
        {{params.funcao}}, {{params.ativo}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        grupo_contabil_id = EXCLUDED.grupo_contabil_id,
        nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        funcao = EXCLUDED.funcao,
        ativo = EXCLUDED.ativo,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertSubgrupoContabilSimple;
