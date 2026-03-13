import { action } from '@uibakery/data';

function insertGrupoContabilSimple() {
  return action('insertGrupoContabilSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupos_contabeis (
        id, nome, descricao, ativo, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.nome}}, {{params.descricao}}, 
        {{params.ativo}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        ativo = EXCLUDED.ativo,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertGrupoContabilSimple;
