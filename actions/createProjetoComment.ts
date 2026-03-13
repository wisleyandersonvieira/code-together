import { action } from '@uibakery/data';

function createProjetoComment() {
  return action('createProjetoComment', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projeto_comments (projeto_id, user_id, comment)
      VALUES ({{params.projetoId}}, {{params.userId}}, '{{params.comment}}')
      RETURNING id, comment, created_at;
    `,
  });
}

export default createProjetoComment;
