import { action } from '@uibakery/data';

function loadClienteEntities() {
  return action('loadClienteEntities', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id, 
        name, 
        'cliente' as entity_type,
        name as display_name
      FROM clientes 
      WHERE active = true
      
      UNION ALL
      
      SELECT 
        id, 
        name, 
        'empresa' as entity_type,
        CONCAT(name, ' (Empresa)') as display_name
      FROM empresas
      
      UNION ALL
      
      SELECT 
        id, 
        name, 
        'grupo' as entity_type,
        CONCAT(name, ' (Grupo)') as display_name
      FROM grupos
      
      ORDER BY display_name;
    `,
  });
}

export default loadClienteEntities;
