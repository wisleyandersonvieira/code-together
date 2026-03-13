import { action } from '@uibakery/data';

function getFile() {
  return action('getFile', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id, 
        filename, 
        content_type, 
        file_size, 
        file_data,
        LENGTH(file_data) as data_length
      FROM files
      WHERE id = {{params.fileId}};
    `,
  });
}

export default getFile;
