import { action } from '@uibakery/data';

function updateLastSyncTime() {
  return action('updateLastSyncTime', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO parametros (chave, valor, descricao, tipo, created_at, updated_at)
      VALUES ('last_rds_sync', {{params.currentTimestamp}}, 'Último timestamp de sincronização com RDS AWS', 'datetime', NOW(), NOW())
      ON CONFLICT (chave) DO UPDATE SET 
        valor = EXCLUDED.valor,
        updated_at = NOW();
    `,
  });
}

export default updateLastSyncTime;
