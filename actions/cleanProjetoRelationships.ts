import { action } from '@uibakery/data';

function cleanProjetoRelationships() {
  return action('cleanProjetoRelationships', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH projeto_orcamentos AS (
        SELECT id FROM orcamentos WHERE projeto_id = {{params.projetoId}}
      )
      DELETE FROM conta_pagar_orcamento_alocacao 
      WHERE orcamento_id IN (SELECT id FROM projeto_orcamentos);

      DELETE FROM contas_receber_projetos WHERE projeto_id = {{params.projetoId}};
      DELETE FROM contas_pagar_projetos WHERE projeto_id = {{params.projetoId}};
      DELETE FROM previsao_aportes WHERE projeto_id = {{params.projetoId}};
      DELETE FROM projeto_members WHERE projeto_id = {{params.projetoId}};
      DELETE FROM orcamentos WHERE projeto_id = {{params.projetoId}};
      
      SELECT 'Relacionamentos limpos' as message;
    `,
  });
}

export default cleanProjetoRelationships;
