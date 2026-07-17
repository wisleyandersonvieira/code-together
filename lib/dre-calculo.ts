/**
 * Cálculo do DRE — funções puras, sem React, para poderem ser testadas e
 * reutilizadas. A fórmula de cada tipo de item é a original do DreDataLoader;
 * a única generalização é rodar por matriz.
 */

export interface DreItemCalculado {
  id: number;
  tipo: string;
  ordem: number;
  valor: number;
}

/** Registros de uma matriz específica. */
export const porMatriz = (rows: any[], matrizId: number) =>
  (rows || []).filter((row: any) => Number(row.matriz_id) === matrizId);

/**
 * Calcula o valor de cada item da estrutura para UMA matriz.
 *
 * Os arrays recebidos já vêm filtrados pela matriz em questão, de modo que a
 * fórmula abaixo é exatamente a mesma usada quando o DRE era emitido para uma
 * única matriz — apenas foi extraída para poder rodar N vezes.
 */
export function calcularItensParaMatriz(
  estruturaItens: any[],
  contasPagar: any[],
  contasReceber: any[],
  aportes: any[],
  retiradas: any[],
  emprestimos: any[],
): DreItemCalculado[] {
  // Process and calculate values for each structure item
  const processedItems = estruturaItens.map((item: any) => {
    let valor = 0;

    if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
      // Calculate value from contas pagar/receber
      // Use Number() to handle PostgreSQL NUMERIC types returned as strings
      const contasPagarValues = contasPagar
        .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
        .reduce((sum: number, cp: any) => sum + (Number(cp.valor_total) || 0), 0);

      const contasReceberValues = contasReceber
        .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
        .reduce((sum: number, cr: any) => sum + (Number(cr.valor_total) || 0), 0);

      valor = contasPagarValues + contasReceberValues;

      // Apply sign based on function from structure (débito = negative, crédito = positive)
      if (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO') {
        valor = -valor;
      }
    } else if (item.tipo === 'APORTE') {
      // Sum all aportes (positive)
      valor = aportes.reduce((sum: number, aporte: any) => sum + (Number(aporte.valor) || 0), 0);
    } else if (item.tipo === 'RETIRADA') {
      // Sum all retiradas (negative)
      valor = -retiradas.reduce((sum: number, retirada: any) => sum + (Number(retirada.valor) || 0), 0);
    } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
      // Pagamentos de empréstimo entram no caixa (positive)
      valor = emprestimos
        .filter((e: any) => e.tipo === 'PAGAMENTO')
        .reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
    } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
      // Empréstimos concedidos saem do caixa (negative)
      valor = -emprestimos
        .filter((e: any) => e.tipo === 'EMPRESTIMO')
        .reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
    } else if (item.tipo === 'GRUPO') {
      // Group value is sum of its subgroups
      const subgroupValues = estruturaItens
        .filter((subitem: any) => subitem.tipo === 'SUBGRUPO' && subitem.parent_id === item.id)
        .reduce((sum: number, subitem: any) => {
          // Calculate subgroup value (same logic as above)
          let subgroupValue = 0;
          if (subitem.subgrupo_contabil_id) {
            const contasPagarValues = contasPagar
              .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(subitem.subgrupo_contabil_id))
              .reduce((sum: number, cp: any) => sum + (Number(cp.valor_total) || 0), 0);

            const contasReceberValues = contasReceber
              .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(subitem.subgrupo_contabil_id))
              .reduce((sum: number, cr: any) => sum + (Number(cr.valor_total) || 0), 0);

            subgroupValue = contasPagarValues + contasReceberValues;

            // Get subgroup function from structure
            if (subitem.subgrupo_funcao === 'Débito' || subitem.subgrupo_funcao === 'DEBITO') {
              subgroupValue = -subgroupValue;
            }
          }
          return sum + subgroupValue;
        }, 0);
      valor = subgroupValues;
    }

    return { id: item.id, tipo: item.tipo, ordem: item.ordem, valor };
  });

  // Sort items by order to process SOMA lines correctly
  const sortedItems = processedItems.sort((a, b) => a.ordem - b.ordem);

  // Calculate SOMA items: sum all items with lower order numbers
  return sortedItems.map((item, index) => {
    if (item.tipo === 'SOMA') {
      // Sum only SUBGRUPOS, APORTES e RETIRADAS above this SOMA line (exclude GRUPOS to avoid duplication)
      const itemsAbove = sortedItems.slice(0, index).filter(aboveItem =>
        aboveItem.tipo === 'SUBGRUPO' ||
        aboveItem.tipo === 'APORTE' ||
        aboveItem.tipo === 'RETIRADA' ||
        aboveItem.tipo === 'EMPRESTIMO_ENTRADA' ||
        aboveItem.tipo === 'EMPRESTIMO_SAIDA'
      );

      const somaValue = itemsAbove.reduce((sum: number, aboveItem) => {
        return sum + aboveItem.valor;
      }, 0);

      return { ...item, valor: somaValue };
    }
    return item;
  });
}
