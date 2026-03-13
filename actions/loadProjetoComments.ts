import { action } from '@uibakery/data';

function loadProjetoComments() {
  return action('loadProjetoComments', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pc.id,
        pc.comment,
        pc.created_at,
        u.name as user_name,
        u.email as user_email
      FROM projeto_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.projeto_id = {{params.projetoId}}
      ORDER BY pc.created_at DESC;
    `,
  });
}

export default loadProjetoComments;
