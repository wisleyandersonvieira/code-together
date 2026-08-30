import { action } from '@uibakery/data';

/**
 * Atualização parcial da coluna: o que não vier no params fica como está.
 *
 * O template do execute-sql troca `'{{params.x}}'` por `NULL` (sem aspas) quando
 * o parâmetro é nulo ou ausente, e por `'valor'` quando existe — é o que faz o
 * COALESCE abaixo significar "só mexe no que foi mandado".
 */
function updateKanbanColumn() {
  return action('updateKanbanColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE kanban_columns
      SET
        name = COALESCE('{{params.name}}', name),
        color = COALESCE('{{params.color}}', color),
        -- O ícone precisa poder VOLTAR a NULL ("Sem ícone"), e com COALESCE
        -- mandar NULL significaria "não mexer". Então a string vazia é o sinal
        -- de limpar; parâmetro ausente continua sendo "não mexer".
        icon = CASE
                 WHEN '{{params.icon}}' IS NULL THEN icon
                 ELSE NULLIF('{{params.icon}}', '')
               END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int
      RETURNING id, name, position, color, icon;
    `,
  });
}

export default updateKanbanColumn;
