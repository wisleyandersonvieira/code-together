'use client';

import { useEffect, useRef, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Image, Download, Trash2, Upload, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import uploadFileAction from '@/actions/uploadFile';
import getFileAction from '@/actions/getFile';
import loadFilesByEntityAction from '@/actions/loadFilesByEntity';
import deleteFileAction from '@/actions/deleteFile';
import setProjetoCoverAction from '@/actions/setProjetoCover';

type LoadFile = (params: { fileId: number }) => Promise<any[]>;

// Lazily fetches the image binary only when the card scrolls near the viewport.
function FileThumbnail({
  fileId,
  filename,
  contentType,
  loadFile,
  onOpen,
}: {
  fileId: number;
  filename: string;
  contentType: string;
  loadFile: LoadFile;
  onOpen: (src: string, filename: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const requestedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    loadFile({ fileId })
      .then((rows: any[]) => {
        if (cancelled) return;
        const f = rows?.[0];
        if (f?.file_data) {
          setSrc(
            f.file_data.startsWith('data:')
              ? f.file_data
              : `data:${f.content_type || contentType || 'image/jpeg'};base64,${f.file_data}`
          );
        } else {
          setFailed(true);
        }
      })
      .catch((err) => {
        console.error('Error loading image:', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fileId, contentType, loadFile]);

  return (
    <div
      ref={ref}
      className="h-40 w-full overflow-hidden rounded-lg bg-slate-100"
      onClick={() => src && onOpen(src, filename)}
    >
      {src ? (
        <img
          src={src}
          alt={filename}
          className="h-full w-full cursor-zoom-in object-cover transition-transform hover:scale-105"
          loading="lazy"
        />
      ) : failed ? (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          Não foi possível carregar a imagem
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
    </div>
  );
}


interface FileManagerProps {
  entityType: string;
  entityId: number;
  acceptedTypes?: string;
  title?: string;
  // When true, image files can be marked as the project cover photo.
  enableCover?: boolean;
}

interface ManagedFile {
  id: number;
  filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
  is_cover?: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAcceptedFileType(file: File, acceptedTypes: string): boolean {
  const acceptedEntries = acceptedTypes
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (acceptedEntries.length === 0) return true;

  return acceptedEntries.some((entry) => {
    if (entry.endsWith('/*')) {
      const category = entry.slice(0, -1);
      return file.type.startsWith(category);
    }

    if (entry.startsWith('.')) {
      return file.name.toLowerCase().endsWith(entry.toLowerCase());
    }

    return file.type === entry;
  });
}

export function FileManager({ entityType, entityId, acceptedTypes = "image/*,.pdf,.doc,.docx", title = "Arquivos", enableCover = false }: FileManagerProps) {
  const { toast } = useToast();
  const [files, loading, error, refreshFiles] = useLoadAction(
    loadFilesByEntityAction,
    [],
    { entityType, entityId }
  );
  const [uploadFile, isUploading] = useMutateAction(uploadFileAction);
  const [deleteFile, isDeleting] = useMutateAction(deleteFileAction);
  const [getFile] = useMutateAction(getFileAction);
  const [setProjetoCover] = useMutateAction(setProjetoCoverAction);

  // Optimistic cover selection: reflects the click immediately, before the refresh lands.
  const [pendingCoverId, setPendingCoverId] = useState<number | null>(null);

  const isImageType = (contentType: string) => {
    return contentType.startsWith('image/');
  };

  const handleSetCover = async (fileId: number) => {
    const previous = pendingCoverId;
    setPendingCoverId(fileId); // optimistic
    try {
      await setProjetoCover({ projetoId: entityId, fileId });
      toast({
        title: "Capa definida",
        description: "Foto definida como capa do projeto.",
      });
      refreshFiles();
    } catch (error) {
      console.error('Error setting cover:', error);
      setPendingCoverId(previous); // revert
      toast({
        title: "Erro",
        description: "Não foi possível definir a foto como capa.",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (contentType: string) => {
    if (isImageType(contentType)) {
      return <Image className="h-4 w-4 text-blue-600" />;
    }
    return <FileText className="h-4 w-4 text-green-600" />;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    for (const file of Array.from(uploadedFiles)) {
      try {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error('O arquivo excede o limite de 10 MB.');
        }

        if (!isAcceptedFileType(file, acceptedTypes)) {
          throw new Error('Tipo de arquivo não permitido para este cadastro.');
        }

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
        });

        reader.readAsDataURL(file);
        const base64String = await base64Promise;

        await uploadFile({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          fileData: base64String,
          entityType,
          entityId,
        });

        toast({
          title: "Upload concluído",
          description: `Arquivo ${file.name} enviado com sucesso.`,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Erro no upload",
          description: `Não foi possível enviar o arquivo ${file.name}. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          variant: "destructive",
        });
      }
    }

    refreshFiles();
    // Reset input
    event.target.value = '';
  };

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      const result = await getFile({ fileId });
      
      if (result.length === 0) {
        throw new Error('File not found');
      }

      const fileData = result[0];
      
      if (!fileData.file_data) {
        throw new Error('File data is empty or null');
      }

      let base64Data: string;
      if (fileData.file_data.startsWith('data:')) {
        base64Data = fileData.file_data.split(',')[1];
      } else {
        base64Data = fileData.file_data;
      }

      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
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

        toast({
          title: "Download concluído",
          description: `Arquivo ${filename} baixado com sucesso.`,
        });
      } catch (decodeError) {
        console.error('Error decoding base64:', decodeError);
        throw new Error('Invalid file data format');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Erro no download",
        description: `Não foi possível baixar o arquivo. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: number, filename: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo "${filename}"?`)) {
      return;
    }

    try {
      await deleteFile({ fileId });
      toast({
        title: "Arquivo excluído",
        description: `Arquivo ${filename} foi excluído com sucesso.`,
      });
      refreshFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Erro na exclusão",
        description: "Não foi possível excluir o arquivo.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">Carregando arquivos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error('Error loading files:', error);
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-red-500">Erro ao carregar arquivos: {error.message || 'Erro desconhecido'}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="file-manager-content space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{files.length} arquivo(s)</Badge>
          <label htmlFor={`file-upload-${entityType}-${entityId}`}>
            <Button variant="outline" size="sm" asChild disabled={isUploading}>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Enviando...' : 'Upload'}
              </span>
            </Button>
            <input
              id={`file-upload-${entityType}-${entityId}`}
              type="file"
              multiple
              accept={acceptedTypes}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum arquivo encontrado. Clique em "Upload" para adicionar arquivos.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file: ManagedFile) => {
            const isImage = isImageType(file.content_type);
            const canBeCover = enableCover && isImage;
            const isCover = pendingCoverId !== null ? pendingCoverId === file.id : !!file.is_cover;
            return (
            <Card
              key={file.id}
              className={`transition-shadow hover:shadow-md ${isCover ? 'border-2 border-amber-400 ring-1 ring-amber-200' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.content_type)}
                    <span className="text-sm font-medium truncate" title={file.filename}>
                      {file.filename}
                    </span>
                    {isCover && (
                      <Badge className="ml-auto flex items-center gap-1 bg-amber-500 text-white hover:bg-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        Capa
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex gap-2">
                    {canBeCover && (
                      <Button
                        variant={isCover ? 'default' : 'outline'}
                        size="sm"
                        type="button"
                        title={isCover ? 'Foto de capa atual' : 'Definir como capa'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isCover) handleSetCover(file.id);
                        }}
                        className={isCover ? 'bg-amber-500 hover:bg-amber-500' : ''}
                      >
                        <Star className={`h-4 w-4 ${isCover ? 'fill-current' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownload(file.id, file.filename);
                      }}
                      className="flex-1"
                      type="button"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.id, file.filename)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
