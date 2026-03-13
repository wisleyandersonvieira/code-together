import { action } from '@uibakery/data';

function createProjetoMember() {
  return action('createProjetoMember', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projeto_members (projeto_id, cliente_id, empresa_id, grupo_id, percentage)
      VALUES ({{params.projetoId}}, {{params.clienteId}}, {{params.empresaId}}, {{params.grupoId}}, {{params.percentage}});
    `,
  });
}

export default createProjetoMember;
