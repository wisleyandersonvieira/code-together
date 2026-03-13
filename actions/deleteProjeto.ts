import { action } from '@uibakery/data';

function deleteProjeto() {
  return action('deleteProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Limpar apenas relacionamentos seguros (sem vínculos financeiros críticos)
      DELETE FROM previsao_aportes WHERE projeto_id = {{params.id}};
      DELETE FROM projeto_members WHERE projeto_id = {{params.id}};
      DELETE FROM orcamentos WHERE projeto_id = {{params.id}};
      
      -- Excluir arquivos relacionados ao projeto
      DELETE FROM files WHERE entity_id = {{params.id}} AND (entity_type = 'projeto_document' OR entity_type = 'projeto_photo');
      
      -- Excluir o projeto
      DELETE FROM projetos WHERE id = {{params.id}}
      RETURNING id, name;
    `,
  });
}

export default deleteProjeto;
