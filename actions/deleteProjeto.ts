import { action } from '@uibakery/data';

function deleteProjeto() {
  return action('deleteProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Statement único (CTEs modificadoras): a edge function execute-sql aceita
      -- apenas um comando por requisição. Limpa apenas relacionamentos seguros
      -- (sem vínculos financeiros críticos) antes de excluir o projeto.
      WITH del_previsao AS (
        DELETE FROM previsao_aportes WHERE projeto_id = {{params.id}}
      ),
      del_members AS (
        DELETE FROM projeto_members WHERE projeto_id = {{params.id}}
      ),
      del_orcamentos AS (
        DELETE FROM orcamentos WHERE projeto_id = {{params.id}}
      ),
      del_files AS (
        DELETE FROM files
        WHERE entity_id = {{params.id}}
          AND (entity_type = 'projeto_document' OR entity_type = 'projeto_photo')
      )
      DELETE FROM projetos WHERE id = {{params.id}}
      RETURNING id, name;
    `,
  });
}

export default deleteProjeto;
