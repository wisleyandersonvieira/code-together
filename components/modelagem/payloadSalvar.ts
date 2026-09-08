/**
 * Tradução entre o `ModelInput` da tela e o payload da `salvar_modelagem(jsonb)`.
 *
 * Duas funções puras, e elas são puras de propósito: o salvamento inteiro passa
 * a caber num teste que roda sem banco, sem rede e sem React. O que sobra no
 * editor é `await salvar(payload)` e o carimbo dos ids.
 *
 * ─── A regra que governa este arquivo ──────────────────────────────────────
 *
 * `undefined` some do JSON; `null` fica. `JSON.stringify({a: undefined})` é
 * `{}`, e `JSON.stringify({a: null})` é `{"a":null}`. Do outro lado, a função
 * distingue os dois com o operador `?` do jsonb — chave ausente significa "não
 * mexa", null explícito significa "grave NULL".
 *
 * Neste módulo NULL quase nunca é "vazio":
 *
 *   mesInicioOpex  null = derivado do cronograma
 *   pctCapital     null = usa a participação (≠ zero, "não põe capital")
 *   mesAncora      null = sem âncora
 *   faseIndex      null = lote sem fase
 *   mesSaida       null = saída no fim do horizonte
 *
 * Por isso `nulo()` abaixo devolve `null` e nunca `undefined`: um `undefined`
 * que escapasse daqui viraria chave ausente, e a coluna manteria o valor
 * anterior em vez de voltar a derivar. É um erro que não dá erro.
 */
import type { ModelInput } from '@/lib/modelagem';

/** O que a `salvar_modelagem` devolve: ids alinhados por índice do array enviado. */
export interface RetornoSalvar {
  id: number;
  unidades?: (number | null)[];
  custos?: (number | null)[];
  custo_parcelas?: Record<string, (number | null)[]>;
  socios?: (number | null)[];
  socio_aportes?: Record<string, (number | null)[]>;
  fases?: (number | null)[];
  facilidades?: (number | null)[];
  aporte_parcelas?: (number | null)[];
  opex?: (number | null)[];
  takedowns?: (number | null)[];
}

/**
 * Número que pode ser nulo, para o jsonb. Nunca devolve `undefined` — ver o
 * cabeçalho: `undefined` sumiria do JSON e a coluna ficaria como estava.
 */
const nulo = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : v;

/** Id que só viaja quando existe de verdade. `null` = linha nova. */
const idOu = (v: number | undefined): number | null => (v == null ? null : Number(v));

/**
 * `pct_capital` viaja como STRING vazia quando é nulo, e não como null.
 *
 * Não é capricho: a coluna é gravada com `NULLIF(NULLIF(x,''),'null')::decimal`,
 * exatamente como em `updateModelagemSocio` — e o caminho antigo já mandava `''`
 * pelo mesmo motivo. Mudar para null aqui daria o mesmo resultado no banco, mas
 * afastaria as duas pontas de uma equivalência que o teste diferencial cobra.
 */
const pctCapital = (v: number | null | undefined): string => (v == null ? '' : String(v));

/**
 * Monta o payload da `salvar_modelagem` a partir do rascunho da tela.
 *
 * A ORDEM dos arrays é significativa: o retorno vem alinhado por índice, e as
 * alocações, os takedowns e as vendas endereçam unidades e fases por índice
 * nesse mesmo array. Reordenar aqui sem reordenar lá desloca tudo em silêncio.
 */
