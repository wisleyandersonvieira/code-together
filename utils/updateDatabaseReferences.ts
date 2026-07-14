import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Script para atualizar todas as referências de banco
function updateDatabaseReferences() {
  const oldDatabase = 'New custom app_bR26bpPQmY';
  const newDatabase = 'provision';
  
  console.log(`🔄 Atualizando referências de "${oldDatabase}" para "${newDatabase}"`);
  
  // Lista de todos os arquivos de actions que precisam ser atualizados
  const actionFiles = [
    'actions/loadUsers.ts',
    'actions/createUser.ts',
    'actions/updateUser.ts',
    'actions/deleteUser.ts',
    'actions/loadClientes.ts',
    'actions/createCliente.ts',
    'actions/updateCliente.ts',
    'actions/deleteCliente.ts',
    'actions/loadEmpresas.ts',
    'actions/createEmpresa.ts',
    'actions/updateEmpresa.ts',
    'actions/loadGrupos.ts',
    'actions/createGrupo.ts',
    'actions/updateGrupo.ts',
    'actions/loadFornecedores.ts',
    'actions/createFornecedor.ts',
    'actions/loadProjetos.ts',
    'actions/createProjeto.ts',
    'actions/updateProjeto.ts',
    'actions/deleteProjeto.ts',
    'actions/loadContas.ts',
    'actions/createConta.ts',
    'actions/updateConta.ts',
    'actions/deleteConta.ts',
    'actions/loadGruposContabeis.ts',
    'actions/createGrupoContabil.ts',
    'actions/updateGrupoContabil.ts',
    'actions/deleteGrupoContabil.ts',
    'actions/loadSubgruposContabeis.ts',
    'actions/createSubgrupoContabil.ts',
    'actions/updateSubgrupoContabil.ts',
    'actions/deleteSubgrupoContabil.ts',
    'actions/loadProdutos.ts',
    'actions/createProduto.ts',
    'actions/updateProduto.ts',
    'actions/deleteProduto.ts',
    'actions/loadTiposDocumento.ts',
    'actions/createTipoDocumento.ts',
    'actions/updateTipoDocumento.ts',
    'actions/deleteTipoDocumento.ts',
    'actions/loadContasPagar.ts',
    'actions/createContaPagar.ts',
    'actions/updateContaPagar.ts',
    'actions/deleteContaPagar.ts',
    'actions/loadContasReceber.ts',
    'actions/createContaReceber.ts',
    'actions/updateContaReceber.ts',
    'actions/deleteContaReceber.ts',
    'actions/loadTransferencias.ts',
    'actions/createTransferencia.ts',
    'actions/updateTransferencia.ts',
    'actions/deleteTransferencia.ts',
    'actions/loadParametros.ts',
    'actions/updateParametro.ts',
    'actions/loadSocios.ts',
    'actions/createSocio.ts',
    'actions/updateSocio.ts',
    'actions/deleteSocio.ts',
    'actions/loadMatrizes.ts',
    'actions/createMatriz.ts',
    'actions/updateMatriz.ts',
    'actions/deleteMatriz.ts',
    'actions/loadAportes.ts',
    'actions/createAporte.ts',
    'actions/updateAporte.ts',
    'actions/deleteAporte.ts',
    'actions/loadRetiradas.ts',
    'actions/createRetirada.ts',
    'actions/updateRetirada.ts',
    'actions/deleteRetirada.ts',
    'actions/loadEstruturasDre.ts',
    'actions/createEstruturaDre.ts',
    'actions/deleteEstruturaDre.ts',
    'actions/loadDashboardStats.ts',
    'actions/loadKanbanColumns.ts',
    'actions/createKanbanColumn.ts',
    'actions/updateKanbanColumn.ts',
    'actions/deleteKanbanColumn.ts'
  ];
  
  let updatedFiles = 0;
  let totalReplacements = 0;
  
  actionFiles.forEach(filePath => {
    try {
      const fullPath = join(__dirname, '..', filePath);
      let content = readFileSync(fullPath, 'utf-8');
      
      const beforeLength = content.length;
      content = content.replace(new RegExp(oldDatabase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newDatabase);
      
      if (content.length !== beforeLength || content.includes(newDatabase)) {
        writeFileSync(fullPath, content, 'utf-8');
        updatedFiles++;
        const replacements = (content.match(new RegExp(newDatabase, 'g')) || []).length;
        totalReplacements += replacements;
        console.log(`✅ ${filePath} - ${replacements} substituições`);
      }
    } catch (error) {
      console.log(`⚠️ ${filePath} - arquivo não encontrado ou erro: ${(error as any).message}`);
    }
  });
  
  console.log(`\n📊 Resumo:`);
  console.log(`- Arquivos processados: ${actionFiles.length}`);
  console.log(`- Arquivos atualizados: ${updatedFiles}`);
  console.log(`- Total de substituições: ${totalReplacements}`);
  console.log(`\n✅ Atualização concluída!`);
}

export { updateDatabaseReferences };

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  updateDatabaseReferences();
}
