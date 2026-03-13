'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { RefreshCw, CheckCircle, AlertTriangle, Loader2, Server, Zap } from 'lucide-react';
import { useMigrationActions } from '@/hooks/use-migration-actions';
import getLastSyncTimeAction from '@/actions/incremental/getLastSyncTime';
import updateLastSyncTimeAction from '@/actions/incremental/updateLastSyncTime';
import getUsersModifiedAction from '@/actions/incremental/getUsersModified';
import getClientesModifiedAction from '@/actions/incremental/getClientesModified';
import getEmpresasModifiedAction from '@/actions/incremental/getEmpresasModified';
import getProjetosModifiedAction from '@/actions/incremental/getProjetosModified';
import getContasModifiedAction from '@/actions/incremental/getContasModified';
import getAportesModifiedAction from '@/actions/incremental/getAportesModified';
import getAllUsersIdsAction from '@/actions/incremental/getAllUsersIds';
import getAllClientesIdsAction from '@/actions/incremental/getAllClientesIds';
import getAllEmpresasIdsAction from '@/actions/incremental/getAllEmpresasIds';
import getAllProjetosIdsAction from '@/actions/incremental/getAllProjetosIds';
import getAllContasIdsAction from '@/actions/incremental/getAllContasIds';
import getAllAportesIdsAction from '@/actions/incremental/getAllAportesIds';
import deleteRemovedRecordsAction from '@/actions/incremental/deleteRemovedRecords';
import getRetiradasModifiedAction from '@/actions/incremental/getRetiradasModified';
import getContasPagarProjetosModifiedAction from '@/actions/incremental/getContasPagarProjetosModified';
import getContasReceberProjetosModifiedAction from '@/actions/incremental/getContasReceberProjetosModified';
import getAllRetiradasIdsAction from '@/actions/incremental/getAllRetiradasIds';
import getAllContasPagarProjetosIdsAction from '@/actions/incremental/getAllContasPagarProjetosIds';
import getAllContasReceberProjetosIdsAction from '@/actions/incremental/getAllContasReceberProjetosIds';
import getGruposContabeisModifiedAction from '@/actions/incremental/getGruposContabeisModified';
import getSubgruposContabeisModifiedAction from '@/actions/incremental/getSubgruposContabeisModified';
import getAllGruposContabeisIdsAction from '@/actions/incremental/getAllGruposContabeisIds';
import getAllSubgruposContabeisIdsAction from '@/actions/incremental/getAllSubgruposContabeisIds';
import getOrcamentosModifiedAction from '@/actions/incremental/getOrcamentosModified';
import getPrevisaoAportesModifiedAction from '@/actions/incremental/getPrevisaoAportesModified';
import getRateioAportesModifiedAction from '@/actions/incremental/getRateioAportesModified';
import getMatrizSociosModifiedAction from '@/actions/incremental/getMatrizSociosModified';
import getProjetoColumnHistoryModifiedAction from '@/actions/incremental/getProjetoColumnHistoryModified';
import getContaPagarOrcamentoAlocacaoModifiedAction from '@/actions/incremental/getContaPagarOrcamentoAlocacaoModified';
import getAllOrcamentosIdsAction from '@/actions/incremental/getAllOrcamentosIds';
import getAllPrevisaoAportesIdsAction from '@/actions/incremental/getAllPrevisaoAportesIds';
import getAllRateioAportesIdsAction from '@/actions/incremental/getAllRateioAportesIds';
import getAllMatrizSociosIdsAction from '@/actions/incremental/getAllMatrizSociosIds';
import getAllProjetoColumnHistoryIdsAction from '@/actions/incremental/getAllProjetoColumnHistoryIds';
import getAllContaPagarOrcamentoAlocacaoIdsAction from '@/actions/incremental/getAllContaPagarOrcamentoAlocacaoIds';

type SyncStep = 'idle' | 'checking' | 'syncing' | 'complete' | 'error';

