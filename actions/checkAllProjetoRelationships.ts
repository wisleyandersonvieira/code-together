import { action } from '@uibakery/data';

function checkAllProjetoRelationships() {
  return action('checkAllProjetoRelationships', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.name,
        (SELECT COUNT(*) FROM contas_receber_projetos crp WHERE crp.projeto_id = p.id) as contas_receber_projetos,
        (SELECT COUNT(*) FROM contas_pagar_projetos cpp WHERE cpp.projeto_id = p.id) as contas_pagar_projetos,
        (SELECT COUNT(*) FROM orcamentos o WHERE o.projeto_id = p.id) as orcamentos,
        (SELECT COUNT(*) FROM projeto_members pm WHERE pm.projeto_id = p.id) as projeto_members,
        (SELECT COUNT(*) FROM previsao_aportes pa WHERE pa.projeto_id = p.id) as previsao_aportes,
        (SELECT COUNT(*) FROM conta_pagar_orcamento_alocacao cpoa 
         JOIN orcamentos o ON cpoa.orcamento_id = o.id 
         WHERE o.projeto_id = p.id) as conta_pagar_orcamento_alocacoes
      FROM projetos p
      WHERE p.id = {{params.projetoId}};
    `,
  });
}

export default checkAllProjetoRelationships;