export function montarPayload(modelagemId: number, m: ModelInput): Record<string, unknown> {
  const ehLocacao = (m.tipoModelagem ?? 'venda') === 'locacao';

  return {
    id: modelagemId,

    premissas: {
      nome: m.nome ?? '',
      localizacao: m.localizacao ?? '',
      tipo_uso: m.tipoUso ?? '',
      moeda: m.moeda ?? 'USD',
      data_inicio: m.dataInicio,
      meses_aprovacao: m.mesesAprovacao,
      meses_construcao: m.mesesConstrucao,
      meses_pos_obra: m.mesesPosObra,
      horizonte_maximo: m.horizonteMaximo ?? 60,
      usa_fases: !!m.usaFases,
      terreno_por_fase: !!m.terrenoPorFase,
      // Os três que o `salvar()` já mandava fixos. `status` nulo faz a função
      // manter o que está gravado (COALESCE contra a coluna), como a action.
      data_base: null,
      revisao: '',
      status: null,
      // Não é gravado — a função o lê para decidir se entra nos blocos de
      // locação. O tipo é imutável depois de criada a modelagem.
      tipo_modelagem: ehLocacao ? 'locacao' : 'venda',
    },

    unidades: m.unidades.map((u, i) => ({
      id: idOu(u.id),
      ordem: i,
      nome: u.nome,
      cidade: u.cidade ?? '',
      quantidade: u.quantidade,
      area_sf: u.areaSf ?? 0,
      custo_terreno: u.custoTerreno,
      custo_obra: u.custoObra,
      preco_venda: u.precoVenda,
      property_tax_ano: u.propertyTaxAno,
      aluguel_sf_ano: u.aluguelSfAno ?? 0,
      observacoes: '',
    })),

    custos: (m.custosAdicionais ?? []).map((c, i) => ({
      id: idOu(c.id),
      ordem: i,
      label: c.label,
      valor: c.valor,
      distribuicao: c.distribuicao,
      mes_ancora: nulo(c.mesAncora),
      categoria: c.categoria,
      // ID, não índice: a tela só oferece como pai um custo que já tem id.
      grupo_pai_id: nulo(c.grupoPaiId),
      base_calculo: c.baseCalculo,
      valor_unitario: c.valorUnitario,
      grupo_referencia: c.grupoReferencia ?? '',
      percentual: c.percentual,
      gatilho: c.gatilho,
      // Aninhada no pai: o vínculo é a estrutura do JSON, e a função não precisa
      // de índice para reencontrar a parcela.
      parcelas: (c.parcelas ?? []).map((p, k) => ({
        id: idOu(p.id),
        ordem: k,
        mes: p.mes,
        valor: p.valor,
      })),
    })),

    socios: (m.socios ?? []).map((s, i) => ({
      id: idOu(s.id),
      ordem: i,
      nome: s.nome,
      participacao_pct: s.participacaoPct,
      cota_disponivel: s.cotaDisponivel,
      pct_capital: pctCapital(s.pctCapital),
      observacoes: '',
      aportes: (s.aportes ?? []).map((a, k) => ({
        id: idOu(a.id),
        ordem: k,
        mes: a.mes,
        valor: a.valor,
        observacao: a.observacao ?? '',
      })),
    })),

    // Ausente quando não há plano: a função só entra no bloco se a chave existir,
    // e um objeto vazio criaria cabeçalho de plano onde não há plano.
    ...(m.aportes
      ? {
          aportes: {
            modo_aporte: m.aportes.modoAporte,
            aporte_base_total: m.aportes.aporteBaseTotal,
            valor_total_alvo: m.aportes.valorTotalAlvo,
            regra_rateio_capital: m.aportes.regraRateioCapital,
            parcelas: (m.aportes.parcelas ?? []).map((p) => ({
              id: idOu(p.id),
              mes: p.mes,
              valor: p.valor,
              observacao: p.observacao ?? '',
            })),
          },
        }
      : {}),

    fases: (m.fases ?? []).map((f, i) => ({
      id: idOu(f.id),
      ordem: i,
      nome: f.nome,
      data_inicio: f.dataInicio,
      data_fim: f.dataFim,
    })),

    // Quantidade zero é ausência — a função apaga o par. Mandar tudo e deixar a
    // decisão lá é o que mantém o filtro numa fonte só.
    alocacoes: (m.alocacoes ?? []).map((a) => ({
      unidade_index: a.unidadeIndex,
      fase_index: a.faseIndex,
      quantidade: a.quantidade,
    })),

    facilidades: (m.financiamentos ?? []).map((f, i) => ({
      id: idOu(f.id),
      ordem: i,
      nome: f.nome ?? 'Financiamento',
      ativo: f.ativo ?? true,
      // ÍNDICE, e não id: a facilidade apontada pode ser uma que ainda não
      // existe quando o payload é montado. É o único campo do payload assim,
      // fora dos índices de unidade e fase.
      refinancia_index: nulo(f.refinanciaIndex),
      taxa_anual: f.taxaAnual,
      fee_estruturacao_pct: f.feeEstruturacaoPct,
      fee_timing: f.feeTiming,
      fee_mes: nulo(f.feeMes),
      mes_inicio_saque: f.mesInicioSaque,
      mes_fim_saque: f.mesFimSaque,
      modo_saque: f.modoSaque,
      max_ltc_pct: nulo(f.maxLtcPct),
      valor_contratado: nulo(f.valorContratado),
      custo_financeiro_na_demanda: f.custoFinanceiroNaDemanda,
      modo_amortizacao: f.modoAmortizacao,
      capitalizar_juros: f.capitalizarJuros,
      colchao_minimo_caixa: f.colchaoMinimoCaixa,
      linha_rotativa: f.linhaRotativa,
      reserva_juros: f.reservaJuros,
      reserva_juros_sacada: f.reservaJurosSacada,
      prazo_meses: nulo(f.prazoMeses),
      carencia_meses: f.carenciaMeses,
      amortizacao_meses: nulo(f.amortizacaoMeses),
      balloon_no_vencimento: f.balloonNoVencimento,
      release_price: f.releasePrice,
      release_price_pct: nulo(f.releasePricePct),
      convencao_juros: f.convencaoJuros,
      tipo_taxa: f.tipoTaxa,
      spread: f.spread,
      benchmark_nome: f.benchmarkNome ?? '',
      benchmark_padrao: f.benchmarkPadrao,
      benchmark_curva: (f.benchmarkCurva ?? []).map((p) => ({ mes: p.mes, valor: p.valor })),
    })),

    receita: {
      comissao_pct: m.receita.comissaoPct,
      custo_cartorio_pct: m.receita.custoCartorioPct,
      modo_venda: m.receita.modoVenda,
      mes_saida: nulo(m.receita.mesSaida),
      lucro_investidores_pct: m.receita.lucroInvestidoresPct,
      lucro_sponsor_pct: m.receita.lucroSponsorPct,
    },

    takedowns: (m.receita.takedowns ?? []).map((t, i) => ({
      id: idOu(t.id),
      unidade_index: t.unidadeIndex,
      fase_index: nulo(t.faseIndex),
      ordem: i,
      mes: t.mes,
      quantidade: t.quantidade,
      preco_unitario: t.precoUnitario,
      observacao: t.observacao ?? '',
    })),

    vendas_unidade: (m.receita.vendasPorUnidade ?? []).map((v) => ({
      unidade_index: v.unidadeIndex,
      mes_venda: v.mesVenda,
    })),

    // Os três blocos de locação só viajam no modo locação. Numa venda eles não
    // têm o que gravar, e mandá-los criaria uma linha de cabeçalho inofensiva
    // mas mentirosa — a tabela passaria a dizer que existe uma operação.
    ...(ehLocacao && m.locacao
      ? {
          locacao: {
            taxa_reembolso_pct: m.locacao.taxaReembolsoPct,
            perda_credito_pct: m.locacao.perdaCreditoPct,
            cap_rate_saida: m.locacao.capRateSaida,
            custo_venda_pct: m.locacao.custoVendaPct,
            noi_referencia: m.locacao.noiReferencia,
            ocupacao_estabilizada_pct: m.locacao.ocupacaoEstabilizadaPct,
            // A chave SEMPRE viaja, mesmo nula. Omiti-la faria a função manter
            // o mês gravado, e o usuário que voltou para "derivado" veria o
            // valor antigo reaparecer no recarregar.
            mes_inicio_opex: nulo(m.locacao.mesInicioOpex),
          },
          opex: (m.opex ?? []).map((o, i) => ({
            id: idOu(o.id),
            ordem: i,
            label: o.label,
            valor_sf_ano: o.valorSfAno,
            reembolsavel: o.reembolsavel,
          })),
          ocupacao: (m.ocupacao ?? []).map((p) => ({
            mes: p.mes,
            ocupacao_pct: p.ocupacaoPct,
          })),
        }
      : {}),
  };
}

