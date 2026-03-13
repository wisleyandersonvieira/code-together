import { action } from '@uibakery/data';

function deleteFile() {
  return action('deleteFile', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM files
      WHERE id = {{params.fileId}};
    `,
  });
}

export default deleteFile;
