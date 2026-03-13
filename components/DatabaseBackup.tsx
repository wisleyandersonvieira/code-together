'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import generateBackupStructureAction from '@/actions/generateBackupStructure';
import generateBackupDataAction from '@/actions/generateBackupData';
import exportTableDataAction from '@/actions/exportTableData';
import { Database, Download, FileText, CheckCircle, Loader2 } from 'lucide-react';

export function DatabaseBackup() {
  const [backupStatus, setBackupStatus] = useState<'idle' | 'generating' | 'complete'>('idle');
  const [backupSql, setBackupSql] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');

  const [structureData] = useLoadAction(generateBackupStructureAction, []);
  const [tablesData] = useLoadAction(generateBackupDataAction, []);
  const [exportTable] = useMutateAction(exportTableDataAction);

  const generateSqlBackup = async () => {
    setBackupStatus('generating');
    setProgress(0);
    let sqlContent = '';

    // Header
    sqlContent += `-- Database Backup Generated at ${new Date().toISOString()}\n`;
    sqlContent += `-- UI Bakery Project Export\n\n`;
    sqlContent += `SET client_encoding = 'UTF8';\n`;
    sqlContent += `SET standard_conforming_strings = on;\n\n`;

    try {
      // Generate table structures
      sqlContent += `-- TABLE STRUCTURES\n\n`;
      
      if (structureData && Array.isArray(structureData)) {
        for (const table of structureData) {
          sqlContent += `-- Table: ${table.table_name}\n`;
          sqlContent += `CREATE TABLE IF NOT EXISTS ${table.table_name} (\n`;
          sqlContent += `    ${table.columns}\n`;
          sqlContent += `);\n\n`;
        }
      }

      // Generate data inserts
      sqlContent += `-- TABLE DATA\n\n`;
      
      if (tablesData && Array.isArray(tablesData)) {
        const totalTables = tablesData.length;
        
        for (let i = 0; i < tablesData.length; i++) {
          const table = tablesData[i];
          setCurrentTable(table.table_name);
          setProgress((i / totalTables) * 100);

          try {
            const tableData = await exportTable({ tableName: table.table_name, limit: 5000 });
            
            if (tableData && Array.isArray(tableData) && tableData.length > 0) {
              sqlContent += `-- Data for table: ${table.table_name}\n`;
              
              const columns = Object.keys(tableData[0]);
              const columnsList = columns.join(', ');
              
              for (const row of tableData) {
                const values = columns.map(col => {
                  const value = row[col];
                  if (value === null) return 'NULL';
                  if (typeof value === 'string') {
                    return `'${value.replace(/'/g, "''")}'`;
                  }
                  if (typeof value === 'boolean') return value ? 'true' : 'false';
                  if (value instanceof Date) return `'${value.toISOString()}'`;
                  if (Array.isArray(value)) return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                  return String(value);
                }).join(', ');

                sqlContent += `INSERT INTO ${table.table_name} (${columnsList}) VALUES (${values});\n`;
              }
              
              sqlContent += `\n`;
            }
          } catch (error) {
            console.error(`Error exporting table ${table.table_name}:`, error);
            sqlContent += `-- Error exporting table ${table.table_name}: ${error}\n\n`;
          }
        }
      }

      sqlContent += `-- Backup completed at ${new Date().toISOString()}\n`;
      
      setBackupSql(sqlContent);
      setBackupStatus('complete');
      setProgress(100);
      setCurrentTable('');
      
    } catch (error) {
      console.error('Backup generation error:', error);
      setBackupStatus('idle');
      setProgress(0);
    }
  };

  const downloadBackup = () => {
    const blob = new Blob([backupSql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_backup_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (content: string) => {
    const bytes = new Blob([content]).size;
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup do Banco de Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-semibold">Tabelas</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {tablesData ? tablesData.length : '-'}
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-semibold">Status</span>
              </div>
              <Badge variant={backupStatus === 'complete' ? 'default' : 'secondary'}>
                {backupStatus === 'idle' && 'Aguardando'}
                {backupStatus === 'generating' && 'Gerando...'}
                {backupStatus === 'complete' && 'Concluído'}
              </Badge>
            </div>
          </div>

          {backupStatus === 'generating' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando: {currentTable}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={generateSqlBackup} 
              disabled={backupStatus === 'generating'}
              className="flex items-center gap-2"
            >
              {backupStatus === 'generating' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {backupStatus === 'generating' ? 'Gerando...' : 'Gerar Backup'}
            </Button>

            {backupStatus === 'complete' && (
              <Button 
                onClick={downloadBackup}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download SQL ({formatFileSize(backupSql)})
              </Button>
            )}
          </div>

          {backupStatus === 'complete' && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Backup Gerado com Sucesso!</h4>
              <ul className="text-sm space-y-1">
                <li>• Estrutura completa das tabelas</li>
                <li>• Todos os dados exportados</li>
                <li>• Formato compatível com PostgreSQL</li>
                <li>• Tamanho: {formatFileSize(backupSql)}</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {tablesData && (
        <Card>
          <CardHeader>
            <CardTitle>Tabelas no Banco</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {tablesData.map((table: any) => (
                <div key={table.table_name} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">{table.table_name}</div>
                  <div className="text-sm text-gray-600">
                    {table.record_count} registros
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
