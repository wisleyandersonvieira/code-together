import { action } from '@uibakery/data';

function debugTitulosReceberConstraints() {
  return action('debugTitulosReceberConstraints', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Verificar constraints da tabela titulos_receber
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'titulos_receber'
        AND tc.table_schema = 'public'
      
      UNION ALL
      
      -- Verificar sequência atual
      SELECT 
        'sequence_info' as constraint_name,
        'SEQUENCE' as constraint_type,
        CONCAT('current_value: ', last_value, ', is_called: ', is_called) as column_name
      FROM titulos_receber_id_seq
      
      UNION ALL
      
      -- Verificar últimos IDs inseridos
      SELECT 
        'last_ids' as constraint_name,
        'DATA' as constraint_type,
        CONCAT('id: ', id, ', conta_receber_id: ', conta_receber_id) as column_name
      FROM titulos_receber 
      ORDER BY created_at DESC 
      LIMIT 5;
    `,
  });
}

export default debugTitulosReceberConstraints;
