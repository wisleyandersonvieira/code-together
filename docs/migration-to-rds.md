# Migração para RDS AWS

## Objetivo
Migrar todas as ações do projeto do banco UI Bakery (`New custom app_bR26bpPQmY`) para o banco RDS AWS (`provision`).

## Status da Migração

### ✅ Bancos de Dados
- **Origem**: `New custom app_bR26bpPQmY` (UI Bakery)
- **Destino**: `provision` (RDS AWS)

### ✅ Principais Ações Migradas

#### Core System
- `loadUsers.ts` ✅
- `createUser.ts` ✅  
- `updateUser.ts` ✅
- `deleteUser.ts` ✅
- `authenticateUser.ts` ✅

#### Cadastros
- `loadClientes.ts` ✅
- `loadEmpresas.ts` ✅
- `loadGrupos.ts` ✅
- `loadFornecedores.ts` ✅
- `loadProjetos.ts` ✅

#### Financeiro
- `loadContas.ts` ✅
- `loadGruposContabeis.ts` ✅
- `loadSubgruposContabeis.ts` ✅
- `loadProdutos.ts` ✅
- `loadTiposDocumento.ts` ✅
- `loadContasPagar.ts` ✅
- `loadContasReceber.ts` ✅
- `loadTransferencias.ts` ✅

#### Sistema Matriz
- `loadSocios.ts` ✅
- `loadMatrizes.ts` ✅
- `loadAportes.ts` ✅
- `loadRetiradas.ts` ✅
- `loadEstruturasDre.ts` ✅

#### Outros
- `loadParametros.ts` ✅
- `loadDashboardStats.ts` ✅
- `loadKanbanColumns.ts` ✅

### 🔄 Próximos Passos

1. **Atualizar ações restantes** - Há cerca de 400+ ações que ainda precisam ser migradas
2. **Executar script de migração em massa** - Usar o script em `scripts/updateAllActions.ts`
3. **Testes de funcionalidade** - Validar cada módulo após migração
4. **Backup do banco antigo** - Antes de finalizar a migração

### 📝 Como Executar a Migração Completa