/**
 * Carimba no rascunho os ids que a função devolveu.
 *
 * Substitui os ~50 `const id = Array.isArray(criado) ? criado[0]?.id : undefined`
 * espalhados pelo `salvar()` de hoje. Devolve um objeto NOVO — o rascunho é
 * estado do React e não pode ser mutado no lugar.
 *
 * Os filhos aninhados vêm chaveados por ID DO PAI, e não por índice: o pai pode
 * ser novo, e aí o índice não identifica nada que o cliente já conheça.
 *
 * Id que voltou nulo (o UPDATE não casou, linha de outra modelagem) é deixado
 * como estava, e não sobrescrito com `undefined`: perder o id de uma linha que
 * existe faria o salvamento seguinte inseri-la duas vezes.
 */
export function carimbarIds(m: ModelInput, r: RetornoSalvar): ModelInput {
  const pegar = (lista: (number | null)[] | undefined, i: number, atual?: number) => {
    const v = lista?.[i];
    return v == null ? atual : Number(v);
  };

  return {
    ...m,
    unidades: m.unidades.map((u, i) => ({ ...u, id: pegar(r.unidades, i, u.id) })),
    custosAdicionais: (m.custosAdicionais ?? []).map((c, i) => {
      const id = pegar(r.custos, i, c.id);
      const filhos = id == null ? undefined : r.custo_parcelas?.[String(id)];
      return {
        ...c,
        id,
        parcelas: (c.parcelas ?? []).map((p, k) => ({ ...p, id: pegar(filhos, k, p.id) })),
      };
    }),
    socios: (m.socios ?? []).map((s, i) => {
      const id = pegar(r.socios, i, s.id);
      const filhos = id == null ? undefined : r.socio_aportes?.[String(id)];
      return {
        ...s,
        id,
        aportes: (s.aportes ?? []).map((a, k) => ({ ...a, id: pegar(filhos, k, a.id) })),
      };
    }),
    aportes: m.aportes
      ? {
          ...m.aportes,
          parcelas: (m.aportes.parcelas ?? []).map((p, i) => ({
            ...p,
            id: pegar(r.aporte_parcelas, i, p.id),
          })),
        }
      : m.aportes,
    fases: (m.fases ?? []).map((f, i) => ({ ...f, id: pegar(r.fases, i, f.id) })),
    financiamentos: (m.financiamentos ?? []).map((f, i) => ({
      ...f,
      id: pegar(r.facilidades, i, f.id),
    })),
    opex: (m.opex ?? []).map((o, i) => ({ ...o, id: pegar(r.opex, i, o.id) })),
    receita: {
      ...m.receita,
      takedowns: (m.receita.takedowns ?? []).map((t, i) => ({
        ...t,
        id: pegar(r.takedowns, i, t.id),
      })),
    },
  };
}
