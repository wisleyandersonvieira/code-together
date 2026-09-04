'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { Button } from '@/components/ui/button';
import type {
  ConvencaoJuros,
  Financiamento,
  ModelInput,
  ModelOutput,
  ModoSaque,
  PontoBenchmark,
} from '@/lib/modelagem';
import {
  CONVENCOES_JUROS,
  MODOS_AMORTIZACAO,
  EXPLICACAO_MODO_SAQUE,
  MODOS_SAQUE,
  ROTULO_CONVENCAO_JUROS,
  ROTULO_MODO_AMORTIZACAO,
  ROTULO_MODO_SAQUE,
} from '@/lib/modelagem';
import { dinheiro, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

interface PropsFacilidade {
  rascunho: ModelInput;
  resultado: ModelOutput;
  /** A facilidade que este formulário edita. */
  fin: Financiamento;
  /** Aplica um patch NESTA facilidade. Quem sabe o índice é o acordeão. */
  mudar: (patch: Partial<Financiamento>) => void;
  /** Índice 0-based, para o campo "Refinancia" não se oferecer a si mesmo. */
  indice: number;
  /** Todas as facilidades, para o seletor de refinanciamento. */
  facilidades: Financiamento[];
}

/**
 * O formulário de UMA facilidade.
 *
 * É exatamente o conteúdo que a aba inteira tinha antes da migration 1764200000,
 * sem uma linha de lógica alterada — só deixou de ler `rascunho.financiamento`
 * direto e passou a receber a facilidade por prop. Com uma facilidade só, que é
 * o estado de toda modelagem já gravada, a tela é a mesma de antes.
 */
function FormularioFacilidade({ rascunho, resultado, fin, mudar, indice, facilidades }: PropsFacilidade) {
  const numeroOuNulo = (v: string) => (v === '' ? null : Number(v));

  /**
   * Trocar de modo de saque pode ligar a flag junto — e só neste sentido.
   *
   * 'equity_first_demanda' dimensiona o saque pela demanda do mês; com o custo
   * financeiro FORA dessa demanda, os juros continuam saindo do caixa sem terem
   * sido cobertos, e o caixa fecha abaixo do colchão em toda a janela de saque —
   * que é exatamente o que o modo existe para resolver. Ligar a flag é o default
   * útil, e o aviso abaixo do seletor diz que ela foi ligada.
   *
   * Nenhum outro modo mexe na flag: sair do modo novo NÃO a desliga, porque a
   * essa altura ela pode ter sido escolhida de propósito.
   */
  const trocarModoSaque = (modo: ModoSaque) =>
    mudar(
      modo === 'equity_first_demanda' && !fin.custoFinanceiroNaDemanda
        ? { modoSaque: modo, custoFinanceiroNaDemanda: true }
        : { modoSaque: modo },
    );

  /**
   * Menor capacidade de saque observada nos meses do projeto — o pior momento da
   * linha. Sem teto declarado a capacidade é infinita em todo mês, e aí a leitura
   * é "sem teto" em vez de um número que não existe.
   */
  const capacidadeMinima = (() => {
    const meses = resultado.meses;
    if (meses.length === 0) return '—';
    const minimo = Math.min(...meses.map((m) => m.capacidadeSaque));
    return Number.isFinite(minimo) ? dinheiro(minimo, rascunho.moeda) : 'sem teto';
  })();

  /**
   * Sem valor contratado e sem LTC máximo não há compromisso declarado, e o
   * motor cai no PICO do saldo devedor como base do fee. Mesmo critério da
   * conferência `fee_sem_base_contratada` — se as duas divergissem, a tela diria
   * uma coisa e o painel outra.
   */
  const semBaseContratada = fin.valorContratado == null && fin.maxLtcPct == null;
  const rotuloBaseFee = semBaseContratada
    ? 'o pico do saldo devedor'
    : fin.valorContratado != null
      ? 'o valor contratado'
      : 'o LTC máximo';

  const curva = fin.benchmarkCurva ?? [];
  const prazoTotal = resultado.cronograma.prazoTotal;

  /** Ponto da curva por mês; ausente ≠ zero — sem ponto, vale o padrão. */
  const valorDoMes = (mes: number) => curva.find((p) => p.mes === mes)?.valor;

  const definirPontoCurva = (mes: number, valor: number | null) => {
    const outros = curva.filter((p) => p.mes !== mes);
    // `null` REMOVE o ponto (volta a valer o padrão); 0 declara benchmark zero.
    const nova: PontoBenchmark[] =
      valor == null ? outros : [...outros, { ...curva.find((p) => p.mes === mes), mes, valor }];
    mudar({ benchmarkCurva: nova.sort((a, b) => a.mes - b.mes) });
  };

  const preencherCurva = () =>
    mudar({
      benchmarkCurva: Array.from({ length: prazoTotal }, (_, k) => ({
        ...curva.find((p) => p.mes === k + 1),
        mes: k + 1,
        valor: valorDoMes(k + 1) ?? fin.benchmarkPadrao,
      })),
    });

  return (
    <div className="space-y-6">
      {/* ─── Identidade da facilidade ─────────────────────────────────────
          `ordem` não aparece como campo: ela É a posição na lista, e reordenar
          pelos botões do acordeão é mais direto — e menos sujeito a duas
          facilidades com a mesma ordem — do que digitar um número. */}
      <FinanceDetailSectionCard
        title="Identificação"
        description="O nome aparece no fluxo de caixa, nas exportações e no seletor de refinanciamento."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              className={financeDetailFieldClassName}
              value={fin.nome ?? ''}
              placeholder="Financiamento"
              onChange={(e) => mudar({ nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Refinancia</Label>
            <Select
              value={fin.refinanciaIndex == null ? 'nenhuma' : String(fin.refinanciaIndex)}
              onValueChange={(v) =>
                mudar({ refinanciaIndex: v === 'nenhuma' ? null : Number(v) })
              }
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {facilidades.map((outra, k) =>
                  // Uma facilidade não pode refinanciar a si mesma: seria um
                  // ciclo trivial, o saque quitaria o saldo que acabou de criar,
                  // e `refinanciamento_circular` acenderia vermelho. Melhor não
                  // oferecer do que oferecer e reprovar.
                  k === indice ? null : (
                    <SelectItem key={k} value={String(k)}>
                      {outra.nome || `Facilidade ${k + 1}`}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              No primeiro mês em que esta facilidade entra na janela de saque, ela saca ao menos o
              saldo devedor da escolhida e aquela amortiza esse valor no mesmo mês. A facilidade
              refinanciada precisa vir ANTES na ordem, para fechar os juros do mês antes desta
              sacar.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Ativa</Label>
            <div className="flex h-10 items-center gap-3">
              <Switch
                checked={fin.ativo !== false}
                onCheckedChange={(v) => mudar({ ativo: v })}
              />
              <span className="text-sm text-slate-600">
                {fin.ativo === false ? 'Fora do fluxo' : 'Entra no fluxo'}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Desligada, a facilidade continua gravada com todos os campos e não saca, não cobra
              juros e não aparece no fluxo. É o jeito de comparar cenários sem apagar o que foi
              declarado.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Custo da dívida" description="Taxa nominal e fee de estruturação.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Taxa ao ano (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.taxaAnual * 100}
              onChange={(e) => mudar({ taxaAnual: (Number(e.target.value) || 0) / 100 })}
            />
            <p className="text-xs text-slate-500">Equivale a {percentual(fin.taxaAnual / 12, 4)} ao mês.</p>
          </div>
          <div className="space-y-2">
            <Label>Fee de estruturação (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.feeEstruturacaoPct * 100}
              onChange={(e) => mudar({ feeEstruturacaoPct: (Number(e.target.value) || 0) / 100 })}
            />
            {/* O número e a SUA BASE lado a lado, na tela onde o percentual é
                configurado. O fee incide sobre o compromisso da linha — valor
                contratado, senão LTC máximo × custo direto —, nunca sobre o
                total sacado: numa linha rotativa o mesmo dinheiro é sacado
                várias vezes e o fee inflaria junto. Sem teto declarado a base
                cai no pico do saldo devedor, e aí a linha vem em tom de
                atenção com o mesmo texto da conferência `fee_sem_base_contratada`. */}
            <p className={`text-xs ${semBaseContratada ? 'text-amber-700' : 'text-slate-500'}`}>
              Fee estimado:{' '}
              <strong className="font-semibold">
                {dinheiro(resultado.apuracao.feeTotal, rascunho.moeda)}
              </strong>{' '}
              · {percentual(fin.feeEstruturacaoPct)} sobre {rotuloBaseFee} de{' '}
              {dinheiro(resultado.apuracao.baseFeeEstruturacao, rascunho.moeda)}
            </p>
            {semBaseContratada ? (
              <p className="text-xs leading-5 text-amber-700">
                Informe o valor contratado abaixo para o fee incidir sobre o compromisso da linha.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Quando o fee é cobrado</Label>
            <Select value={fin.feeTiming} onValueChange={(v) => mudar({ feeTiming: v as Financiamento['feeTiming'] })}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_draw">No primeiro saque</SelectItem>
                <SelectItem value="contract_month">Em mês específico</SelectItem>
              </SelectContent>
            </Select>
            {fin.feeTiming === 'contract_month' ? (
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                placeholder="Mês do fee"
                value={fin.feeMes ?? ''}
                onChange={(e) => mudar({ feeMes: numeroOuNulo(e.target.value) })}
              />
            ) : null}
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Curva de saque" description="Janela, modo de dimensionamento e teto.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Primeiro mês de saque</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              value={fin.mesInicioSaque}
              onChange={(e) => mudar({ mesInicioSaque: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Último mês de saque</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              value={fin.mesFimSaque}
              onChange={(e) => mudar({ mesFimSaque: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Modo de saque</Label>
            <Select value={fin.modoSaque} onValueChange={(v) => trocarModoSaque(v as ModoSaque)}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODOS_SAQUE.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ROTULO_MODO_SAQUE[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {EXPLICACAO_MODO_SAQUE[fin.modoSaque]}
        </p>
        {fin.modoSaque === 'equity_first_demanda' && fin.custoFinanceiroNaDemanda ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <strong className="font-semibold">Custo financeiro na demanda ligado.</strong> Neste modo
            os juros e o fee entram no dimensionamento do saque. Sem isso eles continuariam saindo do
            caixa sem cobertura, e o caixa fecharia abaixo do colchão justamente nos meses de saque.
            A opção está em <em>Amortização e juros</em>, logo abaixo.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>LTC máximo (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="sem teto"
              value={fin.maxLtcPct == null ? '' : fin.maxLtcPct * 100}
              onChange={(e) =>
                mudar({ maxLtcPct: e.target.value === '' ? null : (Number(e.target.value) || 0) / 100 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Valor contratado</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="usa o LTC"
              value={fin.valorContratado ?? ''}
              onChange={(e) => mudar({ valorContratado: numeroOuNulo(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Tem precedência sobre o LTC quando preenchido.</p>
          </div>
          <div className="space-y-2">
            <Label>Colchão mínimo de caixa</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.colchaoMinimoCaixa}
              onChange={(e) => mudar({ colchaoMinimoCaixa: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 p-3">
          <Switch
            checked={fin.linhaRotativa}
            onCheckedChange={(v) => mudar({ linhaRotativa: v })}
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">Linha de crédito rotativa</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Amortizar devolve limite. A capacidade do mês passa a ser o teto menos o saldo devedor.
            </span>
            {/* Leitura, não entrada: os dois números que dizem se o teto aperta.
                O pico é o que o contrato rotativo limita; a capacidade mínima
                observada mostra o quanto faltou de folga no pior mês. */}
            <span className="mt-2 block text-xs text-slate-600">
              Pico do saldo devedor:{' '}
              <strong className="font-semibold text-slate-800">
                {dinheiro(resultado.apuracao.saldoDevedorMaximo, rascunho.moeda)}
              </strong>{' '}
              · capacidade mínima no projeto:{' '}
              <strong className="font-semibold text-slate-800">{capacidadeMinima}</strong>
            </span>
          </span>
        </label>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Amortização e juros" description="Como a dívida é quitada e como os juros são tratados.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modo de amortização</Label>
            <Select
              value={fin.modoAmortizacao}
              onValueChange={(v) => mudar({ modoAmortizacao: v as Financiamento['modoAmortizacao'] })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODOS_AMORTIZACAO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ROTULO_MODO_AMORTIZACAO[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4 pt-1">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <Switch checked={fin.capitalizarJuros} onCheckedChange={(v) => mudar({ capitalizarJuros: v })} />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Capitalizar juros</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Os juros viram principal em vez de sair do caixa. Exige iteração no cálculo.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <Switch
                checked={fin.custoFinanceiroNaDemanda}
                onCheckedChange={(v) => mudar({ custoFinanceiroNaDemanda: v })}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Financiar o custo financeiro</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Nos modos dimensionados por demanda, faz a dívida cobrir também juros e fee. Sem isso, eles ficam por conta do equity.
                </span>
              </span>
            </label>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {fin.modoAmortizacao === 'at_exit'
            ? 'Todo o saldo remanescente é amortizado no mês da saída.'
            : 'Nenhuma amortização automática — só o que for lançado à mão na linha de amortização.'}{' '}
          O release por unidade vendida amortiza nos dois modos: é cláusula do contrato, não modo de
          amortização.
        </p>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Reserva de juros"
        description="Saldo que paga os juros até acabar. Depois disso a linha vira interest after reserve e o juro volta a sair do caixa."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Reserva de juros</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.reservaJuros}
              onChange={(e) => mudar({ reservaJuros: Number(e.target.value) || 0 })}
            />
            <p className="text-xs text-slate-500">
              Zero = sem reserva. Não substitui a capitalização de juros: os dois convivem, e a
              reserva paga primeiro.
            </p>
          </div>
          <label className="flex items-start gap-3 self-end rounded-xl border border-slate-200 p-3">
            <Switch
              checked={fin.reservaJurosSacada}
              onCheckedChange={(v) => mudar({ reservaJurosSacada: v })}
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Sacada do empréstimo</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Ligada, a reserva é constituída no primeiro saque, soma ao principal e paga juros
                sobre si mesma. Desligada, é bancada pelo equity e vale só como orçamento — não
                aumenta a dívida.
              </span>
            </span>
          </label>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Release price"
        description="Cada unidade vendida libera um valor para o banco. O saldo devedor cai em degraus a cada venda."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Release por unidade</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.releasePrice}
              onChange={(e) => mudar({ releasePrice: Number(e.target.value) || 0 })}
            />
            <p className="text-xs text-slate-500">Zero = sem release por valor fixo.</p>
          </div>
          <div className="space-y-2">
            <Label>Ou % do preço de venda</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="não usar"
              disabled={fin.releasePrice > 0}
              value={fin.releasePricePct == null ? '' : fin.releasePricePct * 100}
              onChange={(e) =>
                mudar({
                  releasePricePct:
                    e.target.value === '' ? null : (Number(e.target.value) || 0) / 100,
                })
              }
            />
            <p className="text-xs text-slate-500">
              Só é lido quando o valor fixo é zero — o fixo tem precedência.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Total liberado no projeto</Label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold tabular-nums text-slate-900">
              {dinheiro(
                fin.releasePrice > 0
                  ? fin.releasePrice * resultado.agregados.unidadesTotal
                  : (fin.releasePricePct ?? 0) * resultado.agregados.vgv,
                rascunho.moeda,
              )}
            </div>
            <p className="text-xs text-slate-500">
              Contra {dinheiro(resultado.apuracao.dividaSacada, rascunho.moeda)} de dívida sacada.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Convenção e indexação"
        description="Como o juro do mês é contado e se a taxa é fixa ou indexada."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Convenção de juros</Label>
            <Select
              value={fin.convencaoJuros}
              onValueChange={(v) => mudar({ convencaoJuros: v as ConvencaoJuros })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVENCOES_JUROS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ROTULO_CONVENCAO_JUROS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              A convenção muda o juro TOTAL do projeto e deve vir do contrato, não do gosto de quem
              modela: sobre base 360, um ano de 365 dias cobra ~1,39% a mais que a conta mensal.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de taxa</Label>
            <Select
              value={fin.tipoTaxa}
              onValueChange={(v) => mudar({ tipoTaxa: v as Financiamento['tipoTaxa'] })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável (benchmark + spread)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {fin.tipoTaxa === 'fixa'
                ? 'A taxa ao ano acima vale para o projeto inteiro.'
                : 'A taxa ao ano acima deixa de ser lida.'}
            </p>
          </div>
          {fin.tipoTaxa === 'variavel' ? (
            <div className="space-y-2">
              <Label>Benchmark</Label>
              <Input
                className={financeDetailFieldClassName}
                placeholder="SOFR, CDI…"
                value={fin.benchmarkNome ?? ''}
                onChange={(e) => mudar({ benchmarkNome: e.target.value || null })}
              />
              <p className="text-xs text-slate-500">Só o nome, para a leitura do relatório.</p>
            </div>
          ) : null}
        </div>

        {fin.tipoTaxa === 'variavel' ? (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Spread (%)</Label>
                <Input
                  type="number"
                  step="any"
                  className={financeDetailFieldClassName}
                  value={fin.spread * 100}
                  onChange={(e) => mudar({ spread: (Number(e.target.value) || 0) / 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Benchmark padrão (%)</Label>
                <Input
                  type="number"
                  step="any"
                  className={financeDetailFieldClassName}
                  value={fin.benchmarkPadrao * 100}
                  onChange={(e) => mudar({ benchmarkPadrao: (Number(e.target.value) || 0) / 100 })}
                />
                <p className="text-xs text-slate-500">
                  Vale nos meses sem ponto na curva. Mês sem linha não é benchmark zero.
                </p>
              </div>
              <div className="space-y-2 self-end">
                <Button type="button" variant="outline" onClick={preencherCurva}>
                  Preencher tudo com o padrão
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mês</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Benchmark (%)</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taxa efetiva (a.a.)</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.meses.map((mes) => {
                    const v = valorDoMes(mes.mes);
                    return (
                      <tr key={mes.mes} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1 text-sm text-slate-600">
                          {mes.mes} <span className="text-slate-400">({mes.data})</span>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="any"
                            className="ml-auto h-8 w-28 text-right tabular-nums"
                            placeholder={`${(fin.benchmarkPadrao * 100).toFixed(4)} (padrão)`}
                            value={v == null ? '' : v * 100}
                            onChange={(e) =>
                              definirPontoCurva(
                                mes.mes,
                                e.target.value === '' ? null : (Number(e.target.value) || 0) / 100,
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-right text-sm tabular-nums text-slate-700">
                          {percentual(mes.taxaEfetivaAno, 4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Campo em branco usa o padrão; digitar 0 declara benchmark zero naquele mês — são
              coisas diferentes, e o motor trata as duas assim.
            </p>
          </div>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}

/**
 * A aba: uma facilidade por painel, na ordem de precedência.
 *
 * A ORDEM não é exibição — é a precedência da demanda de caixa dentro do mês.
 * Nos modos dimensionados por demanda, a primeira facilidade saca o que couber
 * no teto dela e só o que sobrar chega à segunda. Por isso os botões de subir e
 * descer ficam bem visíveis, e o rótulo diz "1º", "2º".
 */
export function AbaFinanciamento({ rascunho, alterar, resultado }: Props) {
  const facilidades = rascunho.financiamentos ?? [];
  // Aberta a primeira por default: com uma facilidade só — o caso de toda
  // modelagem já gravada — a tela abre exatamente como antes, sem um clique a
  // mais para chegar aos campos.
  const [aberta, setAberta] = useState(0);

  const trocarFacilidade = (i: number, patch: Partial<Financiamento>) =>
    alterar({ financiamentos: facilidades.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  /**
   * Reordena, remapeando TODO `refinanciaIndex` que aponte para as posições
   * trocadas.
   *
   * Sem o remapeamento, subir a segunda facilidade faria o vínculo de
   * refinanciamento apontar para outra dívida — em silêncio, e com número
   * diferente. É o mesmo cuidado do `grupo_pai` na duplicação, e a razão de o
   * motor trabalhar por índice: o índice é posicional, e mover a posição obriga
   * a mover quem aponta para ela.
   */
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= facilidades.length) return;
    const nova = [...facilidades];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    const remapeado = nova.map((f) => {
      const alvo = f.refinanciaIndex;
      if (alvo == null) return f;
      return {
        ...f,
        refinanciaIndex: alvo === i ? j : alvo === j ? i : alvo,
      };
    });
    alterar({ financiamentos: remapeado });
    setAberta(j);
  };

  const acrescentar = () => {
    const modelo = facilidades[0];
    alterar({
      financiamentos: [
        ...facilidades,
        // Nasce com os campos de contrato da PRIMEIRA, e não zerados: uma
        // facidade com taxa zero e janela fechada não saca nada, e o usuário
        // procuraria o erro no modo de saque. O que NÃO é herdado é o vínculo de
        // refinanciamento — ele é do contrato de origem, não deste.
        {
          ...(modelo ?? {
            taxaAnual: 0,
            feeEstruturacaoPct: 0,
            feeTiming: 'first_draw' as const,
            feeMes: null,
            mesInicioSaque: 1,
            mesFimSaque: Math.max(1, resultado.cronograma.prazoTotal),
            modoSaque: 'manual' as const,
            maxLtcPct: null,
            valorContratado: null,
            custoFinanceiroNaDemanda: false,
            modoAmortizacao: 'at_exit' as const,
            capitalizarJuros: false,
            colchaoMinimoCaixa: 0,
            linhaRotativa: false,
            reservaJuros: 0,
            reservaJurosSacada: true,
            prazoMeses: null,
            carenciaMeses: 0,
            amortizacaoMeses: null,
            balloonNoVencimento: true,
            releasePrice: 0,
            releasePricePct: null,
            convencaoJuros: 'mensal_12' as const,
            tipoTaxa: 'fixa' as const,
            spread: 0,
            benchmarkNome: null,
            benchmarkPadrao: 0,
          }),
          id: undefined,
          ordem: facilidades.length,
          nome: `Facilidade ${facilidades.length + 1}`,
          ativo: true,
          refinanciaIndex: null,
          // A curva do benchmark é da OUTRA facilidade: herdá-la copiaria uma
          // projeção de taxa que ninguém declarou para esta.
          benchmarkCurva: [],
        },
      ],
    });
    setAberta(facilidades.length);
  };

  /**
   * Remover reindexa: os `refinanciaIndex` posteriores andam uma casa para trás,
   * e quem apontava para a removida perde o vínculo (vira `null`), exatamente
   * como o ON DELETE SET NULL do banco faz.
   *
   * Os OVERRIDES da facilidade removida NÃO são apagados aqui nem no banco —
   * ficam guardados, inativos, e `overrides_facilidade_removida` acende âmbar.
   */
  const remover = (i: number) => {
    if (!window.confirm('Remover esta facilidade? Os overrides dela ficam guardados e inativos.')) {
      return;
    }
    alterar({
      financiamentos: facilidades
        .filter((_, k) => k !== i)
        .map((f) => {
          const alvo = f.refinanciaIndex;
          if (alvo == null) return f;
          if (alvo === i) return { ...f, refinanciaIndex: null };
          return { ...f, refinanciaIndex: alvo > i ? alvo - 1 : alvo };
        }),
    });
    setAberta(0);
  };

  const moeda = rascunho.moeda;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          A ordem define a precedência da demanda de caixa DENTRO DO MÊS: nos modos dimensionados
          por demanda, a primeira facilidade saca o que couber no teto dela e só o que sobrar chega
          à seguinte. Trocar duas de lugar, com tetos e taxas diferentes, muda o juro do projeto
          inteiro.
        </p>
        <Button type="button" variant="outline" onClick={acrescentar}>
          <Plus className="mr-2 h-4 w-4" />
          Nova facilidade
        </Button>
      </div>

      {facilidades.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Nenhuma facilidade de crédito. O projeto é calculado sem dívida — saque, juros e fee
          zerados o projeto inteiro.
        </div>
      ) : null}

      {facilidades.map((f, i) => {
        const expandida = aberta === i;
        // Saldo de pico DESTA facilidade, para o cabeçalho dizer algo útil sem
        // abrir o painel. Sai de `porFacilidade`, que é a mesma fonte do fluxo.
        const pico = resultado.meses.reduce(
          (a, m) => Math.max(a, m.porFacilidade.find((x) => x.indice === i)?.saldoDevedor ?? 0),
          0,
        );
        return (
          <div key={f.id ?? i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setAberta(expandida ? -1 : i)}
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition ${expandida ? '' : '-rotate-90'}`}
                />
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {i + 1}º
                </span>
                <span className="font-medium text-slate-900">{f.nome || `Facilidade ${i + 1}`}</span>
                {f.ativo === false ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    Inativa
                  </span>
                ) : null}
                {f.refinanciaIndex != null ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                    refinancia {facilidades[f.refinanciaIndex]?.nome || `#${f.refinanciaIndex + 1}`}
                  </span>
                ) : null}
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  {percentual(f.taxaAnual)} · pico {dinheiro(pico, moeda)}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === 0}
                  title="Subir (ganha precedência na demanda)"
                  onClick={() => mover(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === facilidades.length - 1}
                  title="Descer"
                  onClick={() => mover(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-600"
                  title="Remover facilidade"
                  onClick={() => remover(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {expandida ? (
              <div className="p-4">
                <FormularioFacilidade
                  rascunho={rascunho}
                  resultado={resultado}
                  fin={f}
                  indice={i}
                  facilidades={facilidades}
                  mudar={(patch) => trocarFacilidade(i, patch)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
