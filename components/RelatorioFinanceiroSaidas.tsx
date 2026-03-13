// Change note: Added data_vencimento column, fixed pending value display, added PDF export dropdown with 5 report types

'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, Download, Filter, Calendar, DollarSign, FileDown, X, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import loadRelatorioSaidasAction from '@/actions/loadRelatorioSaidas';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import loadFornecedoresAction from '@/actions/loadFornecedores';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import loadSubgruposContabeisAction from '@/actions/loadSubgruposContabeis';
import loadProjetosAction from '@/actions/loadProjetos';

interface RelatorioSaidaItem {
  numero_documento?: string;
  fornecedor_nome: string;
  matriz_nome?: string;
  projeto_nomes?: string;
  valor: number;
  data_pagamento?: string;
  status: string;
  data_vencimento: string;
  data_competencia?: string;
  conta_nome?: string;
  conta_banco?: string;
  grupo_contabil?: string;
  subgrupo_contabil?: string;
  conta_id?: number;
  observacoes?: string;
}

export function RelatorioFinanceiroSaidas() {
  const { formatCurrency } = useCurrency();
  
  // Data loading
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);
  const [fornecedores] = useLoadAction(loadFornecedoresAction, [], { searchTerm: null });
  const [gruposContabeis] = useLoadAction(loadGruposContabeisAction, []);
  const [subgruposContabeis] = useLoadAction(loadSubgruposContabeisAction, [], { searchTerm: null, grupoId: null });
  const [projetos] = useLoadAction(loadProjetosAction, []);
  
  // Filter state
  const [matrizId, setMatrizId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [contaId, setContaId] = useState<string>('');
  const [fornecedorId, setFornecedorId] = useState<string>('');
  const [dataCompetenciaInicio, setDataCompetenciaInicio] = useState<Date | null>(null);
  const [dataCompetenciaFim, setDataCompetenciaFim] = useState<Date | null>(null);
  const [dataPagamentoInicio, setDataPagamentoInicio] = useState<Date | null>(null);
  const [dataPagamentoFim, setDataPagamentoFim] = useState<Date | null>(null);
  const [grupoContabilId, setGrupoContabilId] = useState<string>('');
  const [subgrupoContabilId, setSubgrupoContabilId] = useState<string>('');
  const [projetoIds, setProjetoIds] = useState<number[]>([]);
  const [showRelatorio, setShowRelatorio] = useState(false);

  // Load report data
  const [relatorioData, relatorioLoading, relatorioError] = useLoadAction(
    loadRelatorioSaidasAction,
    [],
    {
      matrizId: matrizId ? parseInt(matrizId) : null,
      status: status || null,
      contaId: contaId ? parseInt(contaId) : null,
      fornecedorId: fornecedorId ? parseInt(fornecedorId) : null,
      dataCompetenciaInicio: dataCompetenciaInicio ? formatDateForDatabase(dataCompetenciaInicio) : null,
      dataCompetenciaFim: dataCompetenciaFim ? formatDateForDatabase(dataCompetenciaFim) : null,
      dataPagamentoInicio: dataPagamentoInicio ? formatDateForDatabase(dataPagamentoInicio) : null,
      dataPagamentoFim: dataPagamentoFim ? formatDateForDatabase(dataPagamentoFim) : null,
      grupoContabilId: grupoContabilId ? parseInt(grupoContabilId) : null,
      subgrupoContabilId: subgrupoContabilId ? parseInt(subgrupoContabilId) : null,
      projetoIds: projetoIds.length > 0 ? projetoIds : null,
    }
  );

  const handleProjetoToggle = (projetoId: number) => {
    setProjetoIds(prev => 
      prev.includes(projetoId)
        ? prev.filter(id => id !== projetoId)
        : [...prev, projetoId]
    );
  };

  const handleRemoveProjeto = (projetoId: number) => {
    setProjetoIds(prev => prev.filter(id => id !== projetoId));
  };

  const handleGenerateReport = () => {
    setShowRelatorio(true);
  };

  const handleExportExcel = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const excelData = relatorioData.map((item: RelatorioSaidaItem) => ({
      'Nº Documento': item.numero_documento || '',
      'Fornecedor': item.fornecedor_nome || '',
      'Matriz': item.matriz_nome || '',
      'Projeto': item.projeto_nomes || '',
      'Valor': item.valor || 0,
      'Data Vencimento': item.data_vencimento ? formatDateForDisplay(item.data_vencimento) : '',
      'Data Competência': item.data_competencia ? formatDateForDisplay(item.data_competencia) : '',
      'Data Pagamento': item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '',
      'Status': item.status || '',
      'Conta': item.conta_nome ? `${item.conta_nome} - ${item.conta_banco}` : '',
      'Grupo Contábil': item.grupo_contabil || '',
      'Subgrupo Contábil': item.subgrupo_contabil || '',
      'Observação': item.observacoes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Financeiro Saídas');

    const filename = `relatorio_financeiro_saidas_${new Date().toISOString().slice(0, 10)}`;
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportPDFGeral = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 14, 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Gestão Financeira', 14, 20);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const titulo = 'RELATÓRIO FINANCEIRO - SAÍDAS';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);

    let yPos = 45;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const filtrosAplicados = [];
    if (status) filtrosAplicados.push(`Status: ${status}`);
    if (matrizId) {
      const matriz = matrizes.find((m: any) => m.id === parseInt(matrizId));
      if (matriz) filtrosAplicados.push(`Matriz: ${matriz.nome}`);
    }

    filtrosAplicados.forEach(filtro => {
      doc.text(filtro, 14, yPos);
      yPos += 5;
    });

    doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
    yPos += 15;

    doc.setFillColor(52, 73, 93);
    doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('Nº Doc', 18, yPos);
    doc.text('Fornecedor', 38, yPos);
    doc.text('Projeto', 65, yPos);
    doc.text('Valor', 90, yPos);
    doc.text('Dt Venc', 110, yPos);
    doc.text('Dt Pag', 130, yPos);
    doc.text('Status', 150, yPos);

    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');

    let totalGeral = 0;

    relatorioData.forEach((item: RelatorioSaidaItem, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 25;

        doc.setFillColor(52, 73, 93);
        doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.text('Nº Doc', 18, yPos);
        doc.text('Fornecedor', 38, yPos);
        doc.text('Projeto', 65, yPos);
        doc.text('Valor', 90, yPos);
        doc.text('Dt Venc', 110, yPos);
        doc.text('Dt Pag', 130, yPos);
        doc.text('Status', 150, yPos);

        yPos += 15;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
      }

      const valor = parseFloat(item.valor?.toString() || '0') || 0;
      totalGeral += valor;

      doc.setFontSize(7);
      doc.text(String(item.numero_documento || '').substring(0, 8), 18, yPos);
      doc.text(String(item.fornecedor_nome || '').substring(0, 12), 38, yPos);
      doc.text(String(item.projeto_nomes || '').substring(0, 10), 65, yPos);

      doc.setTextColor(220, 53, 69);
      doc.setFont(undefined, 'bold');
      doc.text(formatCurrency(-Math.abs(valor)), 90, yPos);

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.text(formatDateForDisplay(item.data_vencimento), 110, yPos);
      doc.text(item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-', 130, yPos);

      if (item.status === 'PAGO') {
        doc.setTextColor(40, 167, 69);
      } else {
        doc.setTextColor(255, 193, 7);
      }
      doc.text(String(item.status || '').substring(0, 8), 150, yPos);

      doc.setTextColor(0, 0, 0);
      yPos += 10;
    });

    yPos += 10;
    if (yPos > 270) {
      doc.addPage();
      yPos = 30;
    }

    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GERAL:', 100, yPos);
    doc.setTextColor(220, 53, 69);
    doc.text(formatCurrency(-Math.abs(totalGeral)), 140, yPos);

    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Total de ${relatorioData.length} registro(s) encontrado(s)`, 14, yPos);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
      doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
    }

    const filename = `relatorio_financeiro_saidas_geral_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${filename}.pdf`);
  };

  const exportPDFPorFornecedor = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const groupedData = relatorioData.reduce((acc: any, item: RelatorioSaidaItem) => {
      const fornecedor = item.fornecedor_nome || 'Sem Fornecedor';
      if (!acc[fornecedor]) {
        acc[fornecedor] = [];
      }
      acc[fornecedor].push(item);
      return acc;
    }, {});

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 14, 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Gestão Financeira', 14, 20);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const titulo = 'RELATÓRIO POR FORNECEDOR';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);

    let yPos = 45;

    Object.keys(groupedData).sort().forEach((fornecedor, groupIndex) => {
      const items = groupedData[fornecedor];
      const subtotal = items.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);

      if (yPos > 250) {
        doc.addPage();
        yPos = 25;
      }

      doc.setFillColor(70, 130, 180);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(fornecedor, 18, yPos);
      yPos += 12;

      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Nº Doc', 18, yPos);
      doc.text('Projeto', 45, yPos);
      doc.text('Valor', 80, yPos);
      doc.text('Dt Venc', 105, yPos);
      doc.text('Dt Pag', 130, yPos);
      doc.text('Status', 155, yPos);
      yPos += 12;

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      items.forEach((item: RelatorioSaidaItem, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }

        const valor = parseFloat(item.valor?.toString() || '0') || 0;

        doc.setFontSize(7);
        doc.text(String(item.numero_documento || '').substring(0, 10), 18, yPos);
        doc.text(String(item.projeto_nomes || '').substring(0, 15), 45, yPos);

        doc.setTextColor(220, 53, 69);
        doc.setFont(undefined, 'bold');
        doc.text(formatCurrency(-Math.abs(valor)), 80, yPos);

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(formatDateForDisplay(item.data_vencimento), 105, yPos);
        doc.text(item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-', 130, yPos);

        if (item.status === 'PAGO') {
          doc.setTextColor(40, 167, 69);
        } else {
          doc.setTextColor(255, 193, 7);
        }
        doc.text(String(item.status || '').substring(0, 8), 155, yPos);
        doc.setTextColor(0, 0, 0);

        yPos += 8;
      });

      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${fornecedor}:`, 18, yPos + 3);
      doc.setTextColor(220, 53, 69);
      doc.text(formatCurrency(-Math.abs(subtotal)), 80, yPos + 3);
      doc.setTextColor(0, 0, 0);
      yPos += 15;
    });

    const totalGeral = relatorioData.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);
    yPos += 5;
    if (yPos > 260) {
      doc.addPage();
      yPos = 30;
    }
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GERAL:', 100, yPos);
    doc.setTextColor(220, 53, 69);
    doc.text(formatCurrency(-Math.abs(totalGeral)), 140, yPos);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
      doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
    }

    const filename = `relatorio_saidas_por_fornecedor_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${filename}.pdf`);
  };

  const exportPDFPorMes = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const groupedData = relatorioData.reduce((acc: any, item: RelatorioSaidaItem) => {
      const date = new Date(item.data_pagamento || item.data_vencimento);
      const mesAno = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      if (!acc[mesAno]) {
        acc[mesAno] = [];
      }
      acc[mesAno].push(item);
      return acc;
    }, {});

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 14, 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Gestão Financeira', 14, 20);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const titulo = 'RELATÓRIO POR MÊS';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);

    let yPos = 45;

    Object.keys(groupedData).sort().forEach((mesAno) => {
      const items = groupedData[mesAno];
      const subtotal = items.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);

      if (yPos > 250) {
        doc.addPage();
        yPos = 25;
      }

      doc.setFillColor(70, 130, 180);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(`Mês: ${mesAno}`, 18, yPos);
      yPos += 12;

      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Fornecedor', 18, yPos);
      doc.text('Projeto', 55, yPos);
      doc.text('Valor', 90, yPos);
      doc.text('Dt Venc', 115, yPos);
      doc.text('Dt Pag', 140, yPos);
      doc.text('Status', 165, yPos);
      yPos += 12;

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      items.forEach((item: RelatorioSaidaItem, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }

        const valor = parseFloat(item.valor?.toString() || '0') || 0;

        doc.setFontSize(7);
        doc.text(String(item.fornecedor_nome || '').substring(0, 15), 18, yPos);
        doc.text(String(item.projeto_nomes || '').substring(0, 15), 55, yPos);

        doc.setTextColor(220, 53, 69);
        doc.setFont(undefined, 'bold');
        doc.text(formatCurrency(-Math.abs(valor)), 90, yPos);

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(formatDateForDisplay(item.data_vencimento), 115, yPos);
        doc.text(item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-', 140, yPos);

        if (item.status === 'PAGO') {
          doc.setTextColor(40, 167, 69);
        } else {
          doc.setTextColor(255, 193, 7);
        }
        doc.text(String(item.status || '').substring(0, 8), 165, yPos);
        doc.setTextColor(0, 0, 0);

        yPos += 8;
      });

      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${mesAno}:`, 18, yPos + 3);
      doc.setTextColor(220, 53, 69);
      doc.text(formatCurrency(-Math.abs(subtotal)), 90, yPos + 3);
      doc.setTextColor(0, 0, 0);
      yPos += 15;
    });

    const totalGeral = relatorioData.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);
    yPos += 5;
    if (yPos > 260) {
      doc.addPage();
      yPos = 30;
    }
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GERAL:', 100, yPos);
    doc.setTextColor(220, 53, 69);
    doc.text(formatCurrency(-Math.abs(totalGeral)), 140, yPos);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
      doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
    }

    const filename = `relatorio_saidas_por_mes_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${filename}.pdf`);
  };

  const exportPDFPorProjeto = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const groupedData = relatorioData.reduce((acc: any, item: RelatorioSaidaItem) => {
      const projeto = item.projeto_nomes || 'Sem Projeto';
      if (!acc[projeto]) {
        acc[projeto] = [];
      }
      acc[projeto].push(item);
      return acc;
    }, {});

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 14, 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Gestão Financeira', 14, 20);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const titulo = 'RELATÓRIO POR PROJETO';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);

    let yPos = 45;

    Object.keys(groupedData).sort().forEach((projeto) => {
      const items = groupedData[projeto];
      const subtotal = items.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);

      if (yPos > 250) {
        doc.addPage();
        yPos = 25;
      }

      doc.setFillColor(70, 130, 180);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(projeto, 18, yPos);
      yPos += 12;

      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Fornecedor', 18, yPos);
      doc.text('Nº Doc', 55, yPos);
      doc.text('Valor', 80, yPos);
      doc.text('Dt Venc', 105, yPos);
      doc.text('Dt Pag', 130, yPos);
      doc.text('Status', 155, yPos);
      yPos += 12;

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      items.forEach((item: RelatorioSaidaItem, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }

        const valor = parseFloat(item.valor?.toString() || '0') || 0;

        doc.setFontSize(7);
        doc.text(String(item.fornecedor_nome || '').substring(0, 15), 18, yPos);
        doc.text(String(item.numero_documento || '').substring(0, 10), 55, yPos);

        doc.setTextColor(220, 53, 69);
        doc.setFont(undefined, 'bold');
        doc.text(formatCurrency(-Math.abs(valor)), 80, yPos);

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(formatDateForDisplay(item.data_vencimento), 105, yPos);
        doc.text(item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-', 130, yPos);

        if (item.status === 'PAGO') {
          doc.setTextColor(40, 167, 69);
        } else {
          doc.setTextColor(255, 193, 7);
        }
        doc.text(String(item.status || '').substring(0, 8), 155, yPos);
        doc.setTextColor(0, 0, 0);

        yPos += 8;
      });

      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${projeto}:`, 18, yPos + 3);
      doc.setTextColor(220, 53, 69);
      doc.text(formatCurrency(-Math.abs(subtotal)), 80, yPos + 3);
      doc.setTextColor(0, 0, 0);
      yPos += 15;
    });

    const totalGeral = relatorioData.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);
    yPos += 5;
    if (yPos > 260) {
      doc.addPage();
      yPos = 30;
    }
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GERAL:', 100, yPos);
    doc.setTextColor(220, 53, 69);
    doc.text(formatCurrency(-Math.abs(totalGeral)), 140, yPos);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
      doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
    }

    const filename = `relatorio_saidas_por_projeto_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${filename}.pdf`);
  };

  const exportPDFPorGrupo = () => {
    if (!relatorioData || relatorioData.length === 0) return;

    const groupedData = relatorioData.reduce((acc: any, item: RelatorioSaidaItem) => {
      const grupo = item.grupo_contabil || 'Sem Grupo Contábil';
      if (!acc[grupo]) {
        acc[grupo] = [];
      }
      acc[grupo].push(item);
      return acc;
    }, {});

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 14, 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Gestão Financeira', 14, 20);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const titulo = 'RELATÓRIO POR GRUPO CONTÁBIL';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);

    let yPos = 45;

    Object.keys(groupedData).sort().forEach((grupo) => {
      const items = groupedData[grupo];
      const subtotal = items.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);

      if (yPos > 250) {
        doc.addPage();
        yPos = 25;
      }

      doc.setFillColor(70, 130, 180);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(grupo, 18, yPos);
      yPos += 12;

      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Fornecedor', 18, yPos);
      doc.text('Projeto', 55, yPos);
      doc.text('Valor', 90, yPos);
      doc.text('Dt Venc', 115, yPos);
      doc.text('Dt Pag', 140, yPos);
      doc.text('Status', 165, yPos);
      yPos += 12;

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      items.forEach((item: RelatorioSaidaItem, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }

        const valor = parseFloat(item.valor?.toString() || '0') || 0;

        doc.setFontSize(7);
        doc.text(String(item.fornecedor_nome || '').substring(0, 15), 18, yPos);
        doc.text(String(item.projeto_nomes || '').substring(0, 15), 55, yPos);

        doc.setTextColor(220, 53, 69);
        doc.setFont(undefined, 'bold');
        doc.text(formatCurrency(-Math.abs(valor)), 90, yPos);

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(formatDateForDisplay(item.data_vencimento), 115, yPos);
        doc.text(item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-', 140, yPos);

        if (item.status === 'PAGO') {
          doc.setTextColor(40, 167, 69);
        } else {
          doc.setTextColor(255, 193, 7);
        }
        doc.text(String(item.status || '').substring(0, 8), 165, yPos);
        doc.setTextColor(0, 0, 0);

        yPos += 8;
      });

      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${grupo}:`, 18, yPos + 3);
      doc.setTextColor(220, 53, 69);
      doc.text(formatCurrency(-Math.abs(subtotal)), 90, yPos + 3);
      doc.setTextColor(0, 0, 0);
      yPos += 15;
    });

    const totalGeral = relatorioData.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0);
    yPos += 5;
    if (yPos > 260) {
      doc.addPage();
      yPos = 30;
    }
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GERAL:', 100, yPos);
    doc.setTextColor(220, 53, 69);
    doc.text(formatCurrency(-Math.abs(totalGeral)), 140, yPos);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
      doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
    }

    const filename = `relatorio_saidas_por_grupo_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${filename}.pdf`);
  };

  const totalGeral = relatorioData?.reduce((sum: number, item: RelatorioSaidaItem) => sum + (item.valor || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatório Financeiro Saídas</h2>
          <p className="text-muted-foreground">
            Relatório detalhado de todas as movimentações de saída (contas a pagar)
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Matriz</label>
              <Select value={matrizId || 'ALL'} onValueChange={(value) => setMatrizId(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as matrizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as matrizes</SelectItem>
                  {matrizes.map((matriz: any) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={status || 'ALL'} onValueChange={(value) => setStatus(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Ambos</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === 'PAGO' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Conta Corrente</label>
                <Select value={contaId || 'ALL'} onValueChange={(value) => setContaId(value === 'ALL' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as contas</SelectItem>
                    {contas.map((conta: any) => (
                      <SelectItem key={conta.id} value={conta.id.toString()}>
                        {conta.nome} - {conta.banco}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Fornecedor</label>
              <Select value={fornecedorId || 'ALL'} onValueChange={(value) => setFornecedorId(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os fornecedores</SelectItem>
                  {fornecedores.map((fornecedor: any) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id.toString()}>
                      {fornecedor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Competência - Início</label>
              <DatePickerWithYearSelector
                date={dataCompetenciaInicio || undefined}
                onDateChange={setDataCompetenciaInicio}
                placeholder="Selecione a data inicial"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Competência - Fim</label>
              <DatePickerWithYearSelector
                date={dataCompetenciaFim || undefined}
                onDateChange={setDataCompetenciaFim}
                placeholder="Selecione a data final"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Pagamento - Início</label>
              <DatePickerWithYearSelector
                date={dataPagamentoInicio || undefined}
                onDateChange={setDataPagamentoInicio}
                placeholder="Selecione a data inicial"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Pagamento - Fim</label>
              <DatePickerWithYearSelector
                date={dataPagamentoFim || undefined}
                onDateChange={setDataPagamentoFim}
                placeholder="Selecione a data final"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Grupo Contábil</label>
              <Select value={grupoContabilId || 'ALL'} onValueChange={(value) => setGrupoContabilId(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os grupos</SelectItem>
                  {gruposContabeis.map((grupo: any) => (
                    <SelectItem key={grupo.id} value={grupo.id.toString()}>
                      {grupo.descricao} ({grupo.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Subgrupo Contábil</label>
              <Select value={subgrupoContabilId || 'ALL'} onValueChange={(value) => setSubgrupoContabilId(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os subgrupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os subgrupos</SelectItem>
                  {subgruposContabeis.map((subgrupo: any) => (
                    <SelectItem key={subgrupo.id} value={subgrupo.id.toString()}>
                      {subgrupo.descricao} - {subgrupo.grupo_descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Projetos</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {projetoIds.length === 0 
                      ? 'Todos os projetos' 
                      : `${projetoIds.length} projeto(s) selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="max-h-80 overflow-auto p-4 space-y-2">
                    {projetos.map((projeto: any) => (
                      <div key={projeto.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`projeto-${projeto.id}`}
                          checked={projetoIds.includes(projeto.id)}
                          onCheckedChange={() => handleProjetoToggle(projeto.id)}
                        />
                        <label
                          htmlFor={`projeto-${projeto.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {projeto.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {projetoIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {projetoIds.map(id => {
                    const projeto = projetos.find((p: any) => p.id === id);
                    return projeto ? (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {projeto.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveProjeto(id)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateReport}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
            {showRelatorio && relatorioData && relatorioData.length > 0 && (
              <>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <FileDown className="mr-2 h-4 w-4" />
                      Exportar PDF
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportPDFGeral}>
                      Relatório Geral
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDFPorFornecedor}>
                      Por Fornecedor
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDFPorMes}>
                      Por Mês
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDFPorProjeto}>
                      Por Projeto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDFPorGrupo}>
                      Por Grupo Contábil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relatório */}
      {showRelatorio && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Relatório Financeiro Saídas
              </CardTitle>
              <Badge variant="outline" className="text-lg px-3 py-1">
                <DollarSign className="h-4 w-4 mr-1" />
                Total: {formatCurrency(-Math.abs(totalGeral))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {relatorioLoading ? (
              <div className="text-center py-8">Carregando relatório...</div>
            ) : relatorioError ? (
              <div className="text-center py-8 text-red-500">Erro ao carregar relatório</div>
            ) : !relatorioData || relatorioData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado com os filtros selecionados.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Documento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Matriz</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data Vencimento</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorioData.map((item: RelatorioSaidaItem, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.numero_documento || '-'}
                        </TableCell>
                        <TableCell>{item.fornecedor_nome}</TableCell>
                        <TableCell>{item.matriz_nome || '-'}</TableCell>
                        <TableCell>{item.projeto_nomes || '-'}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-red-600">
                            {formatCurrency(-Math.abs(item.valor || 0))}
                          </span>
                        </TableCell>
                        <TableCell>
                          {formatDateForDisplay(item.data_vencimento)}
                        </TableCell>
                        <TableCell>
                          {item.data_pagamento ? formatDateForDisplay(item.data_pagamento) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === 'PAGO' ? 'default' : 'secondary'}
                            className={item.status === 'PAGO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
