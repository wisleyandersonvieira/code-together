import jsPDF from 'jspdf';

interface DreItemResult {
  id: number;
  tipo: string;
  nome: string;
  ordem: number;
  nivel: number;
  valor: number;
  parent_id?: number;
}

interface AportesRetiradas {
  aportes?: any[];
  retiradas?: any[];
}

export function usePdfExport() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const addHeader = (doc: jsPDF, title: string, pageNumber: number, totalPages: number) => {
    // Company/App header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 20, 15);
    
    // Page info
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Página ${pageNumber} de ${totalPages}`, 170, 15);
    
    // Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, 25);
    
    // Line under header
    doc.line(20, 28, 190, 28);
  };

  const addFooter = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, pageHeight - 10);
    doc.text('Sistema de Gestão Financeira', 140, pageHeight - 10);
  };

  const exportDreToPdf = (
    dreData: DreItemResult[],
    title: string,
    params: {
      dataInicio: string;
      dataFim: string;
      tipoData: string;
      matrizNome?: string;
      estruturaNome?: string;
      statusProjeto?: string;
    },
    aportesRetiradas?: AportesRetiradas
  ) => {
    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      
      // Initial header
      addHeader(doc, title, 1, 1);
      
      // Parameters section
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      let yPos = 40;
      
      // Background for parameters
      doc.setFillColor(240, 240, 240);
      doc.rect(20, yPos - 5, 170, 35, 'F');
      
      doc.text('PARÂMETROS DO RELATÓRIO:', 25, yPos);
      yPos += 8;
      
      doc.text(`• Período: ${params.dataInicio} a ${params.dataFim}`, 25, yPos);
      yPos += 6;
      
      doc.text(`• Critério: ${params.tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}`, 25, yPos);
      yPos += 6;
      
      if (params.matrizNome) {
        doc.text(`• Matriz: ${params.matrizNome}`, 25, yPos);
        yPos += 6;
      }
      
      if (params.estruturaNome) {
        doc.text(`• Estrutura DRE: ${params.estruturaNome}`, 25, yPos);
        yPos += 6;
      }

      if (params.statusProjeto) {
        doc.text(`• Status do Projeto: ${params.statusProjeto}`, 25, yPos);
        yPos += 6;
      }
      
      // Table headers
      yPos += 15;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      
      // Header background
      doc.setFillColor(52, 73, 93);
      doc.rect(20, yPos - 4, 170, 10, 'F');
      
      // Set white text color for headers
      doc.setTextColor(255, 255, 255);
      doc.text('Ordem', 22, yPos + 2);
      doc.text('Descrição', 47, yPos + 2);
      doc.text('Valor (R$)', 147, yPos + 2);
      
      // Reset text color to black
      doc.setTextColor(0, 0, 0);
      
      // Line under header
      doc.line(20, yPos + 6, 190, yPos + 6);
      
      yPos += 15;
      
      // Table content
      let currentPage = 1;
      const maxYPos = pageHeight - 30;
      
      dreData.forEach((item, index) => {
        // Add separator line before each GRUPO (except first item)
        if (item.tipo === 'GRUPO' && index > 0) {
          yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
          doc.setDrawColor(200, 200, 200);
          doc.line(20, yPos, 190, yPos);
          doc.setDrawColor(0, 0, 0); // Reset draw color
          yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
        }
        
        // Add separator line above SOMA items
        if (item.tipo === 'SOMA') {
          yPos += 2;
          doc.setDrawColor(150, 150, 150);
          doc.line(20, yPos, 190, yPos);
          doc.setDrawColor(0, 0, 0); // Reset draw color
          yPos += 2;
        }
        
        // Check if we need a new page
        if (yPos > maxYPos) {
          addFooter(doc);
          doc.addPage();
          currentPage++;
          yPos = 35;
          
          // Add header to new page
          addHeader(doc, title, currentPage, currentPage);
          
          // Repeat table headers on new page
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setFillColor(52, 73, 93);
          doc.rect(20, yPos - 4, 170, 10, 'F');
          
          // Set white text color for headers
          doc.setTextColor(255, 255, 255);
          doc.text('Ordem', 22, yPos + 2);
          doc.text('Descrição', 47, yPos + 2);
          doc.text('Valor (R$)', 147, yPos + 2);
          
          // Reset text color to black
          doc.setTextColor(0, 0, 0);
          doc.line(20, yPos + 6, 190, yPos + 6);
          yPos += 15;
        }
        
        // Set font style based on item type
        if (item.tipo === 'GRUPO' || item.tipo === 'SOMA') {
          doc.setFont(undefined, 'bold');
          doc.setFontSize(9);
        } else {
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
        }
        
        // Order
        doc.text(item.ordem.toString(), 22, yPos + 2);
        
        // Name with indentation - sem indicadores de tipo
        const indent = Math.min((item.nivel - 1) * 4, 20); // Max 20pt indent
        const maxNameWidth = 120 - indent;
        let displayName = item.nome;
        
        // Truncate text if too long
        const nameLines = doc.splitTextToSize(displayName, maxNameWidth);
        if (nameLines.length > 1) {
          displayName = nameLines[0] + '...';
        }
        
        doc.text(displayName, 47 + indent, yPos + 2);
        
        // Value with color coding
        const valueText = formatCurrency(item.valor);
        const valueWidth = doc.getTextWidth(valueText);
        
        // Set color based on value
        if (item.valor < 0 || item.tipo === 'RETIRADA') {
          doc.setTextColor(180, 20, 20); // Red for negative values
        } else if (item.valor > 0) {
          doc.setTextColor(20, 120, 20); // Green for positive values
        } else {
          doc.setTextColor(0, 0, 0); // Black for zero
        }
        
        doc.text(valueText, 188 - valueWidth, yPos + 2);
        
        // Reset color
        doc.setTextColor(0, 0, 0);
        
        // Espaçamento reduzido em 30% (de 9 para 6.3)
        yPos += 6.3;
        
        // Add separator line below SOMA items
        if (item.tipo === 'SOMA') {
          yPos += 2;
          doc.setDrawColor(150, 150, 150);
          doc.line(20, yPos, 190, yPos);
          doc.setDrawColor(0, 0, 0); // Reset draw color
          yPos += 2;
        }
        
        // Add sócio details for APORTE and RETIRADA
        if ((item.tipo === 'APORTE' || item.tipo === 'RETIRADA') && aportesRetiradas) {
          const dataArray = item.tipo === 'APORTE' ? aportesRetiradas.aportes || [] : aportesRetiradas.retiradas || [];
          
          if (dataArray.length > 0) {
            // Group by socio
            const socioMap = new Map();
            dataArray.forEach((entry: any) => {
              const socioNome = entry.socio_nome || 'N/A';
              if (!socioMap.has(socioNome)) {
                socioMap.set(socioNome, 0);
              }
              socioMap.set(socioNome, socioMap.get(socioNome) + (entry.valor || 0));
            });
            
            // Add socio details
            doc.setFontSize(7);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(100, 100, 100);
            
            socioMap.forEach((valor: number, socioNome: string) => {
              yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
              if (yPos > maxYPos) {
                addFooter(doc);
                doc.addPage();
                currentPage++;
                yPos = 50;
                addHeader(doc, title, currentPage, currentPage);
              }
              
              const socioText = `  • ${socioNome}: ${formatCurrency(valor)}`;
              doc.text(socioText, 50 + indent, yPos);
            });
            
            // Reset font and color
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
          }
        }
      });
      
      // Linha final da tabela
      doc.line(20, yPos, 190, yPos);
      
      // Update total pages in all headers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        // Update page number in header
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setFillColor(255, 255, 255);
        doc.rect(170, 12, 20, 6, 'F');
        doc.text(`Página ${i} de ${totalPages}`, 170, 15);
        addFooter(doc);
      }
      
      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0];
      const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const fileName = `${cleanTitle}_${dateStr}.pdf`;
      
      doc.save(fileName);
      
      return true;
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      return false;
    }
  };

  return { exportDreToPdf };
}


