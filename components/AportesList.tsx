// Change note: Nova listagem de aportes com filtros por data, matriz, sócio e conta
'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign, Calendar, FileSpreadsheet, Download } from 'lucide-react';
import { AporteForm } from '@/components/AporteForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadAportesAction from '@/actions/loadAportes';
import deleteAporteAction from '@/actions/deleteAporte';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

type Aporte = {
  id: number;
  socio_id: number;
  matriz_id: number;
  conta_id: number;
  data_aporte: string;
  valor: number;
  observacoes?: string;
  socio_nome: string;
  matriz_nome: string;
  conta_nome: string;
  created_at: string;
};

type Socio = {
  id: number;
  nome: string;
};

type Matriz = {
  id: number;
  nome: string;
};

type Conta = {
  id: number;
  nome: string;
};

export function AportesList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAporte, setEditingAporte] = useState<Aporte | null>(null);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [matrizId, setMatrizId] = useState<number | null>(null);
  const [socioId, setSocioId] = useState<number | null>(null);
  const [contaId, setContaId] = useState<number | null>(null);

  // Load data
  const [aportes, loading, error, refreshAportes] = useLoadAction(
    loadAportesAction,
    [],
    {
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      matrizId,
      socioId,
      contaId,
    }
  );

  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const [deleteAporte, isDeleting] = useMutateAction(deleteAporteAction);

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este aporte?')) return;

    try {
      await deleteAporte({ id });
      await refreshAportes();
      toast({
        title: 'Aporte excluído',
        description: 'O aporte foi excluído com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o aporte.',
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = async () => {
    setIsFormOpen(false);
    setEditingAporte(null);
    await refreshAportes();
  };

  const clearFilters = () => {
    setDataInicio('');
    setDataFim('');
    setMatrizId(null);
    setSocioId(null);
    setContaId(null);
  };

  const totalAportes = aportes.reduce((sum: number, aporte: Aporte) => sum + aporte.valor, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleExportExcel = () => {
    if (!aportes || aportes.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const excelData = aportes.map((aporte: Aporte) => ({
        Data: formatDate(aporte.data_aporte),
        'Sócio': aporte.socio_nome,
        'Matriz': aporte.matriz_nome,
        'Conta': aporte.conta_nome,
        'Valor': aporte.valor,
        'Observações': aporte.observacoes || '-',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);

      XLSX.utils.sheet_add_aoa(ws, [
        ['Relatório de Aportes'],
        [''],
        ['Período:', dataInicio && dataFim ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}` : 'Todos'],
        ['Total de Aportes:', totalAportes],
        ['Quantidade:', aportes.length],
        [''],
        ['Data', 'Sócio', 'Matriz', 'Conta', 'Valor', 'Observações'],
      ]);

      XLSX.utils.sheet_add_json(ws, excelData, {
        origin: 'A8',
        skipHeader: true,
      });

      ws['!cols'] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 15 },
        { wch: 40 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Aportes');

      const fileName = `Aportes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado para Excel com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório para Excel.',
        variant: 'destructive',
      });
    }
  };

  const handleExportPdf = () => {
    if (!aportes || aportes.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header
      doc.setFontSize(18);
      doc.text('Relatório de Aportes', 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Período: ${dataInicio && dataFim ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}` : 'Todos'}`, 14, 30);
      doc.text(`Total: ${formatCurrency(totalAportes)}`, 14, 37);
      doc.text(`Quantidade: ${aportes.length} aportes`, 14, 44);

      // Group aportes by socio
      const aportesPorSocio: { [key: string]: Aporte[] } = {};
      aportes.forEach((aporte: Aporte) => {
        const socioNome = aporte.socio_nome;
        if (!aportesPorSocio[socioNome]) {
          aportesPorSocio[socioNome] = [];
        }
        aportesPorSocio[socioNome].push(aporte);
      });

      let yPosition = 55;
      const lineHeight = 6;
      const headers = ['Data', 'Matriz', 'Valor', 'Observações'];
      const colWidths = [25, 50, 30, 80];
      const marginRight = 14;

      // Function to draw footer
      const drawFooter = (pageNum: number) => {
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('PROVISION', 14, pageHeight - 10);
        doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Página ${pageNum}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      };

      let currentPage = 1;

      // Draw header on first page
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(144, 238, 144); // Light green
      doc.rect(14, yPosition - 5, pageWidth - 28, 7, 'F');
      
      let xPosition = 14;
      headers.forEach((header, i) => {
        doc.text(header, xPosition + 2, yPosition);
        xPosition += colWidths[i];
      });

      yPosition += lineHeight + 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      // Draw data grouped by socio
      Object.keys(aportesPorSocio).forEach((socioNome) => {
        const socioAportes = aportesPorSocio[socioNome];

        // Check if we need a new page for the socio header
        if (yPosition > pageHeight - 40) {
          drawFooter(currentPage);
          doc.addPage();
          currentPage++;
          yPosition = 20;

          // Redraw headers on new page
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(144, 238, 144);
          doc.rect(14, yPosition - 5, pageWidth - 28, 7, 'F');
          
          xPosition = 14;
          headers.forEach((header, i) => {
            doc.text(header, xPosition + 2, yPosition);
            xPosition += colWidths[i];
          });

          yPosition += lineHeight + 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
        }

        // Draw socio name header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Sócio: ${socioNome}`, 14, yPosition);
        yPosition += lineHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        let socioTotal = 0;

        // Draw aportes for this socio
        socioAportes.forEach((aporte: Aporte) => {
          if (yPosition > pageHeight - 30) {
            drawFooter(currentPage);
            doc.addPage();
            currentPage++;
            yPosition = 20;

            // Redraw headers on new page
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(144, 238, 144);
            doc.rect(14, yPosition - 5, pageWidth - 28, 7, 'F');
            
            xPosition = 14;
            headers.forEach((header, i) => {
              doc.text(header, xPosition + 2, yPosition);
              xPosition += colWidths[i];
            });

            yPosition += lineHeight + 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
          }

          xPosition = 14;
          const rowData = [
            formatDate(aporte.data_aporte),
            aporte.matriz_nome.substring(0, 25),
            formatCurrency(aporte.valor),
            (aporte.observacoes || '-').substring(0, 40),
          ];

          rowData.forEach((cell, i) => {
            if (i === 2) {
              doc.text(cell, xPosition + colWidths[i] - 2, yPosition, { align: 'right' });
            } else {
              doc.text(cell, xPosition + 2, yPosition);
            }
            xPosition += colWidths[i];
          });

          socioTotal += aporte.valor;
          yPosition += lineHeight;
        });

        // Draw subtotal line for socio
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPosition - 2, pageWidth - marginRight, yPosition - 2);
        
        xPosition = 14 + colWidths[0];
        doc.text('Subtotal:', xPosition + 2, yPosition);
        xPosition += colWidths[1];
        doc.text(formatCurrency(socioTotal), xPosition + colWidths[2] - 2, yPosition, { align: 'right' });
        
        yPosition += lineHeight + 3;
        doc.setFont('helvetica', 'normal');
      });

      // Draw footer on last page
      drawFooter(currentPage);

      const fileName = `Aportes_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado para PDF com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório para PDF.',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Erro ao carregar aportes: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Aportes
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingAporte(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Aporte
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAporte ? 'Editar Aporte' : 'Cadastrar Aporte'}
                  </DialogTitle>
                </DialogHeader>
                <AporteForm
                  aporte={editingAporte}
                  onSuccess={handleFormSuccess}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingAporte(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Matriz</label>
              <Select
                value={matrizId?.toString() || 'all'}
                onValueChange={(value) => setMatrizId(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as matrizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as matrizes</SelectItem>
                  {matrizes.map((matriz: Matriz) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sócio</label>
              <Select
                value={socioId?.toString() || 'all'}
                onValueChange={(value) => setSocioId(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os sócios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sócios</SelectItem>
                  {socios.map((socio: Socio) => (
                    <SelectItem key={socio.id} value={socio.id.toString()}>
                      {socio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Conta</label>
              <Select
                value={contaId?.toString() || 'all'}
                onValueChange={(value) => setContaId(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {contas.map((conta: Conta) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={handleExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Total: {formatCurrency(totalAportes)}
              </Badge>
              <Badge variant="outline">
                {aportes.length} {aportes.length === 1 ? 'aporte' : 'aportes'}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Carregando aportes...</div>
          ) : aportes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum aporte encontrado</p>
              <p className="text-sm">Cadastre o primeiro aporte clicando no botão acima</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Matriz</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aportes.map((aporte: Aporte) => (
                    <TableRow key={aporte.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          {new Date(aporte.data_aporte).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{aporte.socio_nome}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{aporte.matriz_nome}</Badge>
                      </TableCell>
                      <TableCell>{aporte.conta_nome}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(aporte.valor)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {aporte.observacoes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingAporte(aporte);
                              setIsFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(aporte.id)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
