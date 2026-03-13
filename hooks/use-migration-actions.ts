import { useMutateAction } from '@uibakery/data';
import createTablesInRDSAction from '@/actions/rds/createTablesInRDS';
import createFinancialTablesAction from '@/actions/rds/createFinancialTables';
import createProjectTablesAction from '@/actions/rds/createProjectTables';
import createAllMissingTablesAction from '@/actions/rds/createAllMissingTables';
import getAllTableCountsAction from '@/actions/source/getAllTableCounts';
import createMissingLinkTablesAction from '@/actions/rds/createMissingLinkTables';
import testCreateProjectTablesAction from '@/actions/rds/testCreateProjectTables';
import checkTableExistsAction from '@/actions/rds/checkTableExists';

// Extract actions
import extractUsersAction from '@/actions/source/extractUsers';
import extractClientesAction from '@/actions/source/extractClientes';
import extractEmpresasAction from '@/actions/source/extractEmpresas';
import extractContasAction from '@/actions/source/extractContas';
import extractProjetosAction from '@/actions/source/extractProjetos';
import extractAportesAction from '@/actions/source/extractAportes';
import extractContasPagarAction from '@/actions/source/extractContasPagar';
import extractParametrosAction from '@/actions/source/extractParametros';
import extractFornecedoresAction from '@/actions/source/extractFornecedores';
import extractGruposAction from '@/actions/source/extractGrupos';
import extractEmpresaClientesAction from '@/actions/source/extractEmpresaClientes';
import extractGrupoMembersAction from '@/actions/source/extractGrupoMembers';
import extractKanbanColumnsAction from '@/actions/source/extractKanbanColumns';
import extractProjetoMembersAction from '@/actions/source/extractProjetoMembers';
import extractContasPagarItensAction from '@/actions/source/extractContasPagarItens';
import extractContasReceberItensAction from '@/actions/source/extractContasReceberItens';

// Insert actions
import insertUsersSimpleAction from '@/actions/rds/insertUsersSimple';
import insertClienteSimpleAction from '@/actions/rds/insertClienteSimple';
import insertEmpresaSimpleAction from '@/actions/rds/insertEmpresaSimple';
import insertProjetoSimpleAction from '@/actions/rds/insertProjetoSimple';
import insertAporteSimpleAction from '@/actions/rds/insertAporteSimple';
import insertContaSimpleAction from '@/actions/rds/insertContaSimple';
import insertContaPagarSimpleAction from '@/actions/rds/insertContaPagarSimple';
import insertParametroSimpleAction from '@/actions/rds/insertParametroSimple';
import insertFornecedorSimpleAction from '@/actions/rds/insertFornecedorSimple';
import insertGrupoSimpleAction from '@/actions/rds/insertGrupoSimple';
import insertEmpresaClienteSimpleAction from '@/actions/rds/insertEmpresaClienteSimple';
import insertGrupoMemberSimpleAction from '@/actions/rds/insertGrupoMemberSimple';
import insertKanbanColumnSimpleAction from '@/actions/rds/insertKanbanColumnSimple';
import insertProjetoMemberSimpleAction from '@/actions/rds/insertProjetoMemberSimple';
import insertContaPagarItemSimpleAction from '@/actions/rds/insertContaPagarItemSimple';
import insertContaReceberItemSimpleAction from '@/actions/rds/insertContaReceberItemSimple';
import insertRetiradasSimpleAction from '@/actions/rds/insertRetiradasSimple';
import insertContaPagarProjetoSimpleAction from '@/actions/rds/insertContaPagarProjetoSimple';
import insertContaReceberProjetoSimpleAction from '@/actions/rds/insertContaReceberProjetoSimple';
import insertGrupoContabilSimpleAction from '@/actions/rds/insertGrupoContabilSimple';
import insertSubgrupoContabilSimpleAction from '@/actions/rds/insertSubgrupoContabilSimple';
import insertOrcamentoSimpleAction from '@/actions/rds/insertOrcamentoSimple';
import insertPrevisaoAporteSimpleAction from '@/actions/rds/insertPrevisaoAporteSimple';
import insertRateioAporteSimpleAction from '@/actions/rds/insertRateioAporteSimple';
import insertMatrizSocioSimpleAction from '@/actions/rds/insertMatrizSocioSimple';
import insertProjetoColumnHistorySimpleAction from '@/actions/rds/insertProjetoColumnHistorySimple';
import insertContaPagarOrcamentoAlocacaoSimpleAction from '@/actions/rds/insertContaPagarOrcamentoAlocacaoSimple';

