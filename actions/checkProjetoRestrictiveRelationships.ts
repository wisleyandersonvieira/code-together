import { action } from '@uibakery/data';

function checkProjetoRestrictiveRelationships() {
  return action('checkProjetoRestrictiveRelationships', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.name,
        -- Contas a receber vinculadas diretamente ao projeto
        (SELECT COUNT(*) FROM contas_receber_projetos crp WHERE crp.projeto_id = p.id) as contas_receber_projetos_diretas,
        
        -- Contas a pagar vinculadas diretamente ao projeto  
        (SELECT COUNT(*) FROM contas_pagar_projetos cpp WHERE cpp.projeto_id = p.id) as contas_pagar_projetos_diretas,
        
        -- Contas a pagar vinculadas através de orçamentos (projeto → orçamento → alocação orçamentária)
        (SELECT COUNT(*) FROM conta_pagar_orcamento_alocacao cpoa 
         JOIN orcamentos o ON cpoa.orcamento_id = o.id 
         WHERE o.projeto_id = p.id) as contas_pagar_via_orcamento,
         
        -- Contas a receber vinculadas através de aportes (projeto → previsao_aportes → rateio_aportes)
        (SELECT COUNT(*) FROM rateio_aportes ra
         JOIN previsao_aportes pa ON ra.aporte_id = pa.id
         WHERE pa.projeto_id = p.id) as contas_receber_via_aporte,
         
        -- Outros relacionamentos que podem ser removidos automaticamente
        (SELECT COUNT(*) FROM orcamentos o WHERE o.projeto_id = p.id) as orcamentos,
        (SELECT COUNT(*) FROM projeto_members pm WHERE pm.projeto_id = p.id) as projeto_members,
        (SELECT COUNT(*) FROM previsao_aportes pa WHERE pa.projeto_id = p.id) as previsao_aportes
      FROM projetos p
      WHERE p.id = {{params.projetoId}};
    `,
  });
}

export default checkProjetoRestrictiveRelationships;
