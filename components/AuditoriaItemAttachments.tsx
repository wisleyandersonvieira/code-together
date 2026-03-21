'use client';

import { useMemo, useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Download, FileText, Image, Paperclip, Trash2, Upload } from 'lucide-react';

import deleteFileAction from '@/actions/deleteFile';
import getFileAction from '@/actions/getFile';
import uploadFileAction from '@/actions/uploadFile';
import { FinanceActionButton } from '@/components/finance/listing-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { AuditoriaItemAttachment } from '@/utils/auditoria-fornecedores';

const acceptedTypes = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
const maxFileSize = 10 * 1024 * 1024;

interface AuditoriaItemAttachmentsProps {
  itemId?: number;
  files: AuditoriaItemAttachment[];
  pendingFiles: File[];
  onUploadedFile?: (file: AuditoriaItemAttachment) => void;
  onDeletedFile?: (fileId: number) => void;
  onPendingFilesChange: (files: File[]) => void;
  readOnly?: boolean;
}

export function AuditoriaItemAttachments({
  itemId,
  files,
  pendingFiles,
  onUploadedFile,
  onDeletedFile,
  onPendingFilesChange,
  readOnly = false,
}: AuditoriaItemAttachmentsProps) {
  const { toast } = useToast();
  const [uploadFile, isUploading] = useMutateAction(uploadFileAction);
  const [deleteFile] = useMutateAction(deleteFileAction);
  const [getFile] = useMutateAction(getFileAction);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const visibleFiles = useMemo(
    () => [
      ...files,
      ...pendingFiles.map((file) => ({
        filename: file.name,
        file_size: file.size,
        content_type: file.type,
      })),
    ],
    [files, pendingFiles],
  );

  const fileToBase64 = async (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSelectFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';

    if (selectedFiles.length === 0) {
      return;
    }

    for (const file of selectedFiles) {
      if (file.size > maxFileSize) {
        toast({
          description: `O arquivo ${file.name} excede o limite de 10 MB.`,
          variant: 'destructive',
        });
        continue;
      }

      if (!itemId) {
        onPendingFilesChange([...pendingFiles, file]);
        continue;
      }

      try {
        const fileData = await fileToBase64(file);
        const result = await uploadFile({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          fileData,
          entityType: 'auditoria_item',
          entityId: itemId,
        });

        const uploadedFile = result?.[0];
        if (uploadedFile) {
          onUploadedFile?.({
            id: uploadedFile.id,
            filename: uploadedFile.filename,
            file_size: uploadedFile.file_size,
            content_type: uploadedFile.content_type,
          });
        }

        toast({ description: `Arquivo ${file.name} enviado com sucesso.` });
      } catch {
        toast({
          description: `Não foi possível enviar ${file.name}.`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      setDownloadingId(fileId);
      const result = await getFile({ fileId });
      const fileData = result?.[0];

      if (!fileData?.file_data) {
        throw new Error('Arquivo não encontrado');
      }

      const base64Data = fileData.file_data.startsWith('data:')
        ? fileData.file_data.split(',')[1]
        : fileData.file_data;

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: fileData.content_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        description: `Não foi possível baixar ${filename}.`,
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachment: AuditoriaItemAttachment, pendingIndex?: number) => {
    if (pendingIndex != null) {
      onPendingFilesChange(pendingFiles.filter((_, index) => index !== pendingIndex));
      return;
    }

    if (!attachment.id) {
      return;
    }

    try {
      setDeletingId(attachment.id);
      await deleteFile({ fileId: attachment.id });
      onDeletedFile?.(attachment.id);
      toast({ description: `Arquivo ${attachment.filename} excluído com sucesso.` });
    } catch {
      toast({
        description: `Não foi possível excluir ${attachment.filename}.`,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getIcon = (contentType?: string) => {
    if (contentType?.startsWith('image/')) {
      return <Image className="h-3.5 w-3.5 text-sky-600" />;
    }

    return <FileText className="h-3.5 w-3.5 text-slate-500" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-100 text-slate-700">
          <Paperclip className="mr-1 h-3 w-3" />
          {visibleFiles.length}
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
                {itemId ? 'Upload' : 'Anexar'}
              </span>
            </Button>
          </label>
        ) : null}
      </div>

      <div className="space-y-1.5">
        {visibleFiles.length === 0 ? (
          <p className="text-xs text-slate-400">Sem anexos.</p>
        ) : null}

        {files.map((file) => (
          <div
            key={`saved-${file.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              {getIcon(file.content_type)}
              <span className="truncate text-xs font-medium text-slate-700" title={file.filename}>
                {file.filename}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <FinanceActionButton
                icon={Download}
                title={downloadingId === file.id ? 'Baixando...' : 'Baixar'}
                onClick={() => file.id && handleDownload(file.id, file.filename)}
                tone="neutral"
              />
              {!readOnly ? (
                <FinanceActionButton
                  icon={Trash2}
                  title={deletingId === file.id ? 'Excluindo...' : 'Excluir'}
                  onClick={() => handleDelete(file)}
                  tone="danger"
                />
              ) : null}
            </div>
          </div>
        ))}

        {pendingFiles.map((file, index) => (
          <div
            key={`pending-${file.name}-${index}`}
            className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-2.5 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              {getIcon(file.type)}
              <span className="truncate text-xs font-medium text-slate-700" title={file.name}>
                {file.name}
              </span>
            </div>
            {!readOnly ? (
              <FinanceActionButton
                icon={Trash2}
                title="Remover"
                onClick={() => handleDelete({ filename: file.name }, index)}
                tone="danger"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
