import { action } from '@uibakery/data';

function checkEmpresasSequence() {
  return action('checkEmpresasSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        last_value,
        is_called
      FROM empresas_id_seq;
    `,
  });
}

export default checkEmpresasSequence;
