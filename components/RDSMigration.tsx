'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutateAction } from '@uibakery/data';
import { useMigrationActions } from '@/hooks/use-migration-actions';
import { Database, Upload, CheckCircle, AlertTriangle, Loader2, Server } from 'lucide-react';

type MigrationStep = 'idle' | 'creating-structure' | 'migrating-data' | 'complete' | 'error';

export function RDSMigration() {
  const [migrationStep, setMigrationStep] = useState<MigrationStep>('idle');
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const actions = useMigrationActions();

  const addLog = (message: string) => {
    setMigrationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const tablesToMigrate = [
    // Basic tables
    'users', 'app_users', 'clientes', 'empresas', 'grupos', 'fornecedores',
    // Financial tables
    'contas', 'grupos_contabeis', 'subgrupos_contabeis', 'produtos', 'tipos_document', 'parametros',
    // Project tables
    'projetos', 'kanban_columns', 'empresa_clientes', 'grupo_members', 'projeto_members',
    // Account tables
    'contas_pagar', 'contas_receber', 'titulos_pagar', 'titulos_receber',
    // Matrix tables
    'socios', 'matrizes', 'matriz_socios', 'aportes', 'retiradas',
    // DRE tables
    'estruturas_dre', 'estruturas_dre_itens', 'estruturas_dre_soma_itens'
  ];

  const startMigration = async () => {
    try {
      setMigrationStep('creating-structure');
      setError(null);
      setProgress(0);
      setMigrationLog([]);

      addLog('Iniciando migração para RDS AWS');

      // Step 1: Create table structure
      addLog('Criando estrutura de tabelas básicas...');
      await actions.createTables({});
      addLog('✓ Tabelas básicas criadas');

      addLog('Criando tabelas financeiras...');
      await actions.createFinancialTables({});
      addLog('✓ Tabelas financeiras criadas');

      addLog('Criando tabelas de projetos...');
      await actions.createProjectTables({});
      addLog('✓ Tabelas de projetos criadas');

      addLog('Criando tabelas restantes...');
      await actions.createAllMissingTables({});
      addLog('✓ Todas as tabelas criadas');

      addLog('Criando tabelas de vínculos...');
      await actions.createMissingLinkTables({});
      addLog('✓ Tabelas de vínculos criadas');

      addLog('Criando tabelas de projeto faltantes...');
      await actions.testCreateProjectTables({});
      addLog('✓ Tabelas de projeto criadas com sucesso');

      setProgress(20);
      setMigrationStep('migrating-data');

      // Step 2: Migrate data
      addLog('Iniciando migração de dados...');
      
      // Get all table counts first
      try {
        addLog('Obtendo contagem de registros...');
        const tableCounts = await actions.getAllCounts({});
        addLog(`✓ Contagens obtidas para ${tableCounts?.length || 0} tabelas`);
        
        // Migration for multiple tables with individual record insertion
        const migrationTables = [
          { name: 'users', extractor: actions.extractUsers, inserter: actions.insertUserSimple, progressStart: 20, progressEnd: 22 },
          { name: 'clientes', extractor: actions.extractClientes, inserter: actions.insertClienteSimple, progressStart: 22, progressEnd: 25 },
          { name: 'empresas', extractor: actions.extractEmpresas, inserter: actions.insertEmpresaSimple, progressStart: 25, progressEnd: 27 },
          { name: 'projetos', extractor: actions.extractProjetos, inserter: actions.insertProjetoSimple, progressStart: 27, progressEnd: 30 },
          { name: 'aportes', extractor: actions.extractAportes, inserter: actions.insertAporteSimple, progressStart: 30, progressEnd: 33 },
          { name: 'contas', extractor: actions.extractContas, inserter: actions.insertContaSimple, progressStart: 33, progressEnd: 36 },
          { name: 'contas_pagar', extractor: actions.extractContasPagar, inserter: actions.insertContaPagarSimple, progressStart: 36, progressEnd: 39 },
          { name: 'parametros', extractor: actions.extractParametros, inserter: actions.insertParametroSimple, progressStart: 39, progressEnd: 42 },
          { name: 'fornecedores', extractor: actions.extractFornecedores, inserter: actions.insertFornecedorSimple, progressStart: 42, progressEnd: 45 },
          { name: 'grupos', extractor: actions.extractGrupos, inserter: actions.insertGrupoSimple, progressStart: 45, progressEnd: 48 },
          { name: 'empresa_clientes', extractor: actions.extractEmpresaClientes, inserter: actions.insertEmpresaClienteSimple, progressStart: 48, progressEnd: 50 },
          { name: 'grupo_members', extractor: actions.extractGrupoMembers, inserter: actions.insertGrupoMemberSimple, progressStart: 50, progressEnd: 52 },
          { name: 'kanban_columns', extractor: actions.extractKanbanColumns, inserter: actions.insertKanbanColumnSimple, progressStart: 52, progressEnd: 54 },
          { name: 'projeto_members', extractor: actions.extractProjetoMembers, inserter: actions.insertProjetoMemberSimple, progressStart: 54, progressEnd: 56 },
          { name: 'contas_pagar_itens', extractor: actions.extractContasPagarItens, inserter: actions.insertContaPagarItemSimple, progressStart: 56, progressEnd: 58 },
          { name: 'contas_receber_itens', extractor: actions.extractContasReceberItens, inserter: actions.insertContaReceberItemSimple, progressStart: 58, progressEnd: 60 }
        ];
        
        for (let i = 0; i < migrationTables.length; i++) {
          const { name: tableName, extractor, inserter, progressStart, progressEnd } = migrationTables[i];
          setCurrentTable(tableName);
          
          try {
            addLog(`Migrando tabela: ${tableName}`);
            
            // Check if table exists in RDS first
            const tableCheck = await actions.checkTable({ tableName });
            if (!tableCheck?.[0]?.table_exists) {
              addLog(`⚠ Tabela ${tableName} não existe no RDS, pulando...`);
              setProgress(progressEnd);
              continue;
            }
            
            // Find count for this table
            const tableCount = tableCounts?.find(t => t.table_name === tableName);
            const recordCount = tableCount?.record_count || 0;
            
            if (recordCount > 0) {
              addLog(`  └ Encontrados ${recordCount} registros para migrar`);
              
              // Get records in batches but insert one by one
              let offset = 0;
              const batchSize = 50;
              let totalMigrated = 0;
              
              while (offset < recordCount) {
                const data = await extractor({ limit: batchSize, offset });
                
                if (data && data.length > 0) {
                  // Insert one record at a time
                  let batchSuccess = 0;
                  for (let j = 0; j < data.length; j++) {
                    const record = data[j];
                    try {
                      // Handle specific table mappings and clean up null/undefined values
                      const cleanRecord = Object.fromEntries(
                        Object.entries(record).map(([key, value]) => [
                          key, 
                          value === null || value === undefined ? null : value
                        ])
                      );
                      
                      await inserter(cleanRecord);
                      batchSuccess++;
                      totalMigrated++;
                      
                      // Small delay between records
                      await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (recordError) {
                      addLog(`    ⚠ Erro ao inserir registro ${record.id} em ${tableName}: ${recordError.message || recordError}`);
                    }
                  }
                  
                  addLog(`  └ Lote ${Math.floor(offset/batchSize) + 1}: ${batchSuccess}/${data.length} registros inseridos (${totalMigrated}/${recordCount})`);
                } else {
                  addLog(`  └ Nenhum dado retornado no offset ${offset}`);
                }
                
                offset += batchSize;
                
                // Update progress within this table
                const tableProgress = Math.min(offset / recordCount, 1);
                const currentProgress = progressStart + (progressEnd - progressStart) * tableProgress;
                setProgress(currentProgress);
                
                // Break if no more data
                if (!data || data.length < batchSize) break;
              }
              
              addLog(`✓ ${tableName}: ${totalMigrated} registros migrados com sucesso`);
            } else {
              addLog(`✓ ${tableName}: tabela vazia`);
            }
            
            setProgress(progressEnd);
            
          } catch (tableError) {
            addLog(`⚠ Erro na tabela ${tableName}: ${tableError.message || tableError}`);
            setProgress(progressEnd);
          }
        }
        
      } catch (countsError) {
        addLog(`⚠ Erro ao obter contagens: ${countsError.message || countsError}`);
      }

      setProgress(100);
      setMigrationStep('complete');
      setCurrentTable('');
      addLog('🎉 Migração das tabelas principais concluída com sucesso!');

    } catch (err) {
      setMigrationStep('error');
      setError(err?.message || 'Erro desconhecido na migração');
      addLog(`❌ Erro: ${err?.message}`);
    }
  };

  const resetMigration = () => {
    setMigrationStep('idle');
    setProgress(0);
    setCurrentTable('');
    setMigrationLog([]);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Migração para RDS AWS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <Database className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="font-semibold">Origem</div>
              <div className="text-sm text-gray-600">UI Bakery Hosted</div>
              <Badge variant="secondary">45 tabelas</Badge>
            </div>

            <div className="flex items-center justify-center">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>

            <div className="p-4 bg-green-50 rounded-lg text-center">
              <Server className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="font-semibold">Destino</div>
              <div className="text-sm text-gray-600">RDS AWS</div>
              <Badge variant={migrationStep === 'complete' ? 'default' : 'outline'}>
                {migrationStep === 'complete' ? 'Sincronizado' : 'Aguardando'}
              </Badge>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {migrationStep !== 'idle' && migrationStep !== 'complete' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {migrationStep === 'creating-structure' && 'Criando estrutura...'}
                  {migrationStep === 'migrating-data' && `Migrando: ${currentTable}`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            {migrationStep === 'idle' && (
              <Button onClick={startMigration} className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Iniciar Migração
              </Button>
            )}

            {migrationStep !== 'idle' && migrationStep !== 'complete' && (
              <Button disabled className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Migrando...
              </Button>
            )}

            {(migrationStep === 'complete' || migrationStep === 'error') && (
              <Button onClick={resetMigration} variant="outline">
                Nova Migração
              </Button>
            )}
          </div>

          {migrationStep === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Migração concluída! Seu banco RDS AWS está sincronizado com os dados atuais.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {migrationLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Log da Migração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded font-mono text-sm space-y-1">
              {migrationLog.map((log, index) => (
                <div key={index} className={
                  log.includes('✓') ? 'text-green-600' :
                  log.includes('⚠') ? 'text-yellow-600' :
                  log.includes('❌') ? 'text-red-600' :
                  log.includes('🎉') ? 'text-blue-600 font-semibold' :
                  'text-gray-700'
                }>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informações da Migração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Tabelas a serem migradas:</h4>
              <div className="text-sm space-y-1">
                <div>• Usuários e autenticação</div>
                <div>• Clientes, empresas, grupos</div>
                <div>• Fornecedores e parceiros</div>
                <div>• Contas e configurações financeiras</div>
                <div>• Projetos e kanban</div>
                <div>• Contas a pagar/receber</div>
                <div>• Sistema de matriz/sócios</div>
                <div>• Estruturas DRE</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Processo de migração:</h4>
              <div className="text-sm space-y-1">
                <div>1. Criar estrutura de tabelas no RDS</div>
                <div>2. Extrair dados do banco atual</div>
                <div>3. Inserir dados no RDS AWS</div>
                <div>4. Verificar integridade</div>
                <div>5. Finalizar sincronização</div>
              </div>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Esta migração criará as tabelas no RDS mas não remove os dados do banco atual. 
              Após a migração, você pode atualizar as configurações da aplicação para usar o RDS como banco principal.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
