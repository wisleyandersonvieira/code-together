import { action } from '@uibakery/data';

function checkProjetoRelationships() {
  return action('checkProjetoRelationships', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.name,
        (SELECT COUNT(*) FROM contas_receber_projetos crp WHERE crp.projeto_id = p.id) as contas_receber_count,
        (SELECT COUNT(*) FROM contas_pagar_orcamento_alocacoes cpoa 
         JOIN orcamentos o ON cpoa.orcamento_id = o.id 
         WHERE o.projeto_id = p.id) as contas_pagar_count
      FROM projetos p
      WHERE p.id = {{params.projetoId}};
    `,
  });
}

export default checkProjetoRelationships;
