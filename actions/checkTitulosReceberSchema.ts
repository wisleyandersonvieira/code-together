import { action } from '@uibakery/data';

function checkTitulosReceberSchema() {
  return action('checkTitulosReceberSchema', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Verificar todas as constraints da tabela
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'titulos_receber'::regclass;
    `,
  });
}

export default checkTitulosReceberSchema;
