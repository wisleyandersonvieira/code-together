'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FolderArchive, CheckCircle, Loader2, AlertCircle, FileCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DIRS_PREVIEW = ['app/', 'components/', 'actions/', 'hooks/', 'lib/', 'migrations/', 'types/', 'utils/', 'scripts/', 'docs/'];
const FILES_PREVIEW = ['package.json', 'vite.config.ts', 'tailwind.config.js', 'tsconfig.json', 'index.html', 'index.css'];

export function ExportProject() {
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'loading' | 'zipping' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ files: 0, size: 0 });

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-24), msg]);

  const handleExport = async () => {
    setStatus('loading');
    setProgress(0);
    setLog([]);
    setStats({ files: 0, size: 0 });

    try {
      addLog('Conectando ao servidor...');

      // Fetch all project files from the Vite dev server plugin
      const res = await fetch('/__project_files', { cache: 'no-store' });

      if (!res.ok) {
        throw new Error(`Endpoint não disponível (${res.status}). Certifique-se de estar em modo de desenvolvimento.`);
      }

      const data = await res.json() as { files: Record<string, string>; fileCount: number };
      const files = data.files;
      const fileNames = Object.keys(files);

      addLog(`✓ ${fileNames.length} arquivos encontrados`);
      setProgress(20);
      setStatus('zipping');

      addLog('Importando JSZip...');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      setProgress(30);
      addLog('Adicionando arquivos ao ZIP...');

      let processed = 0;
      for (const [filePath, content] of Object.entries(files)) {
        zip.file(filePath, content);
        processed++;
        if (processed % 20 === 0) {
          const pct = 30 + Math.round((processed / fileNames.length) * 50);
          setProgress(pct);
          addLog(`  ${processed}/${fileNames.length} arquivos processados...`);
        }
      }

      addLog(`✓ ${fileNames.length} arquivos adicionados ao ZIP`);
      setProgress(82);

      addLog('Comprimindo ZIP...');
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          setProgress(82 + Math.round(meta.percent * 0.15));
        }
      );

      setProgress(98);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `provison-source-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      setStats({ files: fileNames.length, size: blob.size });
      addLog(`\n✅ ZIP gerado! ${fileNames.length} arquivos, ${sizeMB} MB`);
      setProgress(100);
      setStatus('done');

      toast({ title: 'Export concluído!', description: `${fileNames.length} arquivos · ${sizeMB} MB` });
    } catch (err) {
      console.error('Export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      addLog(`❌ Erro: ${msg}`);
      toast({ title: 'Erro no export', description: msg, variant: 'destructive' });
    }
  };

  const reset = () => { setStatus('idle'); setProgress(0); setLog([]); };

  const isRunning = status === 'loading' || status === 'zipping';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Exportar Código Fonte</h2>
        <p className="text-muted-foreground">Faça download do código fonte completo para subir no GitHub</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5" />
              Download do Projeto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gera um arquivo <strong>.zip</strong> com todo o código fonte do projeto, pronto para versionar no GitHub.
            </p>

            {/* Progress */}
            {status !== 'idle' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {status === 'loading' && 'Carregando arquivos...'}
                    {status === 'zipping' && 'Comprimindo...'}
                    {status === 'done' && `Concluído · ${stats.files} arquivos · ${(stats.size / 1024 / 1024).toFixed(2)} MB`}
                    {status === 'error' && 'Erro'}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-200 ${
                      status === 'error' ? 'bg-red-500' :
                      status === 'done' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Log Terminal */}
            {log.length > 0 && (
              <div className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-3 h-40 overflow-y-auto">
                {log.map((line, i) => <div key={i}>{line}</div>)}
                {isRunning && <div className="animate-pulse">▋</div>}
              </div>
            )}

            {status === 'done' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-800">Download iniciado! Verifique sua pasta de downloads.</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-800">Verifique se o app está rodando em modo de desenvolvimento no UI Bakery.</p>
              </div>
            )}

            <div className="flex gap-2">
              {!isRunning && status !== 'done' && (
                <Button onClick={handleExport} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar e Baixar ZIP
                </Button>
              )}
              {isRunning && (
                <Button disabled className="flex-1">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {status === 'loading' ? 'Carregando...' : `Comprimindo... ${progress}%`}
                </Button>
              )}
              {status === 'done' && (
                <>
                  <Button onClick={handleExport} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Novamente
                  </Button>
                  <Button onClick={reset} variant="ghost">Resetar</Button>
                </>
              )}
              {status === 'error' && (
                <Button onClick={handleExport} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conteúdo do ZIP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">DIRETÓRIOS</p>
              <div className="grid grid-cols-2 gap-1">
                {DIRS_PREVIEW.map(d => (
                  <div key={d} className="flex items-center gap-1 text-xs">
                    <FileCode className="h-3 w-3 text-blue-500" />
                    {d}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">ARQUIVOS DE CONFIGURAÇÃO</p>
              <div className="grid grid-cols-2 gap-1">
                {FILES_PREVIEW.map(f => (
                  <div key={f} className="flex items-center gap-1 text-xs">
                    <FileCode className="h-3 w-3 text-orange-500" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2 text-xs text-blue-800">
              <p className="font-medium">Como subir no GitHub:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Extraia o ZIP em uma pasta local</li>
                <li>Rode <code className="bg-blue-100 px-1 rounded">git init</code></li>
                <li>Rode <code className="bg-blue-100 px-1 rounded">git add .</code></li>
                <li>Rode <code className="bg-blue-100 px-1 rounded">git commit -m "Initial commit"</code></li>
                <li>Crie o repositório no GitHub e faça push</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
