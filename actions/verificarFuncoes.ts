import { action } from '@uibakery/data';

function verificarFuncoes() {
  return action('verificarFuncoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT 
        funcao,
        LENGTH(funcao) as tamanho,
        ASCII(SUBSTRING(funcao, 1, 1)) as primeiro_char,
        ASCII(SUBSTRING(funcao, LENGTH(funcao), 1)) as ultimo_char
      FROM subgrupos_contabeis 
      WHERE funcao IS NOT NULL;
    `,
  });
}

export default verificarFuncoes;
