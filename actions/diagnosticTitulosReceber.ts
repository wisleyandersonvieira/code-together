import { action } from '@uibakery/data';

function diagnosticTitulosReceber() {
  return action('diagnosticTitulosReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Diagnostic da tabela titulos_receber
      SELECT 
        'table_info' as type,
        'titulos_receber' as name,
        (SELECT COUNT(*) FROM titulos_receber) as count,
        (SELECT MAX(id) FROM titulos_receber) as max_id,
        (SELECT last_value FROM titulos_receber_id_seq) as seq_value,
        (SELECT is_called FROM titulos_receber_id_seq) as seq_is_called;
    `,
  });
}

export default diagnosticTitulosReceber;
