import { action } from '@uibakery/data';

function verifyTaxaAdmFunction() {
  return action('verifyTaxaAdmFunction', 'SQL', {
    databaseName: 'provision',
    query: `SELECT * FROM subgrupos_contabeis WHERE descricao = 'Taxa Adm' LIMIT 10;`,
  });
}

export default verifyTaxaAdmFunction;