export function IncrementalSync() {
  const [syncStep, setSyncStep] = useState<SyncStep>('idle');
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<{ total: number; synced: number }>({ total: 0, synced: 0 });

  const actions = useMigrationActions();
  const [updateLastSync] = useMutateAction(updateLastSyncTimeAction);
  const [getUsersModified] = useMutateAction(getUsersModifiedAction);
  const [getClientesModified] = useMutateAction(getClientesModifiedAction);
  const [getEmpresasModified] = useMutateAction(getEmpresasModifiedAction);
  const [getProjetosModified] = useMutateAction(getProjetosModifiedAction);
  const [getContasModified] = useMutateAction(getContasModifiedAction);
  const [getAportesModified] = useMutateAction(getAportesModifiedAction);
  const [getAllUsersIds] = useMutateAction(getAllUsersIdsAction);
  const [getAllClientesIds] = useMutateAction(getAllClientesIdsAction);
  const [getAllEmpresasIds] = useMutateAction(getAllEmpresasIdsAction);
  const [getAllProjetosIds] = useMutateAction(getAllProjetosIdsAction);
  const [getAllContasIds] = useMutateAction(getAllContasIdsAction);
  const [getAllAportesIds] = useMutateAction(getAllAportesIdsAction);
  const [deleteRemovedRecords] = useMutateAction(deleteRemovedRecordsAction);
  const [getRetiradasModified] = useMutateAction(getRetiradasModifiedAction);
  const [getContasPagarProjetosModified] = useMutateAction(getContasPagarProjetosModifiedAction);
  const [getContasReceberProjetosModified] = useMutateAction(getContasReceberProjetosModifiedAction);
  const [getAllRetiradasIds] = useMutateAction(getAllRetiradasIdsAction);
  const [getAllContasPagarProjetosIds] = useMutateAction(getAllContasPagarProjetosIdsAction);
  const [getAllContasReceberProjetosIds] = useMutateAction(getAllContasReceberProjetosIdsAction);
  const [getGruposContabeisModified] = useMutateAction(getGruposContabeisModifiedAction);
  const [getSubgruposContabeisModified] = useMutateAction(getSubgruposContabeisModifiedAction);
  const [getAllGruposContabeisIds] = useMutateAction(getAllGruposContabeisIdsAction);
  const [getAllSubgruposContabeisIds] = useMutateAction(getAllSubgruposContabeisIdsAction);
  const [getOrcamentosModified] = useMutateAction(getOrcamentosModifiedAction);
  const [getPrevisaoAportesModified] = useMutateAction(getPrevisaoAportesModifiedAction);
  const [getRateioAportesModified] = useMutateAction(getRateioAportesModifiedAction);
  const [getMatrizSociosModified] = useMutateAction(getMatrizSociosModifiedAction);
  const [getProjetoColumnHistoryModified] = useMutateAction(getProjetoColumnHistoryModifiedAction);
  const [getContaPagarOrcamentoAlocacaoModified] = useMutateAction(getContaPagarOrcamentoAlocacaoModifiedAction);
  const [getAllOrcamentosIds] = useMutateAction(getAllOrcamentosIdsAction);
  const [getAllPrevisaoAportesIds] = useMutateAction(getAllPrevisaoAportesIdsAction);
  const [getAllRateioAportesIds] = useMutateAction(getAllRateioAportesIdsAction);
  const [getAllMatrizSociosIds] = useMutateAction(getAllMatrizSociosIdsAction);
  const [getAllProjetoColumnHistoryIds] = useMutateAction(getAllProjetoColumnHistoryIdsAction);
  const [getAllContaPagarOrcamentoAlocacaoIds] = useMutateAction(getAllContaPagarOrcamentoAlocacaoIdsAction);

  // Load last sync time
  const [lastSyncData] = useLoadAction(getLastSyncTimeAction, []);
  const lastSyncTime = lastSyncData?.[0]?.last_sync;

  const addLog = (message: string) => {
    setSyncLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const tablesToSync = [
    { name: 'users', getter: getUsersModified, inserter: actions.insertUserSimple, idsGetter: getAllUsersIds },
    { name: 'clientes', getter: getClientesModified, inserter: actions.insertClienteSimple, idsGetter: getAllClientesIds },
    { name: 'empresas', getter: getEmpresasModified, inserter: actions.insertEmpresaSimple, idsGetter: getAllEmpresasIds },
    { name: 'projetos', getter: getProjetosModified, inserter: actions.insertProjetoSimple, idsGetter: getAllProjetosIds },
    { name: 'contas', getter: getContasModified, inserter: actions.insertContaSimple, idsGetter: getAllContasIds },
    { name: 'aportes', getter: getAportesModified, inserter: actions.insertAporteSimple, idsGetter: getAllAportesIds },
    { name: 'retiradas', getter: getRetiradasModified, inserter: actions.insertRetiradasSimple, idsGetter: getAllRetiradasIds },
    { name: 'contas_pagar_projetos', getter: getContasPagarProjetosModified, inserter: actions.insertContaPagarProjetoSimple, idsGetter: getAllContasPagarProjetosIds },
    { name: 'contas_receber_projetos', getter: getContasReceberProjetosModified, inserter: actions.insertContaReceberProjetoSimple, idsGetter: getAllContasReceberProjetosIds },
    { name: 'grupos_contabeis', getter: getGruposContabeisModified, inserter: actions.insertGrupoContabilSimple, idsGetter: getAllGruposContabeisIds },
    { name: 'subgrupos_contabeis', getter: getSubgruposContabeisModified, inserter: actions.insertSubgrupoContabilSimple, idsGetter: getAllSubgruposContabeisIds },
    { name: 'orcamentos', getter: getOrcamentosModified, inserter: actions.insertOrcamentoSimple, idsGetter: getAllOrcamentosIds },
    { name: 'previsao_aportes', getter: getPrevisaoAportesModified, inserter: actions.insertPrevisaoAporteSimple, idsGetter: getAllPrevisaoAportesIds },
    { name: 'rateio_aportes', getter: getRateioAportesModified, inserter: actions.insertRateioAporteSimple, idsGetter: getAllRateioAportesIds },
    { name: 'matriz_socios', getter: getMatrizSociosModified, inserter: actions.insertMatrizSocioSimple, idsGetter: getAllMatrizSociosIds },
    { name: 'projeto_column_history', getter: getProjetoColumnHistoryModified, inserter: actions.insertProjetoColumnHistorySimple, idsGetter: getAllProjetoColumnHistoryIds },
    { name: 'conta_pagar_orcamento_alocacao', getter: getContaPagarOrcamentoAlocacaoModified, inserter: actions.insertContaPagarOrcamentoAlocacaoSimple, idsGetter: getAllContaPagarOrcamentoAlocacaoIds }
  ];

  const startSync = async () => {
    try {
      setSyncStep('checking');
      setError(null);
      setProgress(0);
      setSyncLog([]);
      setSyncStats({ total: 0, synced: 0 });

      addLog('🔄 Iniciando sincronização incremental');
      
      if (lastSyncTime && lastSyncTime !== '' && !isNaN(new Date(lastSyncTime).getTime())) {
        addLog(`📅 Última sincronização: ${new Date(lastSyncTime).toLocaleString()}`);
      } else {
        addLog('📅 Primeira sincronização - todos os registros serão considerados');
      }

      // Check which tables have modifications
      let totalRecordsToSync = 0;
      const tablesToProcess = [];

      for (const table of tablesToSync) {
        try {
          // Only pass lastSync if it's a valid timestamp
          const validLastSync = lastSyncTime && lastSyncTime !== '' && !isNaN(new Date(lastSyncTime).getTime()) 
            ? lastSyncTime 
            : null;
            
          const modifiedData = await table.getter({ 
            lastSync: validLastSync,
            limit: 1000
          });
          
          const recordCount = modifiedData?.length || 0;
          if (recordCount > 0) {
            tablesToProcess.push({ ...table, recordCount, data: modifiedData });
            totalRecordsToSync += recordCount;
            addLog(`📊 ${table.name}: ${recordCount} registro(s) modificado(s)`);
          } else {
            addLog(`✅ ${table.name}: nenhum registro modificado`);
          }
        } catch (error) {
          addLog(`⚠ Erro ao verificar ${table.name}: ${error.message}`);
        }
      }

      setSyncStats({ total: totalRecordsToSync, synced: 0 });

      if (totalRecordsToSync === 0) {
        addLog('✅ Nenhum dado modificado encontrado - banco já está sincronizado');
        setSyncStep('complete');
        return;
      }

      addLog(`🎯 Total de ${totalRecordsToSync} registro(s) serão sincronizados em ${tablesToProcess.length} tabela(s)`);
      setSyncStep('syncing');

      // Sync modified records
      let totalSynced = 0;
      
      for (let i = 0; i < tablesToProcess.length; i++) {
        const { name: tableName, inserter, recordCount, data: modifiedData } = tablesToProcess[i];
        setCurrentTable(tableName);
        
        try {
          addLog(`🔄 Sincronizando ${tableName}...`);
          
          if (modifiedData && modifiedData.length > 0) {
            let tableSynced = 0;
            
            for (const record of modifiedData) {
              try {
                const cleanRecord = Object.fromEntries(
                  Object.entries(record).map(([key, value]) => [
                    key, 
                    value === null || value === undefined ? null : value
                  ])
                );
                
                await inserter(cleanRecord);
                tableSynced++;
                totalSynced++;
                
                setSyncStats({ total: totalRecordsToSync, synced: totalSynced });
                setProgress((totalSynced / totalRecordsToSync) * 90);
                
                // Small delay between records
                await new Promise(resolve => setTimeout(resolve, 10));
              } catch (recordError) {
                addLog(`⚠ Erro ao sincronizar registro ${record.id} em ${tableName}: ${recordError.message}`);
              }
            }
            
            addLog(`✅ ${tableName}: ${tableSynced}/${recordCount} registros sincronizados`);
          }
        } catch (tableError) {
          addLog(`❌ Erro na tabela ${tableName}: ${tableError.message}`);
        }
      }

      // Check for deleted records
      setProgress(92);
      addLog('🗑️ Verificando registros excluídos...');
      let totalDeleted = 0;
      
      for (const table of tablesToSync) {
        try {
          const sourceIds = await table.idsGetter({});
          const existingIds = sourceIds?.map(row => row.id) || [];
          
          if (existingIds.length > 0) {
            await deleteRemovedRecords({
              tableName: table.name,
              existingIds: existingIds
            });
            
            // Note: We can't easily get the count of deleted records, but this ensures cleanup
            addLog(`🗑️ ${table.name}: registros órfãos removidos do destino`);
          }
        } catch (deleteError) {
          addLog(`⚠ Erro ao limpar ${table.name}: ${deleteError.message}`);
        }
      }

      // Update last sync time
      setProgress(95);
      addLog('🕒 Atualizando timestamp da última sincronização...');
      const currentTimestamp = new Date().toISOString();
      await updateLastSync({ currentTimestamp });
      
      setProgress(100);
      setSyncStep('complete');
      setCurrentTable('');
      addLog(`🎉 Sincronização concluída! ${totalSynced} registros sincronizados, exclusões processadas`);

    } catch (err) {
      setSyncStep('error');
      setError(err?.message || 'Erro desconhecido na sincronização');
      addLog(`❌ Erro: ${err?.message}`);
    }
  };

  const resetSync = () => {
    setSyncStep('idle');
    setProgress(0);
    setCurrentTable('');
    setSyncLog([]);
    setError(null);
    setSyncStats({ total: 0, synced: 0 });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Sincronização Incremental RDS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <RefreshCw className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="font-semibold">Origem</div>
              <div className="text-sm text-gray-600">UI Bakery Hosted</div>
              <Badge variant="secondary">
                {lastSyncTime && lastSyncTime !== '' && !isNaN(new Date(lastSyncTime).getTime()) 
                  ? 'Sincronizado' 
                  : 'Nunca sincronizado'}
              </Badge>
            </div>

            <div className="flex items-center justify-center">
              <Zap className="h-8 w-8 text-yellow-400" />
            </div>

            <div className="p-4 bg-green-50 rounded-lg text-center">
              <Server className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="font-semibold">Destino</div>
              <div className="text-sm text-gray-600">RDS AWS</div>
              <Badge variant={syncStep === 'complete' ? 'default' : 'outline'}>
                {syncStep === 'complete' ? 'Atualizado' : 'Pendente'}
              </Badge>
            </div>
          </div>

          {lastSyncTime && lastSyncTime !== '' && !isNaN(new Date(lastSyncTime).getTime()) && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Última sincronização:</strong> {new Date(lastSyncTime).toLocaleString()}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {syncStep !== 'idle' && syncStep !== 'complete' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {syncStep === 'checking' && 'Verificando modificações...'}
                  {syncStep === 'syncing' && `Sincronizando: ${currentTable}`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              
              {syncStats.total > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  {syncStats.synced} de {syncStats.total} registros sincronizados
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {syncStep === 'idle' && (
              <Button onClick={startSync} className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Sincronizar Alterações
              </Button>
            )}

            {(syncStep === 'checking' || syncStep === 'syncing') && (
              <Button disabled className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </Button>
            )}

            {(syncStep === 'complete' || syncStep === 'error') && (
              <Button onClick={resetSync} variant="outline">
                Nova Sincronização
              </Button>
            )}
          </div>

          {syncStep === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Sincronização incremental concluída! Apenas dados modificados foram atualizados no RDS.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {syncLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Log da Sincronização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded font-mono text-sm space-y-1">
              {syncLog.map((log, index) => (
                <div key={index} className={
                  log.includes('✅') || log.includes('🎉') ? 'text-green-600' :
                  log.includes('⚠') ? 'text-yellow-600' :
                  log.includes('❌') ? 'text-red-600' :
                  log.includes('🔄') || log.includes('🎯') ? 'text-blue-600' :
                  log.includes('📅') || log.includes('📊') ? 'text-purple-600' :
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
          <CardTitle>Sobre a Sincronização Incremental</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-green-600">✅ Vantagens:</h4>
              <div className="text-sm space-y-1">
                <div>• Muito mais rápida que migração completa</div>
                <div>• Sincroniza apenas dados modificados</div>
                <div>• Detecta e remove registros excluídos</div>
                <div>• Ideal para atualizações frequentes</div>
                <div>• Preserva recursos e tempo</div>
                <div>• Rastreamento automático de modificações</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-blue-600">⚙️ Como funciona:</h4>
              <div className="text-sm space-y-1">
                <div>1. Verifica última sincronização</div>
                <div>2. Identifica registros modificados</div>
                <div>3. Sincroniza apenas alterações</div>
                <div>4. Remove registros excluídos</div>
                <div>5. Atualiza timestamp de controle</div>
                <div>6. Mantém bancos em sincronia</div>
              </div>
            </div>
          </div>

          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              <strong>Recomendado:</strong> Use este método para manter seus dados atualizados regularmente. 
              É muito mais eficiente que refazer a migração completa toda vez e agora inclui detecção de exclusões.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
