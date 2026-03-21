import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface ExportData {
  data_vencimento: string;
  data_pagamento?: string;
  data_recebimento?: string;
  fornecedor_nome?: string;
  cliente_nome?: string;
  projeto_nome: string;
  valor: number;
  conta_nome: string;
  parcela: number;
  total_parcelas: number;
  situacao_pagamento: string;
  numero_documento?: string;
}

export function exportToExcel(
  data: ExportData[], 
  filename: string, 
  type: 'despesas' | 'receitas',
  formatCurrency: (value: number) => string
) {
  // Prepare data for Excel
  const excelData = data.map(item => {
    const baseData = {
      'Data Vencimento': item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '',
      'Projeto': item.projeto_nome || '',
      'Valor': item.valor || 0,
      'Conta Corrente': item.conta_nome || '',
      'Parcela': `${item.parcela}/${item.total_parcelas}`,
      'Situação': item.situacao_pagamento || '',
    };

    if (type === 'despesas') {
      return {
        ...baseData,
        'Data Pagamento': item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '',
        'Fornecedor': item.fornecedor_nome || '',
      };
    } else {
      return {
        'Cliente': item.cliente_nome || '',
        ...baseData,
        'Data Recebimento': item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString('pt-BR') : '',
      };
    }
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);
  
  // Auto-size columns
  const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 15 }));
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type === 'despesas' ? 'Despesas' : 'Receitas');

  // Download file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportExtratoClienteExcel(
  data: any[],
  filename: string,
  clienteNome: string,
  formatCurrency: (value: number) => string
) {
  const excelData = data.map(item => ({
    'Data Pagamento': item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '',
    'Cliente': item.cliente_nome || clienteNome || '',
    'Nº Documento': item.numero_documento || '',
    'Projeto': item.projeto_nome || '',
    'Valor': Number(item.valor) || 0,
    'Conta Corrente': item.conta_corrente || '',
    'Observações': item.observacoes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  despesasData: ExportData[], 
  receitasData: ExportData[],
  filename: string, 
  formatCurrency: (value: number) => string,
  filtros?: any,
  projetoInfo?: any,
  orcamentoData?: any[],
  aportesData?: any[]
) {
  console.log('[PDF Export START] Parâmetros recebidos:');
  console.log('  - despesasData:', despesasData?.length, 'registros');
  console.log('  - receitasData:', receitasData?.length, 'registros');
  console.log('  - filtros:', filtros);
  console.log('  - projetoInfo:', projetoInfo);
  console.log('  - orcamentoData:', orcamentoData?.length, 'registros');
  console.log('  - aportesData:', aportesData?.length, 'registros');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'RELATÓRIO POR PROJETO - EXTRATO';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Informações dos filtros aplicados
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  if (filtros) {
    if (projetoInfo?.name) {
      doc.setFont(undefined, 'bold');
      doc.text(`Projeto: ${projetoInfo.name}`, 14, yPos);
      yPos += 5;
      doc.setFont(undefined, 'normal');
    }
    
    if (filtros.situacaoPagamento) {
      doc.text(`Situação: ${filtros.situacaoPagamento}`, 14, yPos);
      yPos += 5;
    }
    
    if (filtros.dataVencimentoInicio || filtros.dataVencimentoFim) {
      const periodo = `Período Vencimento: ${filtros.dataVencimentoInicio || 'Início'} até ${filtros.dataVencimentoFim || 'Atual'}`;
      doc.text(periodo, 14, yPos);
      yPos += 5;
    }
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;

  const formatDate = (date: string | null) => 
    date ? new Date(date).toLocaleDateString('pt-BR') : '-';

  // 4. PRIMEIRO: Criar extrato unificado (despesas + receitas) ordenado por data de pagamento/recebimento
  const extratoUnificado = [
    ...despesasData.map(item => ({ ...item, tipo: 'despesa' })),
    ...receitasData.map(item => ({ ...item, tipo: 'receita', valor: Math.abs(item.valor || 0) }))
  ].sort((a, b) => {
    const dateA = a.tipo === 'despesa' 
      ? new Date(a.data_pagamento || a.data_vencimento || '1900-01-01').getTime()
      : new Date(a.data_recebimento || a.data_vencimento || '1900-01-01').getTime();
    const dateB = b.tipo === 'despesa'
      ? new Date(b.data_pagamento || b.data_vencimento || '1900-01-01').getTime()
      : new Date(b.data_recebimento || b.data_vencimento || '1900-01-01').getTime();
    return dateA - dateB;
  });

  // Cabeçalho da tabela do extrato
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  
  doc.text('Data Pag/Rec', 18, yPos);
  doc.text('Tipo', 45, yPos);
  doc.text('Fornecedor/Cliente', 58, yPos);
  doc.text('Valor', 110, yPos);
  doc.text('Situação', 140, yPos);
  doc.text('Parcela', 170, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Dados do extrato unificado com linhas alternadas
  extratoUnificado.forEach((item, index) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      
      doc.text('Data Pag/Rec', 18, yPos);
      doc.text('Tipo', 45, yPos);
      doc.text('Fornecedor/Cliente', 58, yPos);
      doc.text('Valor', 110, yPos);
      doc.text('Situação', 140, yPos);
      doc.text('Parcela', 170, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valor = parseFloat(item.valor?.toString() || '0') || 0;
    const valorFinal = item.tipo === 'despesa' ? -Math.abs(valor) : Math.abs(valor);
    
    doc.setFontSize(8);
    const dataExibir = item.tipo === 'despesa' ? item.data_pagamento : item.data_recebimento;
    doc.text(formatDate(dataExibir || item.data_vencimento), 18, yPos);
    doc.text(item.tipo === 'despesa' ? 'DESP' : 'REC', 45, yPos);
    
    if (item.tipo === 'despesa') {
      doc.text(String(item.fornecedor_nome || '').substring(0, 20), 58, yPos);
    } else {
      doc.text(String(item.cliente_nome || '').substring(0, 20), 58, yPos);
    }
    
    // Valor com cor (vermelho para despesa, verde para receita)
    if (item.tipo === 'despesa') {
      doc.setTextColor(220, 53, 69);
    } else {
      doc.setTextColor(40, 167, 69);
    }
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(valorFinal), 110, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.text(String(item.situacao_pagamento || '').substring(0, 10), 140, yPos);
    doc.text(`${item.parcela}/${item.total_parcelas}`, 170, yPos);
    
    yPos += 10;
  });

  // Total do extrato
  const totalDespesas = despesasData.reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalReceitas = receitasData.reduce((sum, item) => sum + (item.valor || 0), 0);
  const saldoLiquido = totalReceitas - totalDespesas;
  
  yPos += 10;
  if (yPos > 270) {
    doc.addPage();
    yPos = 30;
  }
  
  doc.setDrawColor(0, 0, 0);
  doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
  
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 53, 69);
  doc.text(`Total Despesas: ${formatCurrency(-totalDespesas)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(40, 167, 69);
  doc.text(`Total Receitas: ${formatCurrency(totalReceitas)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(saldoLiquido < 0 ? 220 : 40, saldoLiquido < 0 ? 53 : 167, saldoLiquido < 0 ? 69 : 94);
  doc.text(`Saldo Líquido: ${formatCurrency(saldoLiquido)}`, 14, yPos);
  
  yPos += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${extratoUnificado.length} registro(s) encontrado(s)`, 14, yPos);
  
  yPos += 20;

  // 5. SEGUNDO: Quadros de orçamento e aportes (se apenas um projeto selecionado)
  if (projetoInfo) {
    
    // Quadro de Orçamento
    if (orcamentoData && orcamentoData.length > 0) {
      // Nova página se necessário
      if (yPos > 200) {
        doc.addPage();
        yPos = 25;
      }
      
      // Título da seção
      doc.setFillColor(41, 128, 185);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('EVOLUÇÃO DO ORÇAMENTO', 18, yPos);
      yPos += 15;
      
      // Cabeçalho da tabela
      doc.setFillColor(230, 230, 230);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Descrição', 18, yPos);
      doc.text('Data Prevista', 50, yPos);
      doc.text('Valor Orçado', 75, yPos);
      doc.text('Valor Realizado', 105, yPos);
      doc.text('Saldo Restante', 135, yPos);
      doc.text('Progresso', 160, yPos);
      doc.text('Status', 175, yPos);
      
      yPos += 12;
      
      let totalOrcado = 0;
      let totalRealizado = 0;
      
      // Dados do orçamento
      orcamentoData.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
          
          // Repetir cabeçalho
          doc.setFillColor(230, 230, 230);
          doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
          
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'bold');
          doc.setFontSize(8);
          doc.text('Descrição', 18, yPos);
          doc.text('Data Prevista', 50, yPos);
          doc.text('Valor Orçado', 85, yPos);
          doc.text('Valor Realizado', 115, yPos);
          doc.text('Saldo Restante', 150, yPos);
          doc.text('Progresso', 175, yPos);
          doc.text('Status', 190, yPos);
          
          yPos += 12;
        }
        
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }
        
        const valorOrcado = parseFloat(item.valor_orcado?.toString() || '0') || 0;
        const valorRealizado = parseFloat(item.valor_realizado?.toString() || '0') || 0;
        const saldoRestante = valorOrcado - valorRealizado;
        const progresso = valorOrcado > 0 ? (valorRealizado / valorOrcado * 100) : 0;
        
        totalOrcado += valorOrcado;
        totalRealizado += valorRealizado;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text(String(item.description || '').substring(0, 15), 18, yPos);
        doc.text(item.predicted_date ? formatDate(item.predicted_date) : '-', 50, yPos);
        doc.text(formatCurrency(valorOrcado), 75, yPos);
        
        // Valor realizado em verde
        doc.setTextColor(40, 167, 69);
        doc.text(formatCurrency(valorRealizado), 105, yPos);
        
        // Saldo restante em azul
        doc.setTextColor(52, 73, 93);
        doc.text(formatCurrency(saldoRestante), 135, yPos);
        
        // Progresso
        doc.setTextColor(0, 0, 0);
        doc.text(`${progresso.toFixed(1)}%`, 160, yPos);
        
        // Status com cor
        const status = item.status || 'PENDENTE';
        if (status === 'CONCLUÍDO') {
          doc.setTextColor(40, 167, 69);
        } else if (status === 'EM ANDAMENTO') {
          doc.setTextColor(255, 193, 7);
        } else {
          doc.setTextColor(108, 117, 125);
        }
        doc.text(String(status).substring(0, 10), 175, yPos);
        
        yPos += 8;
      });
      
      // Total do orçamento
      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Total:', 18, yPos + 5);
      doc.text(formatCurrency(totalOrcado), 75, yPos + 5);
      yPos += 8;
      doc.setTextColor(40, 167, 69);
      doc.text(`Realizado: ${formatCurrency(totalRealizado)}`, 18, yPos);
      yPos += 6;
      doc.setTextColor(52, 73, 93);
      doc.text(`Saldo restante: ${formatCurrency(totalOrcado - totalRealizado)}`, 18, yPos);
      
      yPos += 20;
    }
    
    // Quadro de Aportes
    if (aportesData && aportesData.length > 0) {
      // Nova página se necessário
      if (yPos > 180) {
        doc.addPage();
        yPos = 25;
      }
      
      // Título da seção
      doc.setFillColor(34, 197, 94);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('EVOLUÇÃO DOS APORTES', 18, yPos);
      yPos += 15;
      
      // Cabeçalho da tabela
      doc.setFillColor(230, 230, 230);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text('Membro', 18, yPos);
      doc.text('Tipo', 45, yPos);
      doc.text('Data Previsão', 60, yPos);
      doc.text('Valor Previsto', 85, yPos);
      doc.text('Valor Realizado', 110, yPos);
      doc.text('Saldo Restante', 135, yPos);
      doc.text('Progresso', 160, yPos);
      doc.text('Status', 175, yPos);
      
      yPos += 12;
      
      let totalPrevisto = 0;
      let totalRealizadoAportes = 0;
      
      // Dados dos aportes
      aportesData.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
          
          // Repetir cabeçalho
          doc.setFillColor(230, 230, 230);
          doc.rect(14, yPos - 6, pageWidth - 28, 10, 'F');
          
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'bold');
          doc.setFontSize(8);
          doc.text('Membro', 18, yPos);
          doc.text('Tipo', 45, yPos);
          doc.text('Data Previsão', 60, yPos);
          doc.text('Valor Previsto', 90, yPos);
          doc.text('Valor Realizado', 120, yPos);
          doc.text('Saldo Restante', 150, yPos);
          doc.text('Progresso', 175, yPos);
          doc.text('Status', 190, yPos);
          
          yPos += 12;
        }
        
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
        }
        
        const valorPrevisto = parseFloat(item.valor_previsto?.toString() || '0') || 0;
        const valorRealizadoItem = parseFloat(item.valor_realizado?.toString() || '0') || 0;
        const saldoRestante = valorPrevisto - valorRealizadoItem;
        const progresso = valorPrevisto > 0 ? (valorRealizadoItem / valorPrevisto * 100) : 0;
        
        totalPrevisto += valorPrevisto;
        totalRealizadoAportes += valorRealizadoItem;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text(String(item.membro_nome || '').substring(0, 12), 18, yPos);
        doc.text(String(item.membro_tipo || '').substring(0, 7), 45, yPos);
        doc.text(item.data_previsao ? formatDate(item.data_previsao) : '-', 60, yPos);
        doc.text(formatCurrency(valorPrevisto), 85, yPos);
        
        // Valor realizado em verde
        doc.setTextColor(40, 167, 69);
        doc.text(formatCurrency(valorRealizadoItem), 110, yPos);
        
        // Saldo restante em azul
        doc.setTextColor(52, 73, 93);
        doc.text(formatCurrency(saldoRestante), 135, yPos);
        
        // Progresso
        doc.setTextColor(0, 0, 0);
        doc.text(`${progresso.toFixed(1)}%`, 160, yPos);
        
        // Status com cor
        const status = item.status || 'PENDENTE';
        if (status === 'CONCLUÍDO') {
          doc.setTextColor(40, 167, 69);
        } else if (status === 'EM ANDAMENTO') {
          doc.setTextColor(255, 193, 7);
        } else {
          doc.setTextColor(108, 117, 125);
        }
        doc.text(String(status).substring(0, 10), 175, yPos);
        
        yPos += 8;
      });
      
      // Total dos aportes
      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.line(14, yPos - 2, pageWidth - 14, yPos - 2);
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Total:', 18, yPos + 5);
      doc.text(formatCurrency(totalPrevisto), 85, yPos + 5);
      yPos += 8;
      doc.setTextColor(40, 167, 69);
      doc.text(`Recebido: ${formatCurrency(totalRealizadoAportes)}`, 18, yPos);
      yPos += 6;
      doc.setTextColor(52, 73, 93);
      doc.text(`Saldo restante: ${formatCurrency(totalPrevisto - totalRealizadoAportes)}`, 18, yPos);
      
      yPos += 20;
      
      // Gráfico de barras VERTICAL: Aportes acumulados por cliente
      // Nova página se necessário
      if (yPos > 100) {
        doc.addPage();
        yPos = 25;
      }
      
      // Agrupar aportes REALIZADOS (valor_realizado do rateio) por cliente
      const clientesMap = new Map<string, number>();
      
      console.log('[PDF Export] Processando aportes para gráfico...'); 
      console.log('[PDF Export] Total de registros em aportesData:', aportesData.length);
      
      aportesData.forEach((item: any, index: number) => {
        console.log(`[PDF Export] Item ${index}:`, {
          membro_nome: item.membro_nome,
          membro_tipo: item.membro_tipo,
          valor_realizado: item.valor_realizado,
          valor_previsto: item.valor_previsto
        });
        
        if (item.membro_tipo === 'cliente') {
          const clienteNome = item.membro_nome || 'N/A';
          const valorRealizado = parseFloat(item.valor_realizado?.toString() || '0') || 0;
          console.log('[PDF Export] ✓ Cliente encontrado:', clienteNome, 'valor:', valorRealizado);
          clientesMap.set(clienteNome, (clientesMap.get(clienteNome) || 0) + valorRealizado);
        } else {
          console.log('[PDF Export] ✗ Item ignorado (não é cliente):', item.membro_tipo);
        }
      });
      
      console.log('[PDF Export] clientesMap (antes do filtro):', Array.from(clientesMap.entries()));
      console.log('[PDF Export] clientesMap size:', clientesMap.size);
      
      // Converter para array e ordenar por valor (maior para menor)
      const clientesArray = Array.from(clientesMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .filter(c => {
          const keep = c.valor > 0;
          if (!keep) {
            console.log('[PDF Export] Filtrado (valor zero):', c.nome, c.valor);
          }
          return keep;
        })
        .sort((a, b) => b.valor - a.valor);
      
      console.log('[PDF Export] clientesArray (após filtro):', clientesArray);
      console.log('[PDF Export] clientesArray length:', clientesArray.length);
      
      if (clientesArray.length > 0) {
        // Título do gráfico
        doc.setFillColor(34, 197, 94);
        doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('GRÁFICO: APORTES ACUMULADOS POR CLIENTE', 18, yPos);
        yPos += 20;
        
        // Configurações do gráfico VERTICAL
        const graphX = 25; // Margem esquerda
        const graphY = yPos;
        const graphWidth = pageWidth - 50; // Largura total do gráfico
        const graphHeight = 100; // Altura fixa do gráfico (espaço para barras verticais)
        const numClientes = clientesArray.length;
        const barSpacing = 5; // Espaçamento entre barras
        const barWidth = Math.min((graphWidth - (numClientes - 1) * barSpacing) / numClientes, 25); // Largura de cada barra
        
        // Encontrar valor máximo para escala vertical
        const maxValor = Math.max(...clientesArray.map(c => c.valor));
        
        // Desenhar eixo horizontal (linha base)
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.line(graphX, graphY + graphHeight, graphX + graphWidth, graphY + graphHeight);
        
        // Desenhar barras verticais
        clientesArray.forEach((cliente, index) => {
          const barX = graphX + index * (barWidth + barSpacing);
          const barHeightPercent = maxValor > 0 ? (cliente.valor / maxValor) : 0;
          const barHeightCalc = graphHeight * barHeightPercent; // Altura proporcional ao valor
          const barY = graphY + graphHeight - barHeightCalc; // Y começa de baixo para cima
          
          // Barra vertical (verde)
          doc.setFillColor(34, 197, 94);
          doc.rect(barX, barY, barWidth, barHeightCalc, 'F');
          
          // Borda da barra
          doc.setDrawColor(22, 163, 74);
          doc.setLineWidth(0.3);
          doc.rect(barX, barY, barWidth, barHeightCalc);
          doc.setLineWidth(0.2); // Reset
          
          // Valor acima da barra
          doc.setFont(undefined, 'bold');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          const valorTexto = formatCurrency(cliente.valor);
          const valorWidth = doc.getTextWidth(valorTexto);
          
          // Centralizar texto acima da barra
          doc.text(valorTexto, barX + (barWidth - valorWidth) / 2, barY - 3);
          
          // Nome do cliente abaixo do eixo (rotacionado ou abreviado)
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          
          // Abreviar nome se muito longo
          const nomeMax = Math.floor(barWidth / 1.5); // Aproximadamente 1.5pt por caractere
          const nomeCliente = cliente.nome.length > nomeMax 
            ? cliente.nome.substring(0, nomeMax - 2) + '..' 
            : cliente.nome;
          
          const nomeWidth = doc.getTextWidth(nomeCliente);
          
          // Rotacionar texto se necessário (45 graus)
          if (nomeWidth > barWidth) {
            // Salvar estado
            const centerX = barX + barWidth / 2;
            const centerY = graphY + graphHeight + 3;
            
            // Aplicar rotação
            doc.saveGraphicsState();
            doc.setTextColor(0, 0, 0);
            
            // Texto rotacionado (aproximação sem rotação real - usar texto menor)
            doc.setFontSize(6);
            const nomeAbreviado = cliente.nome.substring(0, 8);
            doc.text(nomeAbreviado, barX, graphY + graphHeight + 8);
            doc.restoreGraphicsState();
          } else {
            // Texto normal abaixo
            doc.text(nomeCliente, barX + (barWidth - nomeWidth) / 2, graphY + graphHeight + 8);
          }
        });
        
        yPos = graphY + graphHeight + 20;
        
        // Total geral dos clientes
        const totalClientes = clientesArray.reduce((sum, c) => sum + c.valor, 0);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(34, 197, 94);
        doc.text(`Total de Aportes Realizados: ${formatCurrency(totalClientes)}`, graphX, yPos);
        
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`${clientesArray.length} cliente(s) com aportes realizados`, graphX, yPos);
      }
    }
  } // Fim do if (projetoInfo)
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }

  // Download file
  doc.save(`${filename}.pdf`);
}

// Interface específica para extrato do cliente
interface ExtratoClienteData {
  data_pagamento: string;
  projeto_nome?: string;
  valor: number;
  conta_corrente?: string;
  [key: string]: any;
}

// Interface para dados do extrato bancário
interface ExtratoBancarioData {
  data: string;
  tipo: string;
  fornecedor_creditor: string;
  numero_documento?: string;
  projeto?: string;
  matriz_nome?: string;
  valor: number;
  saldo_linha?: number;
  [key: string]: any;
}

// Função específica para PDF do extrato bancário
export function exportExtratoBancarioPDF(
  data: ExtratoBancarioData[],
  filename: string,
  contaInfo: {
    conta_nome: string;
    conta_banco: string;
    saldo_anterior: number;
  },
  filtros: {
    dataInicio: string;
    dataFim: string;
    tipo?: string;
    matrizNome?: string;
  },
  formatCurrency: (value: number) => string,
  formatDate: (date: string) => string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'EXTRATO BANCÁRIO';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Informações da conta e filtros aplicados
  let yPos = 45;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Conta: ${contaInfo.conta_nome} - ${contaInfo.conta_banco}`, 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Período
  const periodo = `Período: ${filtros.dataInicio} até ${filtros.dataFim}`;
  doc.text(periodo, 14, yPos);
  yPos += 5;
  
  // Saldo anterior
  doc.text(`Saldo Anterior: ${formatCurrency(contaInfo.saldo_anterior)}`, 14, yPos);
  yPos += 5;
  
  // Filtros aplicados
  if (filtros.tipo) {
    doc.text(`Tipo: ${filtros.tipo}`, 14, yPos);
    yPos += 5;
  }
  
  if (filtros.matrizNome) {
    doc.text(`Matriz: ${filtros.matrizNome}`, 14, yPos);
    yPos += 5;
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;
  
  // 4. Dados em formato tabular igual à tela
  // Cabeçalho da tabela com cores
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.text('Data', 18, yPos);
  doc.text('Tipo', 40, yPos);
  doc.text('Fornecedor/Credor', 55, yPos);
  doc.text('Nº Doc', 90, yPos);
  doc.text('Projeto', 110, yPos);
  doc.text('Matriz', 145, yPos);
  doc.text('Valor', 160, yPos);
  doc.text('Saldo', 180, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Dados da tabela com linhas alternadas
  data.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (yPos > 270) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text('Data', 18, yPos);
      doc.text('Tipo', 40, yPos);
      doc.text('Fornecedor/Credor', 55, yPos);
      doc.text('Nº Doc', 90, yPos);
      doc.text('Projeto', 110, yPos);
      doc.text('Matriz', 145, yPos);
      doc.text('Valor', 160, yPos);
      doc.text('Saldo', 180, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Linha alternada de cor (igual à tela)
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valor = parseFloat(item.valor?.toString() || '0') || 0;
    const saldo = parseFloat(item.saldo_linha?.toString() || '0') || 0;
    
    doc.setFontSize(8);
    doc.text(formatDate(item.data), 18, yPos);
    doc.text(String(item.tipo || '').substring(0, 4), 40, yPos);
    doc.text(String(item.fornecedor_creditor || '').substring(0, 15), 55, yPos);
    doc.text(String(item.numero_documento || '-').substring(0, 6), 90, yPos);
    doc.setFontSize(6.4); // Reduzindo 20% da fonte (de 8 para 6.4)
    doc.text(String(item.projeto || '-').substring(0, 15), 110, yPos); // Aumentando de 10 para 15 caracteres (30% mais)
    doc.setFontSize(8); // Voltando ao tamanho original para as outras colunas
    doc.text(String(item.matriz_nome || '-').substring(0, 10), 145, yPos);
    
    // Valor com cor (vermelho para negativo, verde para positivo)
    if (valor < 0) {
      doc.setTextColor(220, 53, 69);
    } else if (valor > 0) {
      doc.setTextColor(40, 167, 69);
    }
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(valor), 160, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(saldo), 180, yPos);
    
    doc.setFont(undefined, 'normal');
    yPos += 10;
  });
  
  // Linha de separação e saldo final
  yPos += 10;
  if (yPos > 270) {
    doc.addPage();
    yPos = 30;
  }
  
  doc.setDrawColor(0, 0, 0);
  doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
  
  const saldoFinal = data.length > 0 ? (data[data.length - 1].saldo_linha || 0) : contaInfo.saldo_anterior;
  
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('SALDO FINAL:', 100, yPos);
  doc.setTextColor(saldoFinal < 0 ? 220 : 40, saldoFinal < 0 ? 53 : 167, saldoFinal < 0 ? 69 : 94);
  doc.text(formatCurrency(saldoFinal), 140, yPos);
  
  // Informação de número de registros
  yPos += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${data.length} movimentação(ões) encontrada(s)`, 14, yPos);
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}

// Função específica para PDF do Relatório Projetos Geral
export function exportRelatorioProjetosGeralPDF(
  dadosRelatorio: any[],
  filename: string,
  formatCurrency: (value: number) => string,
  filtros: {
    projetoIds?: number[];
    dataPagamentoInicio?: string | null;
    dataPagamentoFim?: string | null;
  },
  totalReceitas: number,
  totalDespesas: number,
  saldoGeral: number,
  projetos?: any[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'RELATÓRIO PROJETOS GERAL';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Informações dos filtros aplicados
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Projetos selecionados
  if (filtros.projetoIds && filtros.projetoIds.length > 0 && projetos) {
    if (filtros.projetoIds.length === projetos.length) {
      doc.text('Projetos: Todos os projetos', 14, yPos);
    } else {
      const nomesProjetos = filtros.projetoIds.map(id => 
        projetos.find((p: any) => p.id === id)?.name || `ID ${id}`
      );
      const textoLimitado = nomesProjetos.length <= 3 
        ? `Projetos: ${nomesProjetos.join(', ')}`
        : `Projetos: ${nomesProjetos.slice(0, 2).join(', ')} e mais ${nomesProjetos.length - 2}`;
      doc.text(textoLimitado, 14, yPos);
    }
    yPos += 5;
  }
  
  if (filtros.dataPagamentoInicio || filtros.dataPagamentoFim) {
    const periodo = `Período Pagamento: ${filtros.dataPagamentoInicio ? new Date(filtros.dataPagamentoInicio).toLocaleDateString('pt-BR') : 'Início'} até ${filtros.dataPagamentoFim ? new Date(filtros.dataPagamentoFim).toLocaleDateString('pt-BR') : 'Atual'}`;
    doc.text(periodo, 14, yPos);
    yPos += 5;
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;

  // 4. Cards de resumo (como na tela)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('RESUMO GERAL', 14, yPos);
  yPos += 10;

  // Background para o resumo
  doc.setFillColor(248, 249, 250);
  doc.rect(14, yPos - 5, pageWidth - 28, 25, 'F');

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Total Receitas:', 20, yPos);
  doc.setTextColor(34, 197, 94); // Verde
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(totalReceitas), 70, yPos);

  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text('Total Despesas:', 20, yPos);
  doc.setTextColor(239, 68, 68); // Vermelho
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(totalDespesas), 70, yPos);

  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text('Saldo Geral:', 20, yPos);
  doc.setTextColor(saldoGeral >= 0 ? 34 : 239, saldoGeral >= 0 ? 197 : 68, saldoGeral >= 0 ? 94 : 68);
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(saldoGeral), 70, yPos);

  yPos += 20;
  doc.setTextColor(0, 0, 0);

  // 5. Tabela principal (igual à tela)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Relatório por Projeto (${dadosRelatorio.length} projetos)`, 14, yPos);
  yPos += 15;

  // Cabeçalho da tabela com cores
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Projeto', 18, yPos);
  doc.text('Valor Receitas', 80, yPos);
  doc.text('Valor Despesas', 115, yPos);
  doc.text('Saldo', 150, yPos);
  doc.text('Status', 175, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Dados da tabela com linhas alternadas (igual à tela)
  dadosRelatorio.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (yPos > 260) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Projeto', 18, yPos);
      doc.text('Valor Receitas', 80, yPos);
      doc.text('Valor Despesas', 115, yPos);
      doc.text('Saldo', 150, yPos);
      doc.text('Status', 175, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Linha alternada de cor (igual à tela)
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valorReceitas = item.valor_receitas || 0;
    const valorDespesas = item.valor_despesas || 0;
    const saldo = item.saldo || 0;
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    // Projeto
    const nomeProjeto = String(item.projeto_nome || '');
    doc.text(nomeProjeto.length > 25 ? nomeProjeto.substring(0, 22) + '...' : nomeProjeto, 18, yPos);
    
    // Valor Receitas (verde, como na tela)
    doc.setTextColor(34, 197, 94);
    doc.setFont(undefined, 'normal');
    doc.text(formatCurrency(valorReceitas), 80, yPos);
    
    // Valor Despesas (vermelho, como na tela)
    doc.setTextColor(239, 68, 68);
    doc.text(formatCurrency(valorDespesas), 115, yPos);
    
    // Saldo (verde se positivo, vermelho se negativo, como na tela)
    doc.setTextColor(saldo >= 0 ? 34 : 239, saldo >= 0 ? 197 : 68, saldo >= 0 ? 94 : 68);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(saldo), 150, yPos);
    
    // Status (como na tela)
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    let status = 'Equilibrado';
    if (saldo > 0) status = 'Positivo';
    else if (saldo < 0) status = 'Negativo';
    doc.text(status, 175, yPos);
    
    yPos += 10;
  });
  
  // Linha de separação antes do total
  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 10;
  
  // Verificar se precisa de nova página para o total
  if (yPos > 260) {
    doc.addPage();
    yPos = 30;
  }
  
  // Linha TOTAL GERAL (igual à tela - com fundo cinza)
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos - 4, pageWidth - 28, 12, 'F');
  
  // Borda mais grossa para o total
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.rect(14, yPos - 4, pageWidth - 28, 12);
  doc.setLineWidth(0.2); // Reset line width
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  
  // TOTAL GERAL
  doc.text('TOTAL GERAL', 18, yPos + 4);
  
  // Total Receitas (verde)
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(totalReceitas), 80, yPos + 4);
  
  // Total Despesas (vermelho)
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrency(totalDespesas), 115, yPos + 4);
  
  // Saldo Geral (verde se positivo, vermelho se negativo)
  doc.setTextColor(saldoGeral >= 0 ? 34 : 239, saldoGeral >= 0 ? 197 : 68, saldoGeral >= 0 ? 94 : 68);
  doc.text(formatCurrency(saldoGeral), 150, yPos + 4);
  
  // Status Total
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  let statusGeral = 'Equilibrado';
  if (saldoGeral > 0) statusGeral = 'Positivo';
  else if (saldoGeral < 0) statusGeral = 'Negativo';
  doc.text(statusGeral, 175, yPos + 4);
  
  yPos += 20;
  
  // Informação de número de projetos
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${dadosRelatorio.length} projeto(s) com movimentações`, 14, yPos);
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}

// Função específica para PDF com gráficos do Relatório por Projeto
export function exportChartsOnlyToPDF(
  despesasPorGrupo: Array<{ grupo_nome: string; valor_total: number }>,
  receitasPorCliente: Array<{ cliente_nome: string; valor_total: number }>,
  filename: string,
  formatCurrency: (value: number) => string,
  projetoInfo: { name: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'RELATÓRIO DESPESAS E APORTES';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Nome do projeto
  let yPos = 45;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Projeto: ${projetoInfo.name}`, 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 20;

  // ==================== GRÁFICO 1: DESPESAS POR GRUPO ====================
  if (despesasPorGrupo.length > 0) {
    // Título do gráfico
    doc.setFillColor(239, 68, 68);
    doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('DESPESAS', 18, yPos);
    yPos += 20;
    
    // Configurações do gráfico VERTICAL
    const graphX = 25;
    const graphY = yPos;
    const graphWidth = pageWidth - 50;
    const graphHeight = 100;
    const numGrupos = despesasPorGrupo.length;
    const barSpacing = 5;
    const barWidth = Math.min((graphWidth - (numGrupos - 1) * barSpacing) / numGrupos, 25);
    
    // Encontrar valor máximo para escala vertical
    const maxValorDespesas = Math.max(...despesasPorGrupo.map(g => g.valor_total));
    
    // Desenhar eixo horizontal (linha base)
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(graphX, graphY + graphHeight, graphX + graphWidth, graphY + graphHeight);
    
    // Desenhar barras verticais
    despesasPorGrupo.forEach((grupo, index) => {
      const barX = graphX + index * (barWidth + barSpacing);
      const barHeightPercent = maxValorDespesas > 0 ? (grupo.valor_total / maxValorDespesas) : 0;
      const barHeightCalc = graphHeight * barHeightPercent;
      const barY = graphY + graphHeight - barHeightCalc;
      
      // Barra vertical (vermelha)
      doc.setFillColor(239, 68, 68);
      doc.rect(barX, barY, barWidth, barHeightCalc, 'F');
      
      // Borda da barra
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.3);
      doc.rect(barX, barY, barWidth, barHeightCalc);
      doc.setLineWidth(0.2);
      
      // Valor acima da barra
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      const valorTexto = formatCurrency(grupo.valor_total);
      const valorWidth = doc.getTextWidth(valorTexto);
      doc.text(valorTexto, barX + (barWidth - valorWidth) / 2, barY - 3);
      
      // Nome do grupo abaixo do eixo
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      
      const nomeMax = Math.floor(barWidth / 1.5);
      const nomeGrupo = grupo.grupo_nome.length > nomeMax 
        ? grupo.grupo_nome.substring(0, nomeMax - 2) + '..' 
        : grupo.grupo_nome;
      
      const nomeWidth = doc.getTextWidth(nomeGrupo);
      
      if (nomeWidth > barWidth) {
        doc.setFontSize(6);
        const nomeAbreviado = grupo.grupo_nome.substring(0, 8);
        doc.text(nomeAbreviado, barX, graphY + graphHeight + 8);
      } else {
        doc.text(nomeGrupo, barX + (barWidth - nomeWidth) / 2, graphY + graphHeight + 8);
      }
    });
    
    yPos = graphY + graphHeight + 20;
    
    // Total geral das despesas
    const totalDespesas = despesasPorGrupo.reduce((sum, g) => sum + g.valor_total, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68);
    doc.text(`Total de Despesas: ${formatCurrency(totalDespesas)}`, graphX, yPos);
    
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${despesasPorGrupo.length} grupo(s) com despesas`, graphX, yPos);
    
    yPos += 30;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma despesa encontrada para este projeto.', 14, yPos);
    yPos += 20;
  }

  // ==================== GRÁFICO 2: RECEITAS POR CLIENTE ====================
  // Nova página se necessário
  if (yPos > 100) {
    doc.addPage();
    yPos = 25;
  }
  
  if (receitasPorCliente.length > 0) {
    // Título do gráfico
    doc.setFillColor(34, 197, 94);
    doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('APORTES', 18, yPos);
    yPos += 20;
    
    // Configurações do gráfico VERTICAL
    const graphX = 25;
    const graphY = yPos;
    const graphWidth = pageWidth - 50;
    const graphHeight = 100;
    const numClientes = receitasPorCliente.length;
    const barSpacing = 5;
    const barWidth = Math.min((graphWidth - (numClientes - 1) * barSpacing) / numClientes, 25);
    
    // Encontrar valor máximo para escala vertical
    const maxValorReceitas = Math.max(...receitasPorCliente.map(c => c.valor_total));
    
    // Desenhar eixo horizontal (linha base)
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(graphX, graphY + graphHeight, graphX + graphWidth, graphY + graphHeight);
    
    // Desenhar barras verticais
    receitasPorCliente.forEach((cliente, index) => {
      const barX = graphX + index * (barWidth + barSpacing);
      const barHeightPercent = maxValorReceitas > 0 ? (cliente.valor_total / maxValorReceitas) : 0;
      const barHeightCalc = graphHeight * barHeightPercent;
      const barY = graphY + graphHeight - barHeightCalc;
      
      // Barra vertical (verde)
      doc.setFillColor(34, 197, 94);
      doc.rect(barX, barY, barWidth, barHeightCalc, 'F');
      
      // Borda da barra
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.3);
      doc.rect(barX, barY, barWidth, barHeightCalc);
      doc.setLineWidth(0.2);
      
      // Valor acima da barra
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      const valorTexto = formatCurrency(cliente.valor_total);
      const valorWidth = doc.getTextWidth(valorTexto);
      doc.text(valorTexto, barX + (barWidth - valorWidth) / 2, barY - 3);
      
      // Nome do cliente abaixo do eixo
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      
      const nomeMax = Math.floor(barWidth / 1.5);
      const nomeCliente = cliente.cliente_nome.length > nomeMax 
        ? cliente.cliente_nome.substring(0, nomeMax - 2) + '..' 
        : cliente.cliente_nome;
      
      const nomeWidth = doc.getTextWidth(nomeCliente);
      
      if (nomeWidth > barWidth) {
        doc.setFontSize(6);
        const nomeAbreviado = cliente.cliente_nome.substring(0, 8);
        doc.text(nomeAbreviado, barX, graphY + graphHeight + 8);
      } else {
        doc.text(nomeCliente, barX + (barWidth - nomeWidth) / 2, graphY + graphHeight + 8);
      }
    });
    
    yPos = graphY + graphHeight + 20;
    
    // Total geral das receitas
    const totalReceitas = receitasPorCliente.reduce((sum, c) => sum + c.valor_total, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text(`Total de Receitas: ${formatCurrency(totalReceitas)}`, graphX, yPos);
    
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${receitasPorCliente.length} cliente(s) com receitas`, graphX, yPos);
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma receita encontrada para este projeto.', 14, yPos);
  }

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }

  // Download file
  doc.save(`${filename}.pdf`);
}

