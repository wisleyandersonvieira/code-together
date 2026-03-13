import { action } from '@uibakery/data';

function loadFilesByEntity() {
  return action('loadFilesByEntity', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, filename, content_type, file_size, created_at
      FROM files
      WHERE entity_type = '{{params.entityType}}' AND entity_id = {{params.entityId}}
      ORDER BY created_at DESC;
    `,
  });
}

export default loadFilesByEntity;
