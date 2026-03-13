'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Download, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import uploadFileAction from '@/actions/uploadFile';
import getFileAction from '@/actions/getFile';
import loadFilesByEntityAction from '@/actions/loadFilesByEntity';
import deleteFileAction from '@/actions/deleteFile';

interface FileManagerProps {
  entityType: string;
  entityId: number;
  acceptedTypes?: string;
  title?: string;
}

export function FileManager({ entityType, entityId, acceptedTypes = "image/*,.pdf,.doc,.docx", title = "Arquivos" }: FileManagerProps) {
  const { toast } = useToast();
  const [files, loading, error, refreshFiles] = useLoadAction(
    loadFilesByEntityAction, 
    [], 
    { entityType, entityId }
  );
  const [uploadFile, isUploading] = useMutateAction(uploadFileAction);
  const [deleteFile, isDeleting] = useMutateAction(deleteFileAction);
  const [getFile] = useMutateAction(getFileAction);

  const isImageType = (contentType: string) => {
    return contentType.startsWith('image/');
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
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        // Convert file to base64 data URL
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Extract only the base64 part (remove data:type;base64, prefix)
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
        });

        reader.readAsDataURL(file);
        const base64String = await base64Promise;

        console.log('Base64 string length:', base64String.length);

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
      console.log('Downloading file:', fileId, filename);
      
      const result = await getFile({ fileId });
      console.log('File query result:', result);
      console.log('Result keys:', result.length > 0 ? Object.keys(result[0]) : 'No results');
      
      if (result.length === 0) {
        throw new Error('File not found');
      }

      const fileData = result[0];
      console.log('File data object:', fileData);
      console.log('File data length from query:', fileData.data_length);
      console.log('File data type:', typeof fileData.file_data);
      console.log('File data length:', fileData.file_data?.length);
      
      if (!fileData.file_data) {
        throw new Error('File data is empty or null');
      }

      // Handle different data formats
      let base64Data: string;
      if (fileData.file_data.startsWith('data:')) {
        // If it's already a data URL, extract base64 part
        base64Data = fileData.file_data.split(',')[1];
      } else {
        // If it's just base64 string
        base64Data = fileData.file_data;
      }

      // Convert base64 to blob
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

  console.log('Files loaded:', files);

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
          {files.map((file: any) => (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.content_type)}
                    <span className="text-sm font-medium truncate" title={file.filename}>
                      {file.filename}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex gap-2">
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
          ))}
        </div>
      )}
    </div>
  );
}
