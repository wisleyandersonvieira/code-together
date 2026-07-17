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

/** Um lançamento individual que compõe a célula de um subgrupo. */
export interface DreLancamento {
  /** Identificador do registro vindo da action (titulo_X_item_Y). */
  id: string;
  origem: 'PAGAR' | 'RECEBER';
  matrizId: number;
  numeroDocumento: string;
  fornecedorNome: string;
  produtoNome: string;
  /** Já com o sinal do subgrupo aplicado — soma exatamente à célula. */
  valor: number;
}

/** Registros de uma matriz específica. */
export const porMatriz = (rows: any[], matrizId: number) =>
  (rows || []).filter((row: any) => Number(row.matriz_id) === matrizId);

/**
 * Sinal do subgrupo: Débito reduz o resultado (negativo), Crédito soma.
 * Regra única, usada tanto pelo cálculo da célula quanto pelo drill-down —
 * é o que garante que as sublinhas somem exatamente o valor da célula.
 */
export function aplicarSinalSubgrupo(valor: number, subgrupoFuncao?: string): number {
  // Apply sign based on function from structure (débito = negative, crédito = positive)
  if (subgrupoFuncao === 'Débito' || subgrupoFuncao === 'DEBITO') {
    return -valor;
  }
  return valor;
}

/**
 * Sinal das linhas de sócio (APORTE/RETIRADA/EMPRÉSTIMOS): entradas somam
 * (positivo), saídas subtraem (negativo). Regra única, usada tanto pelo cálculo
 * da célula quanto pelo drill-down — garante que as sublinhas somem exatamente
 * o valor da célula. Análogo a [[aplicarSinalSubgrupo]] para os subgrupos.
 */
export function aplicarSinalLinha(valor: number, tipo: string): number {
  if (tipo === 'RETIRADA' || tipo === 'EMPRESTIMO_SAIDA') {
    return -valor;
  }
  return valor;
}

/** Um lançamento individual que compõe a célula de APORTE/RETIRADA/EMPRÉSTIMO. */
export interface DreLancamentoLinha {
  /** Identificador do registro na sua fonte. */
  id: string;
  matrizId: number;
  /** Data crua da fonte (data_aporte / data_retirada / data_referencia). */
  data: string;
  socioNome: string;
  /** Já com o sinal da linha aplicado — soma exatamente à célula. */
  valor: number;
}

/**
 * Lançamentos que compõem a célula de uma linha de sócio (APORTE, RETIRADA,
 * EMPRESTIMO_ENTRADA, EMPRESTIMO_SAIDA), para o drill-down.
 *
 * Usa os mesmos registros já em memória, o mesmo filtro por tipo de empréstimo
 * (PAGAMENTO ↔ entrada, EMPRESTIMO ↔ saída) e o mesmo sinal do cálculo da
 * célula. Somar estes lançamentos por matriz reproduz o valor da célula.
 */
export function lancamentosDaLinha(
  tipo: string,
  aportes: any[],
  retiradas: any[],
  emprestimos: any[],
  matrizIds: number[],
): DreLancamentoLinha[] {
  let rows: any[] = [];
  let dataCol = '';
  if (tipo === 'APORTE') {
    rows = aportes || [];
    dataCol = 'data_aporte';
  } else if (tipo === 'RETIRADA') {
    rows = retiradas || [];
    dataCol = 'data_retirada';
  } else if (tipo === 'EMPRESTIMO_ENTRADA') {
    rows = (emprestimos || []).filter((e: any) => e.tipo === 'PAGAMENTO');
    dataCol = 'data_referencia';
  } else if (tipo === 'EMPRESTIMO_SAIDA') {
    rows = (emprestimos || []).filter((e: any) => e.tipo === 'EMPRESTIMO');
    dataCol = 'data_referencia';
  } else {
    return [];
  }

  const lancamentos = rows
    .filter((row: any) => matrizIds.includes(Number(row.matriz_id)))
    .map((row: any) => ({
      id: String(row.id),
      matrizId: Number(row.matriz_id),
      data: String(row[dataCol] ?? ''),
      socioNome: row.socio_nome ?? '—',
      valor: aplicarSinalLinha(Number(row.valor) || 0, tipo),
    }));

  // Ordenação: pela ordem das colunas de matriz, depois data decrescente (mais
  // recente primeiro, como as actions de aportes/retiradas já listam) e, por
  // fim, nome do sócio — determinístico para o mesmo dado.
  return lancamentos.sort((a, b) => {
    const posA = matrizIds.indexOf(a.matrizId);
    const posB = matrizIds.indexOf(b.matrizId);
    if (posA !== posB) return posA - posB;
    const dataCmp = b.data.localeCompare(a.data);
    if (dataCmp !== 0) return dataCmp;
    return a.socioNome.localeCompare(b.socioNome, 'pt-BR');
  });
}

