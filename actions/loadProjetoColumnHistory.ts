import { action } from '@uibakery/data';

function loadProjetoColumnHistory() {
  return action('loadProjetoColumnHistory', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pch.id,
        pch.projeto_id,
        pch.from_column_id,
        pch.to_column_id,
        pch.moved_at,
        u.name as user_name,
        kc_from.name as from_column_name,
        kc_from.color as from_column_color,
        kc_to.name as to_column_name,
        kc_to.color as to_column_color
      FROM projeto_column_history pch
      JOIN users u ON pch.user_id = u.id
      LEFT JOIN kanban_columns kc_from ON pch.from_column_id = kc_from.id
      JOIN kanban_columns kc_to ON pch.to_column_id = kc_to.id
      WHERE pch.projeto_id = {{params.projetoId}}
      ORDER BY pch.moved_at DESC;
    `,
  });
}

export default loadProjetoColumnHistory;
