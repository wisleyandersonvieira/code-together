import { action } from '@uibakery/data';

function loadContaReceberProjetos() {
  return action('loadContaReceberProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT crp.*, p.name as projeto_nome
      FROM contas_receber_projetos crp
      JOIN projetos p ON crp.projeto_id = p.id
      WHERE crp.conta_receber_id = {{params.contaReceberId}}
      ORDER BY crp.id;
    `,
  });
}

export default loadContaReceberProjetos;
