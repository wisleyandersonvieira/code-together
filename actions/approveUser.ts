import { action } from '@uibakery/data';

function approveUser() {
  return action('approveUser', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET status = 'active', role = {{params.role}}
      WHERE id = {{params.userId}} AND status = 'pending'
      RETURNING id, name, email, role, status;
    `,
  });
}

export default approveUser;
