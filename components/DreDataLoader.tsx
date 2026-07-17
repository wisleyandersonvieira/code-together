'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { usePdfExport, type DreColuna } from '@/hooks/use-pdf-export';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import loadEstruturaDreItensAction from '@/actions/loadEstruturaDreItens';
import loadDreContasPagarAction from '@/actions/loadDreContasPagar';
import loadDreContasReceberAction from '@/actions/loadDreContasReceber';
import loadAportesAction from '@/actions/loadAportes';
import loadRetiradasAction from '@/actions/loadRetiradas';
import loadDreEmprestimosAction from '@/actions/loadDreEmprestimos';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import { calcularItensParaMatriz, lancamentosDoSubgrupo, lancamentosDaLinha, porMatriz } from '@/lib/dre-calculo';
import { formatDateForDisplay } from '@/utils/timezone';

/** Linhas de sócio que ganham drill-down (mesma mecânica do subgrupo). */
const TIPOS_LINHA_SOCIO = new Set(['APORTE', 'RETIRADA', 'EMPRESTIMO_ENTRADA', 'EMPRESTIMO_SAIDA']);

interface DreDataLoaderProps {
  estruturaId: number;
  matrizIds: number[];
  /** Só é aplicado quando tipoData === 'pagamento'. Vazio = todas as contas. */
  contaIds?: number[];
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  /**
   * Status de projeto para rateio das contas (ex.: ['Em andamento']). Opcional
   * e default-off: vazio/ausente → nenhum filtro enviado às actions, DRE
   * idêntico ao atual. Não se aplica a aportes/retiradas/empréstimos.
   */
  statusProjeto?: string[];
  onComplete: () => void;
  refreshTrigger?: number;
}

export interface DreItemResult {
  id: number;
  tipo: string;
  nome: string;
  ordem: number;
  nivel: number;
  grupo_contabil_id?: number;
  subgrupo_contabil_id?: number;
  subgrupo_funcao?: string;
  parent_id?: number;
  /** Valor por matriz — chave é o id da matriz. */
  valores: Record<number, number>;
  /** Soma dos valores de todas as matrizes selecionadas (coluna TOTAL). */
  valor: number;
}