// Função específica para PDF do extrato do cliente
export function exportExtratoClientePDF(
  data: ExtratoClienteData[],
  filename: string,
  clienteNome: string,
  filtros: {
    projetoNome?: string;
    contaNome?: string;
    dataInicio?: string;
    dataFim?: string;
  },
  formatCurrency: (value: number) => string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'EXTRATO DO CLIENTE';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Nome do cliente e filtros aplicados
  let yPos = 45;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Cliente: ${clienteNome}`, 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Exibir filtros aplicados
  if (filtros.projetoNome) {
    doc.text(`Projeto: ${filtros.projetoNome}`, 14, yPos);
    yPos += 5;
  }
  
  if (filtros.contaNome) {
    doc.text(`Conta: ${filtros.contaNome}`, 14, yPos);
    yPos += 5;
  }
  
  if (filtros.dataInicio || filtros.dataFim) {
    const periodo = `Período: ${
      filtros.dataInicio ? new Date(filtros.dataInicio).toLocaleDateString('pt-BR') : 'Início'
    } até ${
      filtros.dataFim ? new Date(filtros.dataFim).toLocaleDateString('pt-BR') : 'Atual'
    }`;
    doc.text(periodo, 14, yPos);
    yPos += 5;
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;
  
  // 4. Dados em formato tabular igual à tela
  // Cabeçalho da tabela com cores
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Data de Pagamento', 18, yPos);
  doc.text('Projeto', 70, yPos);
  doc.text('Valor', 130, yPos);
  doc.text('Conta Corrente', 165, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Função para formatar data
  const formatDate = (date: string | null) => {
    return date ? new Date(date).toLocaleDateString('pt-BR') : '-';
  };
  
  let total = 0;
  
  // Dados da tabela com linhas alternadas
  data.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (yPos > 270) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Data de Pagamento', 18, yPos);
      doc.text('Projeto', 70, yPos);
      doc.text('Valor', 130, yPos);
      doc.text('Conta Corrente', 165, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Linha alternada de cor (igual à tela)
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valor = parseFloat(item.valor?.toString() || '0') || 0;
    total += valor;
    
    doc.setFontSize(9);
    doc.text(formatDate(item.data_pagamento), 18, yPos);
    doc.text((item.projeto_nome || '-').substring(0, 25), 70, yPos);
    
    // Valor em verde (igual à tela)
    doc.setTextColor(34, 197, 94);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(valor), 130, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.text((item.conta_corrente || '-').substring(0, 20), 165, yPos);
    
    yPos += 10;
  });
  
  // Linha de separação e total
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
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(total), 140, yPos);
  
  // Informação de número de registros
  yPos += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${data.length} movimentação(ões) encontrada(s)`, 14, yPos);
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}
