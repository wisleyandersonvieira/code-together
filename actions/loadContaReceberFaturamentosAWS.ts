import { action } from '@uibakery/data';

function loadContaReceberFaturamentosAWS() {
  return action('loadContaReceberFaturamentosAWS', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        cf.*,
        p.name as projeto_nome
      FROM contas_receber_faturamento cf
      LEFT JOIN projetos p ON p.id = cf.projeto_id
      WHERE cf.conta_receber_id = {{ contaReceberId }}
      ORDER BY cf.created_at ASC;
    `,
  });
}

export default loadContaReceberFaturamentosAWS;
