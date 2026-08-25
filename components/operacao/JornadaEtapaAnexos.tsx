'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';

import deleteFileAction from '@/actions/deleteFile';
import getFileAction from '@/actions/getFile';
import loadFilesByEntityAction from '@/actions/loadFilesByEntity';
import uploadFileAction from '@/actions/uploadFile';
import { FinanceActionButton } from '@/components/finance/listing-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const acceptedTypes = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.xml,.txt,.zip';
const maxFileSize = 10 * 1024 * 1024;

/** Namespace usado na tabela `files` para os anexos de etapa da jornada. */
export const jornadaItemEntityType = 'jornada_item';

interface JornadaEtapaAnexosProps {
  itemId: number;
  readOnly?: boolean;
  onChange?: () => void;
}

interface AnexoRow {
  id: number;
  filename: string;
  content_type?: string | null;
  file_size?: number | string | null;
}

function formatSize(size?: number | string | null) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JornadaEtapaAnexos({ itemId, readOnly = false, onChange }: JornadaEtapaAnexosProps) {
  const { toast } = useToast();
  const [anexos, loading, , refresh] = useLoadAction(loadFilesByEntityAction, [], {
    entityType: jornadaItemEntityType,
    entityId: itemId,
  });
  const [uploadFile, isUploading] = useMutateAction(uploadFileAction);
  const [deleteFile] = useMutateAction(deleteFileAction);
  const [getFile] = useMutateAction(getFileAction);
  const [busyId, setBusyId] = useState<number | null>(null);

  const lista: AnexoRow[] = Array.isArray(anexos) ? anexos : [];

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSelectFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';

    for (const file of selected) {
      if (file.size > maxFileSize) {
        toast({ description: `O arquivo ${file.name} excede o limite de 10 MB.`, variant: 'destructive' });
        continue;
      }

      try {
        const fileData = await fileToBase64(file);
        await uploadFile({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          fileData,
          entityType: jornadaItemEntityType,
          entityId: itemId,
        });
        toast({ description: `Arquivo ${file.name} anexado à etapa.` });
      } catch {
        toast({ description: `Não foi possível enviar ${file.name}.`, variant: 'destructive' });
      }
    }

    refresh();
    onChange?.();
  };

  const handleDownload = async (anexo: AnexoRow) => {
    try {
      setBusyId(anexo.id);
      const result = await getFile({ fileId: anexo.id });
      const fileData = result?.[0];

      if (!fileData?.file_data) {
        throw new Error('Arquivo não encontrado');
      }

      const base64Data = String(fileData.file_data).startsWith('data:')
        ? String(fileData.file_data).split(',')[1]
        : String(fileData.file_data);

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: fileData.content_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = anexo.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({ description: `Não foi possível baixar ${anexo.filename}.`, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (anexo: AnexoRow) => {
    if (!window.confirm(`Excluir o anexo "${anexo.filename}"?`)) return;

    try {
      setBusyId(anexo.id);
      await deleteFile({ fileId: anexo.id });
      toast({ description: `Anexo ${anexo.filename} excluído.` });
      refresh();
      onChange?.();
    } catch {
      toast({ description: `Não foi possível excluir ${anexo.filename}.`, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-100 text-slate-700">
          <Paperclip className="mr-1 h-3 w-3" />
          {lista.length}
        </Badge>
        {!readOnly ? (
          <label className="cursor-pointer">
            <input className="hidden" type="file" multiple accept={acceptedTypes} onChange={handleSelectFiles} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploading}
              className="h-8 rounded-lg border-slate-200 px-2.5 text-xs"
              asChild
            >
              <span>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {isUploading ? 'Enviando...' : 'Anexar'}
              </span>
            </Button>
          </label>
        ) : null}
      </div>

      {loading && lista.length === 0 ? (
        <p className="text-xs text-slate-400">Carregando anexos...</p>
      ) : lista.length === 0 ? (
        <p className="text-xs text-slate-400">Sem anexos nesta etapa.</p>
      ) : (
        <div className="space-y-1.5">
          {lista.map((anexo) => (
            <div
              key={anexo.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {anexo.content_type?.startsWith('image/') ? (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                )}
                <span className="truncate text-xs font-medium text-slate-700" title={anexo.filename}>
                  {anexo.filename}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatSize(anexo.file_size)}</span>
              </div>
              <div className="flex items-center gap-1">
                <FinanceActionButton
                  icon={Download}
                  title={busyId === anexo.id ? 'Aguarde...' : 'Baixar'}
                  onClick={() => handleDownload(anexo)}
                  tone="neutral"
                />
                {!readOnly ? (
                  <FinanceActionButton
                    icon={Trash2}
                    title="Excluir anexo"
                    onClick={() => handleDelete(anexo)}
                    tone="danger"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
