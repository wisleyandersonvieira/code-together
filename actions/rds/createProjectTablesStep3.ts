import { action } from '@uibakery/data';

function createProjectTablesStep3() {
  return action('createProjectTablesStep3', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Step 3: Create view and add constraints/indexes
      
      -- Create orcamentos_executado view
      CREATE OR REPLACE VIEW orcamentos_executado AS
      SELECT 
        o.id,
        o.projeto_id,
        o.description,
        o.fornecedor_id,
        o.predicted_date,
        o.value as valor_orcado,
        COALESCE(SUM(cpoa.valor_alocado), 0) as valor_executado,
        (o.value - COALESCE(SUM(cpoa.valor_alocado), 0)) as valor_saldo
      FROM orcamentos o
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      GROUP BY o.id, o.projeto_id, o.description, o.fornecedor_id, o.predicted_date, o.value;

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_conta_pagar_orcamento_conta_pagar ON conta_pagar_orcamento_alocacao(conta_pagar_id);
      CREATE INDEX IF NOT EXISTS idx_conta_pagar_orcamento_orcamento ON conta_pagar_orcamento_alocacao(orcamento_id);
      CREATE INDEX IF NOT EXISTS idx_previsao_aportes_projeto ON previsao_aportes(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_previsao_aportes_membro ON previsao_aportes(membro_id);
      CREATE INDEX IF NOT EXISTS idx_rateio_aportes_conta_receber ON rateio_aportes(conta_receber_id);
      CREATE INDEX IF NOT EXISTS idx_rateio_aportes_aporte ON rateio_aportes(aporte_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_column_history_projeto ON projeto_column_history(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_comments_projeto ON projeto_comments(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_tasks_projeto ON projeto_tasks(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_contas_pagar_projetos_conta ON contas_pagar_projetos(conta_pagar_id);
      CREATE INDEX IF NOT EXISTS idx_contas_pagar_projetos_projeto ON contas_pagar_projetos(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_contas_receber_projetos_conta ON contas_receber_projetos(conta_receber_id);
      CREATE INDEX IF NOT EXISTS idx_contas_receber_projetos_projeto ON contas_receber_projetos(projeto_id);

      -- Add unique constraints where needed
      ALTER TABLE conta_pagar_orcamento_alocacao 
      ADD CONSTRAINT IF NOT EXISTS uk_conta_pagar_orcamento 
      UNIQUE (conta_pagar_id, orcamento_id);

      ALTER TABLE previsao_aportes 
      ADD CONSTRAINT IF NOT EXISTS uk_previsao_projeto_membro_data 
      UNIQUE (projeto_id, membro_id, data_previsao);

      ALTER TABLE rateio_aportes 
      ADD CONSTRAINT IF NOT EXISTS uk_rateio_conta_aporte 
      UNIQUE (conta_receber_id, aporte_id);

      ALTER TABLE contas_pagar_projetos 
      ADD CONSTRAINT IF NOT EXISTS uk_conta_pagar_projeto 
      UNIQUE (conta_pagar_id, projeto_id);

      ALTER TABLE contas_receber_projetos 
      ADD CONSTRAINT IF NOT EXISTS uk_conta_receber_projeto 
      UNIQUE (conta_receber_id, projeto_id);

      SELECT 'Step 3 project tables constraints and indexes created successfully' as result;
    `,
  });
}

export default createProjectTablesStep3;
