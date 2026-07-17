import jsPDF from 'jspdf';

interface DreItemResult {
  id: number;
  tipo: string;
  nome: string;
  ordem: number;
  nivel: number;
  valor: number;
  /** Valor por matriz, quando o DRE é emitido para várias matrizes. */
  valores?: Record<number, number>;
  parent_id?: number;
}

/** Coluna de valor do relatório: uma por matriz, mais a coluna TOTAL. */
export interface DreColuna {
  /** id da matriz, ou 'TOTAL' para a coluna de totalização. */
  key: number | 'TOTAL';
  label: string;
}

interface AportesRetiradas {
  aportes?: any[];
  retiradas?: any[];
  // Registros de empréstimo do período (sem detalhe por sócio no DRE)
  emprestimos?: any[];
}

/** Lê o valor de um item para uma coluna (matriz específica ou TOTAL). */
function valorDaColuna(item: DreItemResult, coluna: DreColuna): number {
  if (coluna.key === 'TOTAL') return item.valor;
  return item.valores?.[coluna.key] ?? 0;
}

export function usePdfExport() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const addHeader = (doc: jsPDF, title: string, pageNumber: number, totalPages: number, right = 190) => {
    // Company/App header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISON', 20, 15);

    // Page info
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Página ${pageNumber} de ${totalPages}`, right - 20, 15);

    // Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, 25);

    // Line under header
    doc.line(20, 28, right, 28);
  };

  const addFooter = (doc: jsPDF, right = 190) => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, pageHeight - 10);
    doc.text('Sistema de Gestão Financeira', right - 50, pageHeight - 10);
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
      /** Nomes das matrizes incluídas no relatório (modo multi-matriz). */
      matrizesNomes?: string[];
      contasNomes?: string[];
    },
    aportesRetiradas?: AportesRetiradas,
    /**
     * Colunas de valor. Omitido → uma única coluna "Valor (R$)" lida de
     * `item.valor` (comportamento legado, usado pelo DRE por projeto).
     */
    colunas?: DreColuna[]
  ) => {
    try {
      const cols: DreColuna[] = colunas?.length ? colunas : [{ key: 'TOTAL', label: 'Valor (R$)' }];

      // Largura: com até 3 colunas de valor o retrato continua cabendo; acima
      // disso passamos para paisagem para não espremer a coluna Descrição.
      const orientation = cols.length > 3 ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation });
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.getWidth();

      const LEFT = 20;
      const RIGHT = pageWidth - 20;
      const NAME_X = 47;

      // Cada coluna de valor recebe uma fatia do espaço à direita da descrição,
      // reservando ~35mm para o nome e limitada a 38mm (largura confortável para
      // "-R$ 1.234.567,89"). Até ~13 colunas isso ainda deixa o nome legível.
      const colW = Math.min(38, Math.max(16, (RIGHT - NAME_X - 35) / cols.length));
      const valuesStart = RIGHT - cols.length * colW;
      // Com uma única coluna preservamos a largura histórica (120mm), para o PDF
      // de matriz única sair idêntico ao de antes. Com várias, a largura deriva
      // de valuesStart, garantindo que o nome nunca invada as colunas de valor.
      const nameMaxWidth = cols.length === 1 ? 120 : Math.max(15, valuesStart - NAME_X - 3);
      const valueFontSize = cols.length > 4 ? 7 : 8;
      /** Borda direita (x) da coluna de índice i — os valores são alinhados à direita nela. */
      const colRight = (i: number) => valuesStart + (i + 1) * colW - 2;

      const drawTableHeader = (y: number) => {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(52, 73, 93);
        doc.rect(LEFT, y - 4, RIGHT - LEFT, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Ordem', LEFT + 2, y + 2);
        doc.text('Descrição', NAME_X, y + 2);
        doc.setFontSize(cols.length > 3 ? 7 : 9);
        cols.forEach((col, i) => {
          const label = doc.splitTextToSize(col.label, colW - 3)[0];
          doc.text(label, colRight(i) - doc.getTextWidth(label), y + 2);
        });
        doc.setTextColor(0, 0, 0);
        doc.line(LEFT, y + 6, RIGHT, y + 6);
      };

      // Initial header
      addHeader(doc, title, 1, 1, RIGHT);

      // Parameters section
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      let yPos = 40;

      // As linhas de parâmetro variam (matriz, estrutura, status...), então o
      // fundo é medido antes de escrever para não cortar nem sobrar.
      const paramLines: string[] = [
        `• Período: ${params.dataInicio} a ${params.dataFim}`,
        `• Critério: ${params.tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}`,
      ];
      if (params.matrizesNomes?.length) {
        doc.splitTextToSize(`• Matrizes: ${params.matrizesNomes.join(', ')}`, RIGHT - LEFT - 10)
          .forEach((line: string) => paramLines.push(line));
      } else if (params.matrizNome) {
        paramLines.push(`• Matriz: ${params.matrizNome}`);
      }
      if (params.estruturaNome) paramLines.push(`• Estrutura DRE: ${params.estruturaNome}`);
      if (params.contasNomes?.length) {
        doc.splitTextToSize(`• Contas: ${params.contasNomes.join(', ')}`, RIGHT - LEFT - 10)
          .forEach((line: string) => paramLines.push(line));
      }
      if (params.statusProjeto) paramLines.push(`• Status do Projeto: ${params.statusProjeto}`);

      // Background for parameters
      doc.setFillColor(240, 240, 240);
      doc.rect(LEFT, yPos - 5, RIGHT - LEFT, 11 + paramLines.length * 6, 'F');

      doc.text('PARÂMETROS DO RELATÓRIO:', 25, yPos);
      yPos += 8;
      paramLines.forEach((line) => {
        doc.text(line, 25, yPos);
        yPos += 6;
      });

      // Table headers
      yPos += 15;
      drawTableHeader(yPos);
      yPos += 15;
      
      // Table content
      let currentPage = 1;
      const maxYPos = pageHeight - 30;
      
      dreData.forEach((item, index) => {
        // Add separator line before each GRUPO (except first item)
        if (item.tipo === 'GRUPO' && index > 0) {
          yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
          doc.setDrawColor(200, 200, 200);
          doc.line(LEFT, yPos, RIGHT, yPos);
          doc.setDrawColor(0, 0, 0); // Reset draw color
          yPos += 3.5; // Reduzido 30% (de 5 para 3.5)
        }

        // Add separator line above SOMA items
        if (item.tipo === 'SOMA') {
          yPos += 2;
          doc.setDrawColor(150, 150, 150);
          doc.line(LEFT, yPos, RIGHT, yPos);
          doc.setDrawColor(0, 0, 0); // Reset draw color
          yPos += 2;
        }

        // Check if we need a new page
        if (yPos > maxYPos) {
          addFooter(doc, RIGHT);
          doc.addPage();
          currentPage++;
          yPos = 35;

          // Add header to new page
          addHeader(doc, title, currentPage, currentPage, RIGHT);

          // Repeat table headers on new page
          drawTableHeader(yPos);
          yPos += 15;
        }
        
        // Set font style based on item type
        const isBoldRow = item.tipo === 'GRUPO' || item.tipo === 'SOMA';
        if (isBoldRow) {
          doc.setFont(undefined, 'bold');
          doc.setFontSize(9);
        } else {
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
        }

        // Order
        doc.text(item.ordem.toString(), LEFT + 2, yPos + 2);

        // Name with indentation - sem indicadores de tipo
        const indent = Math.min((item.nivel - 1) * 4, 20); // Max 20pt indent
        const maxNameWidth = nameMaxWidth - indent;
        let displayName = item.nome;

        // Truncate text if too long
        const nameLines = doc.splitTextToSize(displayName, maxNameWidth);
        if (nameLines.length > 1) {
          displayName = nameLines[0] + '...';
        }

        doc.text(displayName, NAME_X + indent, yPos + 2);

        // Uma célula de valor por coluna (matrizes + TOTAL)
        doc.setFontSize(isBoldRow ? valueFontSize + 1 : valueFontSize);
        cols.forEach((col, i) => {
          const cellValue = valorDaColuna(item, col);
          // TOTAL sempre em negrito, mesmo em linhas de detalhe
          doc.setFont(undefined, isBoldRow || col.key === 'TOTAL' ? 'bold' : 'normal');

          if (cellValue < 0 || item.tipo === 'RETIRADA' || item.tipo === 'EMPRESTIMO_SAIDA') {
            doc.setTextColor(180, 20, 20); // Red for negative values
          } else if (cellValue > 0) {
            doc.setTextColor(20, 120, 20); // Green for positive values
          } else {
            doc.setTextColor(0, 0, 0); // Black for zero
          }

          const valueText = formatCurrency(cellValue);
          doc.text(valueText, colRight(i) - doc.getTextWidth(valueText), yPos + 2);
        });

        // Reset color/estilo para o restante da linha
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, isBoldRow ? 'bold' : 'normal');
        doc.setFontSize(isBoldRow ? 9 : 8);

        // Espaçamento reduzido em 30% (de 9 para 6.3)
        yPos += 6.3;
        
        // Add separator line below SOMA items
        if (item.tipo === 'SOMA') {
          yPos += 2;
          doc.setDrawColor(150, 150, 150);
          doc.line(LEFT, yPos, RIGHT, yPos);
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
                addFooter(doc, RIGHT);
                doc.addPage();
                currentPage++;
                yPos = 50;
                addHeader(doc, title, currentPage, currentPage, RIGHT);
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
      doc.line(LEFT, yPos, RIGHT, yPos);
      
      // Update total pages in all headers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        // Update page number in header
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setFillColor(255, 255, 255);
        doc.rect(RIGHT - 20, 12, 20, 6, 'F');
        doc.text(`Página ${i} de ${totalPages}`, RIGHT - 20, 15);
        addFooter(doc, RIGHT);
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