export function DreDataLoader({
  estruturaId,
  matrizIds,
  contaIds,
  tipoData,
  dataInicio,
  dataFim,
  statusProjeto,
  onComplete,
  refreshTrigger,
}: DreDataLoaderProps) {
  const { formatCurrency } = useCurrency();
  const { exportDreToPdf } = usePdfExport();
  const { toast } = useToast();
  const [dreData, setDreData] = useState<DreItemResult[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  // Drill-down: chave é o id do ITEM da estrutura (não o subgrupo_contabil_id),
  // pois o mesmo subgrupo contábil pode aparecer em mais de uma linha.
  const [expandedSubgrupos, setExpandedSubgrupos] = useState<Set<number>>(new Set());

  const toggleSubgrupo = (itemId: number) => {
    setExpandedSubgrupos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(itemId)) proximo.delete(itemId);
      else proximo.add(itemId);
      return proximo;
    });
  };

  // O filtro de conta só existe na emissão por data de pagamento.
  const contaIdsAplicados = useMemo(
    () => (tipoData === 'pagamento' ? contaIds ?? [] : []),
    [tipoData, contaIds],
  );

  // Filtro de status do projeto (aditivo, default-off). Vazio → não é enviado às
  // actions, mantendo a query IDÊNTICA ao DRE atual.
  const statusProjetoAplicado = useMemo(() => statusProjeto ?? [], [statusProjeto]);

  // Parâmetros comuns a todas as fontes financeiras. Uma única ida ao banco por
  // fonte, trazendo as N matrizes de uma vez (matriz_id volta em cada registro).
  const filtroBase = useMemo(
    () => ({ matrizIds, contaIds: contaIdsAplicados, tipoData, dataInicio, dataFim }),
    [matrizIds, contaIdsAplicados, tipoData, dataInicio, dataFim],
  );

  // Só as contas (pagar/receber) recebem o status; e só quando há algum
  // selecionado — sem status, o objeto de params fica byte-idêntico ao atual.
  // Aportes/retiradas/empréstimos nunca recebem status (não têm projeto).
  const filtroContas = useMemo(
    () =>
      statusProjetoAplicado.length
        ? { ...filtroBase, estruturaId, statusProjeto: statusProjetoAplicado }
        : { ...filtroBase, estruturaId },
    [filtroBase, estruturaId, statusProjetoAplicado],
  );

  // Load structure items — a estrutura é a mesma para todas as matrizes
  const [estruturaItens, loadingItens, , refreshEstrutura] = useLoadAction(
    loadEstruturaDreItensAction,
    [],
    { estruturaId }
  );

  // Load financial data
  const [contasPagar, loadingContasPagar] = useLoadAction(
    loadDreContasPagarAction,
    [],
    filtroContas
  );

  const [contasReceber, loadingContasReceber] = useLoadAction(
    loadDreContasReceberAction,
    [],
    filtroContas
  );

  const [aportes, loadingAportes] = useLoadAction(
    loadAportesAction,
    [],
    filtroBase
  );

  const [retiradas, loadingRetiradas] = useLoadAction(
    loadRetiradasAction,
    [],
    filtroBase
  );

  const [emprestimos, loadingEmprestimos] = useLoadAction(
    loadDreEmprestimosAction,
    [],
    filtroBase
  );

  // Load additional data for PDF export
  const [estruturas] = useLoadAction(
    loadEstruturasDreAction,
    []
  );

  const [matrizes] = useLoadAction(
    loadMatrizesAction,
    [],
    { searchNome: null }
  );

  const [contas] = useLoadAction(loadContasAction, []);

  const isLoading = loadingItens || loadingContasPagar || loadingContasReceber || loadingAportes || loadingRetiradas || loadingEmprestimos;

  // Matrizes selecionadas na ordem do catálogo (alfabética), para as colunas
  // ficarem estáveis independentemente da ordem de clique no filtro.
  const matrizesSelecionadas = useMemo(() => {
    const encontradas = (matrizes || []).filter((m: any) => matrizIds.includes(Number(m.id)));
    // Enquanto o catálogo não carregou, ainda assim renderiza as colunas.
    if (encontradas.length !== matrizIds.length) {
      return matrizIds.map((id) => {
        const m = (matrizes || []).find((mat: any) => Number(mat.id) === id);
        return { id, nome: m?.nome ?? `Matriz ${id}` };
      });
    }
    return encontradas.map((m: any) => ({ id: Number(m.id), nome: m.nome as string }));
  }, [matrizes, matrizIds]);

  const mostrarTotal = matrizesSelecionadas.length > 1;

  const colunas: DreColuna[] = useMemo(() => {
    const cols: DreColuna[] = matrizesSelecionadas.map((m) => ({ key: m.id, label: m.nome }));
    if (mostrarTotal) cols.push({ key: 'TOTAL', label: 'TOTAL' });
    return cols;
  }, [matrizesSelecionadas, mostrarTotal]);

  // Reset calculation when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      setHasCalculated(false);
      refreshEstrutura();
    }
  }, [refreshTrigger, refreshEstrutura]);

  useEffect(() => {
    if (!isLoading && estruturaItens && contasPagar && contasReceber && aportes && retiradas && emprestimos && !hasCalculated) {

      // Roda a mesma fórmula, uma vez por matriz, sobre os registros da matriz.
      const valoresPorMatriz = new Map<number, Map<number, number>>();
      matrizIds.forEach((matrizId) => {
        const itens = calcularItensParaMatriz(
          estruturaItens,
          porMatriz(contasPagar, matrizId),
          porMatriz(contasReceber, matrizId),
          porMatriz(aportes, matrizId),
          porMatriz(retiradas, matrizId),
          porMatriz(emprestimos, matrizId),
        );
        valoresPorMatriz.set(matrizId, new Map(itens.map((i) => [i.id, i.valor])));
      });

      const finalItems: DreItemResult[] = estruturaItens.map((item: any) => {
        const valores: Record<number, number> = {};
        matrizIds.forEach((matrizId) => {
          valores[matrizId] = valoresPorMatriz.get(matrizId)?.get(item.id) ?? 0;
        });
        // Coluna TOTAL: soma horizontal das matrizes selecionadas.
        const valor = matrizIds.reduce((sum, matrizId) => sum + valores[matrizId], 0);

        return {
          id: item.id,
          tipo: item.tipo,
          nome: item.nome,
          ordem: item.ordem,
          nivel: item.nivel,
          grupo_contabil_id: item.grupo_contabil_id,
          subgrupo_contabil_id: item.subgrupo_contabil_id,
          subgrupo_funcao: item.subgrupo_funcao,
          parent_id: item.parent_id,
          valores,
          valor,
        };
      });

      setDreData(finalItems.sort((a, b) => a.ordem - b.ordem));
      // Novo relatório começa com todos os subgrupos recolhidos.
      setExpandedSubgrupos(new Set());
      setHasCalculated(true);
      onComplete();
    }
  }, [isLoading, estruturaItens, contasPagar, contasReceber, aportes, retiradas, emprestimos, hasCalculated, onComplete, matrizIds]);

  const getItemTypeBadge = (tipo: string) => {
    const variants = {
      GRUPO: 'default',
      SUBGRUPO: 'secondary',
      SOMA: 'outline',
      APORTE: 'default',
      RETIRADA: 'destructive',
      EMPRESTIMO_ENTRADA: 'default',
      EMPRESTIMO_SAIDA: 'destructive',
    } as const;

    return (
      <Badge variant={variants[tipo as keyof typeof variants] || 'default'}>
        {tipo}
      </Badge>
    );
  };

  const getRowStyle = (item: DreItemResult) => {
    if (item.tipo === 'GRUPO' || item.tipo === 'SOMA') {
      return 'font-bold';
    }
    return '';
  };

  /** Mesma coloração de antes, agora avaliada célula a célula. */
  const getValueStyle = (item: DreItemResult, valor: number) => {
    const baseStyle = `text-right ${getRowStyle(item)}`;

    // Para RETIRADAS e EMPRÉSTIMOS SAÍDA sempre vermelho (valores já negativos)
    if (item.tipo === 'RETIRADA' || item.tipo === 'EMPRESTIMO_SAIDA') {
      return `${baseStyle} text-red-600`;
    }

    // Para SUBGRUPOS com função DÉBITO, exibir em vermelho (valores já negativos)
    if (item.tipo === 'SUBGRUPO' && (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO')) {
      return `${baseStyle} text-red-600`;
    }

    // Para GRUPOS que contêm apenas DÉBITOS, também exibir em vermelho
    if (item.tipo === 'GRUPO' && valor < 0) {
      return `${baseStyle} text-red-600`;
    }

    // Para valores negativos em geral (inclui SOMA que pode ser negativa)
    if (valor < 0) {
      return `${baseStyle} text-red-600`;
    }

    // Para valores positivos
    return `${baseStyle} text-green-600`;
  };

  const valorDaColuna = (item: DreItemResult, coluna: DreColuna) =>
    coluna.key === 'TOTAL' ? item.valor : item.valores[coluna.key] ?? 0;

  const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
  const matrizesNomes = matrizesSelecionadas.map((m) => m.nome);
  const contasNomes = (contas || [])
    .filter((c: any) => contaIdsAplicados.includes(Number(c.id)))
    .map((c: any) => c.nome as string);
  // Status já vêm legíveis ('Em andamento' / 'Concluído'); só aparecem quando o
  // filtro está ativo (tela "DRE por Status"). No DRE atual fica sempre vazio.
  const statusProjetoNomes = statusProjetoAplicado;
  /** Sufixo de nome de arquivo: nome da matriz quando só há uma. */
  const sufixoArquivo = matrizesNomes.length === 1 ? matrizesNomes[0] : `${matrizesNomes.length}_matrizes`;

  const handleExportPdf = () => {
    if (!dreData || dreData.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    const success = exportDreToPdf(
      dreData,
      'Demonstrativo de Resultado do Exercício',
      {
        dataInicio,
        dataFim,
        tipoData,
        estruturaNome,
        matrizesNomes,
        contasNomes: contasNomes.length ? contasNomes : undefined,
        statusProjeto: statusProjetoNomes.length ? statusProjetoNomes.join(', ') : undefined,
      },
      {
        aportes,
        retiradas,
        emprestimos,
      },
      colunas,
    );

    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Relatório DRE exportado com sucesso!',
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = () => {
    if (!dreData || dreData.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Uma coluna de valor por matriz (+ TOTAL quando houver 2 ou mais)
      const excelData = dreData.map((item) => {
        const linha: Record<string, any> = {
          Ordem: item.ordem,
          Tipo: item.tipo,
          Nome: item.nome,
        };
        colunas.forEach((col) => {
          linha[col.label] = valorDaColuna(item, col);
        });
        return linha;
      });

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);

      const cabecalho = ['Ordem', 'Tipo', 'Nome', ...colunas.map((c) => c.label)];
      const linhasInfo: any[][] = [
        ['Demonstrativo de Resultado do Exercício'],
        [''],
        ['Estrutura:', estruturaNome],
        [matrizesNomes.length > 1 ? 'Matrizes:' : 'Matriz:', matrizesNomes.join(', ')],
        ['Período:', `${dataInicio} a ${dataFim}`],
        ['Critério:', tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'],
      ];
      if (contasNomes.length) {
        linhasInfo.push(['Contas:', contasNomes.join(', ')]);
      }
      if (statusProjetoNomes.length) {
        linhasInfo.push(['Status do Projeto:', statusProjetoNomes.join(', ')]);
      }
      linhasInfo.push([''], cabecalho);

      // Adicionar cabeçalho com informações do relatório
      XLSX.utils.sheet_add_aoa(ws, linhasInfo);

      // Os dados começam logo após as linhas de informação + cabeçalho
      const primeiraLinhaDados = linhasInfo.length; // índice 0-based da 1ª linha de dados
      XLSX.utils.sheet_add_json(ws, excelData, {
        origin: `A${primeiraLinhaDados + 1}`,
        skipHeader: true,
        header: cabecalho,
      });

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 10 },  // Ordem
        { wch: 15 },  // Tipo
        { wch: 50 },  // Nome
        ...colunas.map(() => ({ wch: 20 })), // uma por matriz (+ TOTAL)
      ];

      // Aplicar formatação de moeda nas colunas de valor
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = primeiraLinhaDados; R <= range.e.r; ++R) {
        for (let C = 3; C < 3 + colunas.length; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          ws[cellAddress].z = '#,##0.00';
        }
      }

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'DRE');

      // Gerar arquivo
      const fileName = `DRE_${sufixoArquivo}_${dataInicio}_${dataFim}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: 'Relatório DRE exportado para Excel com sucesso!',
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

  // Guarda: sem matriz não há filtro de matriz no SQL, o que traria todas as
  // matrizes. O botão "Gerar DRE" já valida isso; aqui é defesa em profundidade.
  if (matrizIds.length === 0) {
    return <div className="text-center py-4">Selecione ao menos uma matriz.</div>;
  }

  if (isLoading) {
    return <div className="text-center py-4">Carregando dados do DRE...</div>;
  }

  // Mantém o comportamento atual (ocultar linhas zeradas); no multi-matriz a
  // linha aparece se qualquer coluna tiver valor.
  const linhasVisiveis = dreData.filter(
    (item) => item.valor !== 0 || Object.values(item.valores).some((v) => v !== 0),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Período: {dataInicio} a {dataFim} |
          Critério: {tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}
          {contasNomes.length > 0 && <> | Contas: {contasNomes.join(', ')}</>}
          {statusProjetoNomes.length > 0 && <> | Status do Projeto: {statusProjetoNomes.join(', ')}</>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              {colunas.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={`text-right ${col.key === 'TOTAL' ? 'font-bold text-slate-900' : ''}`}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasVisiveis.map((item) => {
              const ehSubgrupo = item.tipo === 'SUBGRUPO' && !!item.subgrupo_contabil_id;
              const ehLinhaSocio = TIPOS_LINHA_SOCIO.has(item.tipo);
              const podeExpandir = ehSubgrupo || ehLinhaSocio;
              const expandido = expandedSubgrupos.has(item.id);
              // Só monta o detalhe do que está aberto.
              const lancamentos =
                ehSubgrupo && expandido
                  ? lancamentosDoSubgrupo(
                      contasPagar,
                      contasReceber,
                      Number(item.subgrupo_contabil_id),
                      item.subgrupo_funcao,
                      matrizIds,
                    )
                  : [];
              const lancamentosLinha =
                ehLinhaSocio && expandido
                  ? lancamentosDaLinha(item.tipo, aportes, retiradas, emprestimos, matrizIds)
                  : [];
              const semDetalhe = expandido && lancamentos.length === 0 && lancamentosLinha.length === 0;

              return (
                <React.Fragment key={item.id}>
                  <TableRow className={getRowStyle(item)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.ordem}
                        {getItemTypeBadge(item.tipo)}
                      </div>
                    </TableCell>
                    <TableCell className={getRowStyle(item)}>
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${(item.nivel - 1) * 20}px` }}
                      >
                        {podeExpandir ? (
                          <button
                            type="button"
                            onClick={() => toggleSubgrupo(item.id)}
                            aria-expanded={expandido}
                            aria-label={`${expandido ? 'Recolher' : 'Detalhar'} lançamentos de ${item.nome}`}
                            className="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {expandido ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                        {item.nome}
                      </div>
                    </TableCell>
                    {colunas.map((col) => {
                      const valor = valorDaColuna(item, col);
                      return (
                        <TableCell
                          key={String(col.key)}
                          className={`${getValueStyle(item, valor)} ${col.key === 'TOTAL' ? 'font-bold' : ''}`}
                        >
                          {formatCurrency(valor)}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* Sublinhas de detalhe: mesma grade de colunas da tabela, com o
                      valor na célula da matriz a que o lançamento pertence. */}
                  {semDetalhe && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={2 + colunas.length} className="py-2 text-xs text-muted-foreground">
                        <div style={{ paddingLeft: `${item.nivel * 20 + 12}px` }}>
                          Sem lançamentos para detalhar
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {expandido &&
                    lancamentos.map((lancamento) => (
                      <TableRow key={`${item.id}-${lancamento.origem}-${lancamento.id}`} className="bg-muted/20 hover:bg-muted/30">
                        {/* Número · Fornecedor · Produto ocupam a área de Ordem+Nome */}
                        <TableCell colSpan={2} className="py-1.5 text-xs font-normal text-muted-foreground">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${item.nivel * 20 + 12}px` }}>
                            <span className="font-medium text-foreground">{lancamento.numeroDocumento}</span>
                            <span aria-hidden>·</span>
                            <span className="truncate">{lancamento.fornecedorNome}</span>
                            <span aria-hidden>·</span>
                            <span className="truncate">{lancamento.produtoNome}</span>
                          </div>
                        </TableCell>
                        {colunas.map((col) => {
                          // Um lançamento pertence a uma única matriz: só a coluna
                          // dela (e a TOTAL) recebem valor; as demais ficam vazias.
                          const pertence = col.key === 'TOTAL' || col.key === lancamento.matrizId;
                          if (!pertence) return <TableCell key={String(col.key)} />;
                          return (
                            <TableCell
                              key={String(col.key)}
                              className={`py-1.5 text-right text-xs ${
                                lancamento.valor < 0 ? 'text-red-600' : 'text-green-600'
                              } ${col.key === 'TOTAL' ? 'font-medium' : ''}`}
                            >
                              {formatCurrency(lancamento.valor)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}

                  {/* Sublinhas de detalhe das linhas de sócio: Data · Nome do Sócio
                      na área de Ordem+Nome; valor na coluna da matriz do lançamento. */}
                  {expandido &&
                    lancamentosLinha.map((lancamento) => (
                      <TableRow key={`${item.id}-${lancamento.matrizId}-${lancamento.id}`} className="bg-muted/20 hover:bg-muted/30">
                        {/* Data · Nome do Sócio ocupam a área de Ordem+Nome */}
                        <TableCell colSpan={2} className="py-1.5 text-xs font-normal text-muted-foreground">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${item.nivel * 20 + 12}px` }}>
                            <span className="font-medium text-foreground">{formatDateForDisplay(lancamento.data)}</span>
                            <span aria-hidden>·</span>
                            <span className="truncate">{lancamento.socioNome}</span>
                          </div>
                        </TableCell>
                        {colunas.map((col) => {
                          // Um lançamento pertence a uma única matriz: só a coluna
                          // dela (e a TOTAL) recebem valor; as demais ficam vazias.
                          const pertence = col.key === 'TOTAL' || col.key === lancamento.matrizId;
                          if (!pertence) return <TableCell key={String(col.key)} />;
                          return (
                            <TableCell
                              key={String(col.key)}
                              className={`py-1.5 text-right text-xs ${
                                lancamento.valor < 0 ? 'text-red-600' : 'text-green-600'
                              } ${col.key === 'TOTAL' ? 'font-medium' : ''}`}
                            >
                              {formatCurrency(lancamento.valor)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
