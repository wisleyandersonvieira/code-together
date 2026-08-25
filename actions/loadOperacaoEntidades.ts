import { action } from '@uibakery/data';

/** Clientes, empresas e grupos — usado nos seletores do módulo Operação. */
function loadOperacaoEntidades() {
  return action('loadOperacaoEntidades', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        c.id,
        c.name,
        'cliente' AS entity_type,
        c.name AS display_name
      FROM clientes c
      WHERE c.active = true

      UNION ALL

      SELECT e.id, e.name, 'empresa', CONCAT(e.name, ' (Empresa)') FROM empresas e

      UNION ALL

      SELECT g.id, g.name, 'grupo', CONCAT(g.name, ' (Grupo)') FROM grupos g

      ORDER BY 4;
    `,
  });
}

export default loadOperacaoEntidades;
