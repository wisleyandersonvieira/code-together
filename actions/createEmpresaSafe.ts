import { action } from '@uibakery/data';

function createEmpresaSafe() {
  return action('createEmpresaSafe', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO empresas (name, number, file_urls)
      VALUES ('{{params.name}}', {{params.number ? "'" + params.number + "'" : "NULL"}}, '{}')
      RETURNING id, name, number, file_urls, created_at, updated_at;
    `,
  });
}

export default createEmpresaSafe;
