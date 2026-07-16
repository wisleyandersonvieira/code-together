import { action } from '@uibakery/data';

function setProjetoCover() {
  return action('setProjetoCover', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE files
      SET is_cover = (id = {{params.fileId}})
      WHERE entity_type = 'projeto_photo'
        AND entity_id = {{params.projetoId}}
      RETURNING id, is_cover;
    `,
  });
}

export default setProjetoCover;
