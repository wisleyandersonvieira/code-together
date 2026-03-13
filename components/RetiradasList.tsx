// Single-line change note: Create retiradas list component for managing financial withdrawals

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import loadRetiradasAction from '@/actions/loadRetiradas';
import deleteRetiradaAction from '@/actions/deleteRetirada';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import { RetiradaForm } from './RetiradaForm';
import { Plus, Edit, Trash2, Filter, X, FileSpreadsheet, Download } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { DatePicker } from '@/components/ui/date-picker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export function RetiradasList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingRetirada, setEditingRetirada] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    matrizId: 'all',
    socioId: 'all',
    contaId: 'all',
  });

  // Convert empty strings and "all" to null for the action
  const actionFilters = {
    dataInicio: filters.dataInicio || null,
    dataFim: filters.dataFim || null,
    matrizId: (filters.matrizId && filters.matrizId !== 'all') ? filters.matrizId : null,
    socioId: (filters.socioId && filters.socioId !== 'all') ? filters.socioId : null,
    contaId: (filters.contaId && filters.contaId !== 'all') ? filters.contaId : null,
  };

  const [retiradas, loadingRetiradas, , refreshRetiradas] = useLoadAction(loadRetiradasAction, [], actionFilters);
  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);
  const [deleteRetirada, isDeleting] = useMutateAction(deleteRetiradaAction);

  const handleEdit = (retirada: any) => {
    setEditingRetirada(retirada);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta retirada?')) return;

    try {
      await deleteRetirada({ id });
      toast({
        title: "Sucesso",
        description: "Retirada excluída com sucesso!",
      });
      refreshRetiradas();
    } catch (error) {
      console.error('Erro ao excluir retirada:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir retirada. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRetirada(null);
    // Force refresh with current filters
    setTimeout(() => {
      refreshRetiradas();
    }, 100);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingRetirada(null);
  };

  const applyFilters = () => {
    refreshRetiradas();
  };

  const clearFilters = () => {
    setFilters({
      dataInicio: '',
      dataFim: '',
      matrizId: 'all',
      socioId: 'all',
      contaId: 'all',
    });
    setTimeout(() => refreshRetiradas(), 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const totalRetiradas = retiradas.reduce((sum: number, retirada: any) => sum + (retirada.valor || 0), 0);

  const handleExportExcel = () => {
    if (!retiradas || retiradas.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const excelData = retiradas.map((retirada: any) => ({
        Data: formatDate(retirada.data_retirada),
        'Sócio': retirada.socio_nome,
        'Matriz': retirada.matriz_nome,
        'Conta': retirada.conta_nome,
        'Valor': retirada.valor,
        'Observações': retirada.observacoes || '-',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);

      XLSX.utils.sheet_add_aoa(ws, [
        ['Relatório de Retiradas'],
        [''],
        ['Período:', filters.dataInicio && filters.dataFim ? `${formatDate(filters.dataInicio)} a ${formatDate(filters.dataFim)}` : 'Todos'],
        ['Total de Retiradas:', totalRetiradas],
        ['Quantidade:', retiradas.length],
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

      XLSX.utils.book_append_sheet(wb, ws, 'Retiradas');

      const fileName = `Retiradas_${new Date().toISOString().split('T')[0]}.xlsx`;
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
    if (!retiradas || retiradas.length === 0) {
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
      doc.text('Relatório de Retiradas', 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Período: ${filters.dataInicio && filters.dataFim ? `${formatDate(filters.dataInicio)} a ${formatDate(filters.dataFim)}` : 'Todos'}`, 14, 30);
      doc.text(`Total: ${formatCurrency(totalRetiradas)}`, 14, 37);
      doc.text(`Quantidade: ${retiradas.length} retiradas`, 14, 44);

      // Group retiradas by socio
      const retiradasPorSocio: { [key: string]: any[] } = {};
      retiradas.forEach((retirada: any) => {
        const socioNome = retirada.socio_nome;
        if (!retiradasPorSocio[socioNome]) {
          retiradasPorSocio[socioNome] = [];
        }
        retiradasPorSocio[socioNome].push(retirada);
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
      Object.keys(retiradasPorSocio).forEach((socioNome, socioIndex) => {
        const socioRetiradas = retiradasPorSocio[socioNome];

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

        // Draw retiradas for this socio
        socioRetiradas.forEach((retirada: any) => {
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
            formatDate(retirada.data_retirada),
            retirada.matriz_nome.substring(0, 25),
            formatCurrency(retirada.valor),
            (retirada.observacoes || '-').substring(0, 40),
          ];

          rowData.forEach((cell, i) => {
            if (i === 2) {
              doc.text(cell, xPosition + colWidths[i] - 2, yPosition, { align: 'right' });
            } else {
              doc.text(cell, xPosition + 2, yPosition);
            }
            xPosition += colWidths[i];
          });

          socioTotal += retirada.valor;
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

      const fileName = `Retiradas_${new Date().toISOString().split('T')[0]}.pdf`;
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

  if (showForm) {
    return (
      <RetiradaForm
        retirada={editingRetirada}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Retiradas</h2>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="destructive" className="text-lg px-4 py-2">
              Total: {formatCurrency(totalRetiradas)}
            </Badge>
            <Badge variant="outline">
              {retiradas.length} {retiradas.length === 1 ? 'retirada' : 'retiradas'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Retirada
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <DatePicker
                  date={filters.dataInicio ? new Date(filters.dataInicio) : undefined}
                  onDateChange={(date) => setFilters({ ...filters, dataInicio: date ? date.toISOString().split('T')[0] : '' })}
                  placeholder="Selecione"
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <DatePicker
                  date={filters.dataFim ? new Date(filters.dataFim) : undefined}
                  onDateChange={(date) => setFilters({ ...filters, dataFim: date ? date.toISOString().split('T')[0] : '' })}
                  placeholder="Selecione"
                />
              </div>

              <div className="space-y-2">
                <Label>Matriz</Label>
                <Select
                  value={filters.matrizId}
                  onValueChange={(value) => setFilters({ ...filters, matrizId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {matrizes.map((matriz) => (
                      <SelectItem key={matriz.id} value={matriz.id.toString()}>
                        {matriz.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sócio</Label>
                <Select
                  value={filters.socioId}
                  onValueChange={(value) => setFilters({ ...filters, socioId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {socios.map((socio) => (
                      <SelectItem key={socio.id} value={socio.id.toString()}>
                        {socio.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta</Label>
                <Select
                  value={filters.contaId}
                  onValueChange={(value) => setFilters({ ...filters, contaId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id.toString()}>
                        {conta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters}>
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Sócio</TableHead>
                <TableHead>Matriz</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRetiradas ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Carregando retiradas...
                  </TableCell>
                </TableRow>
              ) : retiradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Nenhuma retirada encontrada
                  </TableCell>
                </TableRow>
              ) : (
                retiradas.map((retirada) => (
                  <TableRow key={retirada.id}>
                    <TableCell>{formatDate(retirada.data_retirada)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{retirada.socio_nome}</div>
                    </TableCell>
                    <TableCell>{retirada.matriz_nome}</TableCell>
                    <TableCell>{retirada.conta_nome}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {formatCurrency(retirada.valor)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {retirada.observacoes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(retirada)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(retirada.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
