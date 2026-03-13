import { action } from '@uibakery/data';

function uploadFile() {
  return action('uploadFile', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO files (filename, content_type, file_size, file_data, entity_type, entity_id)
      VALUES (
        '{{params.filename}}', 
        '{{params.contentType}}', 
        {{params.fileSize}}, 
        '{{params.fileData}}', 
        '{{params.entityType}}', 
        {{params.entityId}}
      )
      RETURNING id, filename, content_type, file_size;
    `,
  });
}

export default uploadFile;
