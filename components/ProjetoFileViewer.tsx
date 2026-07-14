'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjetoFileViewerProps {
  files: string[];
  title: string;
  type: 'photos' | 'documents';
  isOpen: boolean;
  onClose: () => void;
}

export function ProjetoFileViewer({ files, title, type, isOpen, onClose }: ProjetoFileViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  // Debug: Log files when component receives them

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isImageFile = (filename: string) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageExtensions.includes(getFileExtension(filename));
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'txt':
        return '📋';
      default:
        return '📁';
    }
  };

  const handleFileClick = (fileUrl: string) => {
    if (type === 'photos' && isImageFile(fileUrl)) {
      setSelectedFile(fileUrl);
    } else {
      // For documents, open in new tab
      window.open(fileUrl, '_blank');
    }
  };

  const isDataUrl = (url: string) => {
    return url.startsWith('data:');
  };

  const isHttpUrl = (url: string) => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const handleDownload = async (fileUrl: string) => {
    try {
      // Set loading state
      setDownloadingFiles(prev => new Set(prev).add(fileUrl));
      
      // Extract filename from URL or use a default name
      const fileName = fileUrl.split('/').pop()?.split('?')[0] || `file_${Date.now()}`;
      
      if (isDataUrl(fileUrl)) {
        // Handle data URLs directly
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Download concluído",
          description: `Arquivo ${fileName} baixado com sucesso.`,
        });
        return;
      }

      if (isHttpUrl(fileUrl)) {
        // Try to fetch external URLs
        try {
          const response = await fetch(fileUrl, {
            mode: 'cors',
            credentials: 'omit'
          });
          
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(blobUrl);
          
          toast({
            title: "Download concluído",
            description: `Arquivo ${fileName} baixado com sucesso.`,
          });
        } catch (fetchError) {
          // Fallback to opening in new tab
          window.open(fileUrl, '_blank');
          toast({
            title: "Download iniciado",
            description: "Arquivo aberto em nova aba. Use Ctrl+S para salvar.",
          });
        }
      } else {
        // For other file types or local URLs, try opening in new tab
        window.open(fileUrl, '_blank');
        toast({
          title: "Arquivo aberto",
          description: "Arquivo aberto em nova aba.",
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      
      toast({
        title: "Erro no download",
        description: "Não foi possível processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      // Remove loading state
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileUrl);
        return newSet;
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {title}
              <Badge variant="outline">{files.length} arquivo(s)</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((fileUrl, index) => {
              const fileName = fileUrl.split('/').pop() || `file_${index}`;
              return (
                <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center space-y-2">
                      {type === 'photos' && isImageFile(fileName) ? (
                        <div 
                          className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden"
                          onClick={() => handleFileClick(fileUrl)}
                        >
                          <img
                            src={fileUrl}
                            alt={fileName}
                            className="w-full h-full object-cover cursor-pointer"
                            onLoad={(e) => {
                            }}
                            onError={(e) => {
                              console.error('Failed to load image:', fileUrl);
                              (e.target as HTMLImageElement).src = '/assets/images/default.svg';
                            }}
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-full h-32 bg-gray-50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100"
                          onClick={() => handleFileClick(fileUrl)}
                        >
                          <span className="text-4xl mb-2">{getFileIcon(fileName)}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getFileExtension(fileName).toUpperCase()}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="w-full text-center">
                        <p className="text-sm font-medium truncate" title={fileName}>
                          {fileName}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {type === 'photos' && isImageFile(fileName) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileClick(fileUrl);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingFiles.has(fileUrl)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(fileUrl);
                          }}
                        >
                          {downloadingFiles.has(fileUrl) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {files.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum arquivo encontrado.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image preview modal for photos */}
      {selectedFile && type === 'photos' && (
        <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate max-w-md">
                  {selectedFile.split('/').pop() || 'Imagem'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingFiles.has(selectedFile)}
                    onClick={() => handleDownload(selectedFile)}
                  >
                    {downloadingFiles.has(selectedFile) ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-2">
              <div className="flex items-center justify-center bg-gray-50 rounded-lg min-h-[400px]">
                <img
                  src={selectedFile}
                  alt={selectedFile.split('/').pop() || 'Imagem'}
                  className="max-w-full max-h-[60vh] object-contain"
                  onLoad={() => {
                  }}
                  onError={(e) => {
                    console.error('Failed to load preview image:', selectedFile);
                    (e.target as HTMLImageElement).src = '/assets/images/default.svg';
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
