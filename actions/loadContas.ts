import { action } from '@uibakery/data';

function loadContas() {
  return action('loadContas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id,
        nome,
        banco,
        numero,
        saldo_inicial,
        data_saldo_inicial,
        created_at,
        updated_at
      FROM contas
      ORDER BY nome;
    `,
  });
}

export default loadContas;