export function useMigrationActions() {
  // Infrastructure actions
  const [createTables] = useMutateAction(createTablesInRDSAction);
  const [createFinancialTables] = useMutateAction(createFinancialTablesAction);
  const [createProjectTables] = useMutateAction(createProjectTablesAction);
  const [createAllMissingTables] = useMutateAction(createAllMissingTablesAction);
  const [createMissingLinkTables] = useMutateAction(createMissingLinkTablesAction);
  const [testCreateProjectTables] = useMutateAction(testCreateProjectTablesAction);
  const [getAllCounts] = useMutateAction(getAllTableCountsAction);
  const [checkTable] = useMutateAction(checkTableExistsAction);

  // Extract actions
  const [extractUsers] = useMutateAction(extractUsersAction);
  const [extractClientes] = useMutateAction(extractClientesAction);
  const [extractEmpresas] = useMutateAction(extractEmpresasAction);
  const [extractContas] = useMutateAction(extractContasAction);
  const [extractProjetos] = useMutateAction(extractProjetosAction);
  const [extractAportes] = useMutateAction(extractAportesAction);
  const [extractContasPagar] = useMutateAction(extractContasPagarAction);
  const [extractParametros] = useMutateAction(extractParametrosAction);
  const [extractFornecedores] = useMutateAction(extractFornecedoresAction);
  const [extractGrupos] = useMutateAction(extractGruposAction);
  const [extractEmpresaClientes] = useMutateAction(extractEmpresaClientesAction);
  const [extractGrupoMembers] = useMutateAction(extractGrupoMembersAction);
  const [extractKanbanColumns] = useMutateAction(extractKanbanColumnsAction);
  const [extractProjetoMembers] = useMutateAction(extractProjetoMembersAction);
  const [extractContasPagarItens] = useMutateAction(extractContasPagarItensAction);
  const [extractContasReceberItens] = useMutateAction(extractContasReceberItensAction);

  // Insert actions
  const [insertUserSimple] = useMutateAction(insertUsersSimpleAction);
  const [insertClienteSimple] = useMutateAction(insertClienteSimpleAction);
  const [insertEmpresaSimple] = useMutateAction(insertEmpresaSimpleAction);
  const [insertProjetoSimple] = useMutateAction(insertProjetoSimpleAction);
  const [insertAporteSimple] = useMutateAction(insertAporteSimpleAction);
  const [insertContaSimple] = useMutateAction(insertContaSimpleAction);
  const [insertContaPagarSimple] = useMutateAction(insertContaPagarSimpleAction);
  const [insertParametroSimple] = useMutateAction(insertParametroSimpleAction);
  const [insertFornecedorSimple] = useMutateAction(insertFornecedorSimpleAction);
  const [insertGrupoSimple] = useMutateAction(insertGrupoSimpleAction);
  const [insertEmpresaClienteSimple] = useMutateAction(insertEmpresaClienteSimpleAction);
  const [insertGrupoMemberSimple] = useMutateAction(insertGrupoMemberSimpleAction);
  const [insertKanbanColumnSimple] = useMutateAction(insertKanbanColumnSimpleAction);
  const [insertProjetoMemberSimple] = useMutateAction(insertProjetoMemberSimpleAction);
  const [insertContaPagarItemSimple] = useMutateAction(insertContaPagarItemSimpleAction);
  const [insertContaReceberItemSimple] = useMutateAction(insertContaReceberItemSimpleAction);
  const [insertRetiradasSimple] = useMutateAction(insertRetiradasSimpleAction);
  const [insertContaPagarProjetoSimple] = useMutateAction(insertContaPagarProjetoSimpleAction);
  const [insertContaReceberProjetoSimple] = useMutateAction(insertContaReceberProjetoSimpleAction);
  const [insertGrupoContabilSimple] = useMutateAction(insertGrupoContabilSimpleAction);
  const [insertSubgrupoContabilSimple] = useMutateAction(insertSubgrupoContabilSimpleAction);
  const [insertOrcamentoSimple] = useMutateAction(insertOrcamentoSimpleAction);
  const [insertPrevisaoAporteSimple] = useMutateAction(insertPrevisaoAporteSimpleAction);
  const [insertRateioAporteSimple] = useMutateAction(insertRateioAporteSimpleAction);
  const [insertMatrizSocioSimple] = useMutateAction(insertMatrizSocioSimpleAction);
  const [insertProjetoColumnHistorySimple] = useMutateAction(insertProjetoColumnHistorySimpleAction);
  const [insertContaPagarOrcamentoAlocacaoSimple] = useMutateAction(insertContaPagarOrcamentoAlocacaoSimpleAction);

  return {
    // Infrastructure
    createTables,
    createFinancialTables,
    createProjectTables,
    createAllMissingTables,
    createMissingLinkTables,
    testCreateProjectTables,
    getAllCounts,
    checkTable,
    
    // Extract
    extractUsers,
    extractClientes,
    extractEmpresas,
    extractContas,
    extractProjetos,
    extractAportes,
    extractContasPagar,
    extractParametros,
    extractFornecedores,
    extractGrupos,
    extractEmpresaClientes,
    extractGrupoMembers,
    extractKanbanColumns,
    extractProjetoMembers,
    extractContasPagarItens,
    extractContasReceberItens,
    
    // Insert
    insertUserSimple,
    insertClienteSimple,
    insertEmpresaSimple,
    insertProjetoSimple,
    insertAporteSimple,
    insertContaSimple,
    insertContaPagarSimple,
    insertParametroSimple,
    insertFornecedorSimple,
    insertGrupoSimple,
    insertEmpresaClienteSimple,
    insertGrupoMemberSimple,
    insertKanbanColumnSimple,
    insertProjetoMemberSimple,
    insertContaPagarItemSimple,
    insertContaReceberItemSimple,
    insertRetiradasSimple,
    insertContaPagarProjetoSimple,
    insertContaReceberProjetoSimple,
    insertGrupoContabilSimple,
    insertSubgrupoContabilSimple,
    insertOrcamentoSimple,
    insertPrevisaoAporteSimple,
    insertRateioAporteSimple,
    insertMatrizSocioSimple,
    insertProjetoColumnHistorySimple,
    insertContaPagarOrcamentoAlocacaoSimple
  };
}