/** Registros de uma fonte que pertencem a um subgrupo. */
const porSubgrupo = (rows: any[], subgrupoContabilId: number) =>
  (rows || []).filter(
    (row: any) => Number(row.subgrupo_contabil_id) === Number(subgrupoContabilId),
  );

/**
 * Lançamentos que compõem a célula de um subgrupo, para o drill-down.
 *
 * Usa exatamente os mesmos registros, o mesmo filtro e o mesmo sinal do cálculo
 * da célula — e o `valor_total` já rateado que veio da action, sem recalcular.
 * Por construção, somar estes lançamentos reproduz o valor da célula.
 */
export function lancamentosDoSubgrupo(
  contasPagar: any[],
  contasReceber: any[],
  subgrupoContabilId: number,
  subgrupoFuncao: string | undefined,
  matrizIds: number[],
): DreLancamento[] {
  const mapear = (rows: any[], origem: 'PAGAR' | 'RECEBER'): DreLancamento[] =>
    porSubgrupo(rows, subgrupoContabilId)
      .filter((row: any) => matrizIds.includes(Number(row.matriz_id)))
      .map((row: any) => ({
        id: String(row.id),
        origem,
        matrizId: Number(row.matriz_id),
        numeroDocumento: row.numero_documento ?? '—',
        fornecedorNome: row.fornecedor_nome ?? '—',
        produtoNome: row.produto_nome ?? '—',
        valor: aplicarSinalSubgrupo(Number(row.valor_total) || 0, subgrupoFuncao),
      }));

  const lancamentos = [...mapear(contasPagar, 'PAGAR'), ...mapear(contasReceber, 'RECEBER')];

  // Ordenação: pela ordem das colunas de matriz, depois nº documento (numérico
  // quando possível) e, por fim, produto — determinístico para o mesmo dado.
  return lancamentos.sort((a, b) => {
    const posA = matrizIds.indexOf(a.matrizId);
    const posB = matrizIds.indexOf(b.matrizId);
    if (posA !== posB) return posA - posB;
    const doc = a.numeroDocumento.localeCompare(b.numeroDocumento, 'pt-BR', { numeric: true });
    if (doc !== 0) return doc;
    return a.produtoNome.localeCompare(b.produtoNome, 'pt-BR');
  });
}

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

      valor = aplicarSinalSubgrupo(contasPagarValues + contasReceberValues, item.subgrupo_funcao);
    } else if (item.tipo === 'APORTE') {
      // Sum all aportes (positive) — sinal via regra central
      valor = aportes.reduce(
        (sum: number, aporte: any) => sum + aplicarSinalLinha(Number(aporte.valor) || 0, 'APORTE'),
        0,
      );
    } else if (item.tipo === 'RETIRADA') {
      // Sum all retiradas (negative) — sinal via regra central
      valor = retiradas.reduce(
        (sum: number, retirada: any) => sum + aplicarSinalLinha(Number(retirada.valor) || 0, 'RETIRADA'),
        0,
      );
    } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
      // Pagamentos de empréstimo entram no caixa (positive) — sinal via regra central
      valor = emprestimos
        .filter((e: any) => e.tipo === 'PAGAMENTO')
        .reduce((sum: number, e: any) => sum + aplicarSinalLinha(Number(e.valor) || 0, 'EMPRESTIMO_ENTRADA'), 0);
    } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
      // Empréstimos concedidos saem do caixa (negative) — sinal via regra central
      valor = emprestimos
        .filter((e: any) => e.tipo === 'EMPRESTIMO')
        .reduce((sum: number, e: any) => sum + aplicarSinalLinha(Number(e.valor) || 0, 'EMPRESTIMO_SAIDA'), 0);
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

            // Get subgroup function from structure
            subgroupValue = aplicarSinalSubgrupo(
              contasPagarValues + contasReceberValues,
              subitem.subgrupo_funcao,
            );
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
