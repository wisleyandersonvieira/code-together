'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Archive, ArchiveRestore, Building2, Calculator, Copy, Loader2, Pencil, Plus, Search, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FinanceActionButton,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  EXPLICACAO_TIPO_MODELAGEM,
  ROTULO_TIPO_MODELAGEM,
  TIPOS_MODELAGEM,
  calcular,
  mapearModelInput,
} from '@/lib/modelagem';
import type { TipoModelagem } from '@/lib/modelagem';
import { ModelagemEditor } from './ModelagemEditor';
import { dataCurta, dinheiro, multiplo, percentual } from './formato';

import loadModelagensAction from '@/actions/loadModelagens';
import createModelagemAction from '@/actions/createModelagem';
import updateModelagemPremissasAction from '@/actions/updateModelagemPremissas';
import deleteModelagemAction from '@/actions/deleteModelagem';
import duplicarModelagemAction from '@/actions/duplicarModelagem';

const HOJE = () => new Date().toISOString().slice(0, 10);

/**
 * Selo do modo de negócio, para a lista e o cabeçalho do editor.
 *
 * A cor não é decoração: as duas modalidades convivem na mesma lista e o usuário
 * precisa distinguir de relance uma pro forma de venda de uma de locação — os
 * números têm o mesmo formato e significados completamente diferentes.
 */
export function SeloTipoModelagem({ tipo }: { tipo: TipoModelagem }) {
  const ehLocacao = tipo === 'locacao';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        ehLocacao ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {ROTULO_TIPO_MODELAGEM[tipo]}
    </span>
  );
}

/** Tipo declarado na linha do banco. Ausente ou desconhecido = 'venda'. */
const tipoDaLinha = (linha: { tipo_modelagem?: unknown }): TipoModelagem =>
  TIPOS_MODELAGEM.includes(linha?.tipo_modelagem as TipoModelagem)
    ? (linha.tipo_modelagem as TipoModelagem)
    : 'venda';

export function ModelagensList() {
  const { toast } = useToast();
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebounce(busca, 300);
  const [novaAberta, setNovaAberta] = useState(false);
  /**
   * O TIPO é escolhido num passo ANTERIOR ao formulário, e não num select dentro
   * dele. A razão é que ele não muda depois de criada: um campo no meio de
   * outros seis convida a passar batido, e o preço de passar batido aqui é
   * refazer a modelagem inteira. `null` = ainda na tela de escolha.
   */
  const [tipoNova, setTipoNova] = useState<TipoModelagem | null>(null);
  const [nova, setNova] = useState({ nome: '', localizacao: '', dataInicio: HOJE(), aprovacao: 10, construcao: 8, posObra: 5 });
  const [criando, setCriando] = useState(false);
  /** Filtro por modo de negócio. 'todos' não é um TipoModelagem — é a ausência de filtro. */
  const [filtroTipo, setFiltroTipo] = useState<TipoModelagem | 'todos'>('todos');
  /** Duplicação: a linha de origem e o nome que o dialog vai gravar. */
  const [duplicando, setDuplicando] = useState<{ id: number; nome: string; ehModelo: boolean } | null>(null);
  const [nomeCopia, setNomeCopia] = useState('');
  const [duplicandoAgora, setDuplicandoAgora] = useState(false);

  const [linhas, carregando, erro, recarregar] = useLoadAction(loadModelagensAction, [], {
    busca: buscaDebounced || null,
  });

  const [criarModelagem] = useMutateAction(createModelagemAction);
  const [atualizarPremissas] = useMutateAction(updateModelagemPremissasAction);
  const [removerModelagem] = useMutateAction(deleteModelagemAction);
  const [duplicar] = useMutateAction(duplicarModelagemAction);

  /**
   * Os indicadores da lista saem do MESMO motor da tela de detalhe. É por isso
   * que a consulta traz as tabelas filhas: um número estimado aqui divergiria do
   * número exato lá dentro.
   */
  const modelagens = useMemo(
    () =>
      (Array.isArray(linhas) ? linhas : [])
        // O filtro por tipo é do CLIENTE, e não do SELECT, de propósito: a
        // consulta já traz as tabelas filhas para o motor rodar, e refazer a
        // carga a cada clique no filtro custaria muito mais do que filtrar um
        // array que já está na memória.
        .filter((linha: { tipo_modelagem?: unknown }) => filtroTipo === 'todos' || tipoDaLinha(linha) === filtroTipo)
        .map((linha: any) => {
          const input = mapearModelInput(linha);
          const resultado = calcular(input);
          return { linha, input, resultado };
        })
        // A MODELO sempre primeiro, seja qual for a ordenação da consulta: ela é
        // o ponto de partida da lista, não mais uma linha no meio. `sort` é
        // estável no ES2019+, então a ordem relativa das demais não muda.
        .sort((a, b) => Number(!!b.linha.is_modelo) - Number(!!a.linha.is_modelo)),
    [linhas, filtroTipo],
  );

  const criar = async () => {
    if (!nova.nome.trim()) {
      toast({ title: 'Informe um nome para a modelagem', variant: 'destructive' });
      return;
    }
    setCriando(true);
    try {
      const r = await criarModelagem({
        empresaId: null,
        projetoId: null,
        nome: nova.nome,
        localizacao: nova.localizacao,
        tipoUso: '',
        moeda: 'USD',
        dataInicio: nova.dataInicio,
        mesesAprovacao: nova.aprovacao,
        mesesConstrucao: nova.construcao,
        mesesPosObra: nova.posObra,
        horizonteMaximo: 60,
        dataBase: null,
        revisao: '',
        status: 'rascunho',
        // O tipo é gravado UMA vez, aqui. Não há caminho de edição depois — ver
        // o comentário de `tipoNova` e o campo somente leitura no editor.
        tipoModelagem: tipoNova ?? 'venda',
      });
      setNovaAberta(false);
      setTipoNova(null);
      setNova({ nome: '', localizacao: '', dataInicio: HOJE(), aprovacao: 10, construcao: 8, posObra: 5 });
      recarregar();
      const id = Array.isArray(r) ? r[0]?.id : null;
      if (id) setAbertaId(Number(id));
    } catch (e: any) {
      toast({ title: 'Erro ao criar modelagem', description: e?.message, variant: 'destructive' });
    } finally {
      setCriando(false);
    }
  };

  const arquivar = async (linha: any) => {
    const novoStatus = linha.status === 'arquivada' ? 'rascunho' : 'arquivada';
    await atualizarPremissas({
      id: linha.id,
      nome: linha.nome,
      localizacao: linha.localizacao,
      tipoUso: linha.tipo_uso,
      moeda: linha.moeda,
      dataInicio: String(linha.data_inicio).slice(0, 10),
      mesesAprovacao: linha.meses_aprovacao,
      mesesConstrucao: linha.meses_construcao,
      mesesPosObra: linha.meses_pos_obra,
      horizonteMaximo: linha.horizonte_maximo,
      dataBase: null,
      revisao: linha.revisao,
      status: novoStatus,
    });
    toast({ title: novoStatus === 'arquivada' ? 'Modelagem arquivada' : 'Modelagem reaberta' });
    recarregar();
  };

  const excluir = async (linha: any) => {
    if (!window.confirm(`Excluir a modelagem "${linha.nome}"? Unidades, custos, sócios e overrides vão junto.`)) return;
    const r = await removerModelagem({ id: linha.id });
    // O action tem `AND is_modelo = FALSE` e devolve RETURNING id. Lista vazia
    // significa que nada foi apagado — e o único motivo possível é ser a modelo.
    // Sem esta leitura a tela diria "excluída" para uma linha que continua lá.
    if (!Array.isArray(r) || r.length === 0) {
      toast({
        title: 'A modelagem modelo não pode ser excluída',
        description: 'Ela define o plano de contas padrão. Use Duplicar para criar uma modelagem a partir dela.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Modelagem excluída' });
    recarregar();
  };

  /** Abre o dialog com o nome já sugerido — duplicar quase nunca quer o nome cru. */
  const abrirDuplicacao = (linha: { id: number | string; nome: string; is_modelo?: boolean }) => {
    const ehModelo = !!linha.is_modelo;
    setDuplicando({ id: Number(linha.id), nome: linha.nome, ehModelo });
    setNomeCopia(ehModelo ? 'Nova modelagem' : `Cópia de ${linha.nome}`);
  };

  const confirmarDuplicacao = async () => {
    if (!duplicando) return;
    if (!nomeCopia.trim()) {
      toast({ title: 'Informe um nome para a cópia', variant: 'destructive' });
      return;
    }
    setDuplicandoAgora(true);
    try {
      const r = await duplicar({ origemId: duplicando.id, nome: nomeCopia.trim() });
      const id = Array.isArray(r) ? r[0]?.id : null;
      setDuplicando(null);
      recarregar();
      // Vai direto para o editor: duplicar é sempre o começo de uma edição, e
      // obrigar o usuário a caçar a linha nova na lista é atrito à toa.
      if (id) setAbertaId(Number(id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erro ao duplicar modelagem', description: msg, variant: 'destructive' });
    } finally {
      setDuplicandoAgora(false);
    }
  };

  if (abertaId != null) {
    return (
      <ModelagemEditor
        modelagemId={abertaId}
        onBack={() => {
          setAbertaId(null);
          recarregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Modelagens"
        description="Modelagem financeira de incorporação: premissas, fluxo de caixa mês a mês, apuração e indicadores de retorno."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setNovaAberta(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova modelagem
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={`${listingFilterFieldClassName} pl-9`}
              placeholder="Buscar por nome…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {/* Filtro por modo de negócio. Botões, e não um select: são três
              opções fixas e o estado atual tem de ficar visível sem abrir nada. */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(['todos', ...TIPOS_MODELAGEM] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setFiltroTipo(opcao)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filtroTipo === opcao
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opcao === 'todos' ? 'Todos' : ROTULO_TIPO_MODELAGEM[opcao]}
              </button>
            ))}
          </div>
        </div>
      </ListingFilterCard>

      {erro ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar as modelagens: {String(erro.message ?? erro)}
        </div>
      ) : carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando…
        </div>
      ) : modelagens.length === 0 ? (
        <ListingEmptyState
          icon={Calculator}
          title="Nenhuma modelagem ainda"
          description="Crie a primeira modelagem para começar a projetar o fluxo de caixa de um empreendimento."
        />
      ) : (
        <ListingTableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={listingTableHeadClassName}>Modelagem</TableHead>
                <TableHead className={listingTableHeadClassName}>Local</TableHead>
                {/* Uma coluna, duas grandezas: no modo venda é o VGV; no modo
                    locação o VGV é ignorado pelo motor e o que importa é o
                    valor de saída (NOI ÷ cap rate). Mostrar VGV numa locação
                    exibiria um número que não entra em conta nenhuma. */}
                <TableHead className={`${listingTableHeadClassName} text-right`}>VGV / Saída</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Lucro projetado</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>MOIC</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>TIR anual</TableHead>
                <TableHead className={listingTableHeadClassName}>Status</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Alterada em</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelagens.map(({ linha, input, resultado }) => {
                const problemas = resultado.conferencias.filter((c) => c.semaforo === 'vermelho').length;
                return (
                  <TableRow
                    key={linha.id}
                    className="cursor-pointer hover:bg-slate-50"
                    // Na MODELO a ação principal é DUPLICAR, não abrir: o que se
                    // faz com um plano de contas é partir dele. Editá-lo é
                    // possível e continua a um clique — no botão de lápis ao
                    // lado —, mas é a exceção, não o caminho comum.
                    onClick={() =>
                      linha.is_modelo ? abrirDuplicacao(linha) : setAbertaId(Number(linha.id))
                    }
                  >
                    <TableCell className={listingTableCellClassName}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{linha.nome}</span>
                        <SeloTipoModelagem tipo={tipoDaLinha(linha)} />
                        {linha.is_modelo ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                            Modelo
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {resultado.cronograma.prazoTotal} meses · {resultado.agregados.unidadesTotal} unidades
                        {input.unidades.length !== resultado.agregados.unidadesTotal
                          ? ` em ${input.unidades.length} tipologias`
                          : null}
                        {problemas > 0 ? (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            {problemas} {problemas === 1 ? 'conferência' : 'conferências'} em vermelho
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{linha.localizacao || '—'}</TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                      {tipoDaLinha(linha) === 'locacao'
                        ? dinheiro(resultado.indicadores.valorSaida ?? 0, input.moeda)
                        : dinheiro(resultado.agregados.vgv, input.moeda)}
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                      {dinheiro(resultado.apuracao.lucroProjeto, input.moeda)}
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                      {multiplo(resultado.indicadores.moic)}
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                      {percentual(resultado.indicadores.tirAnual)}
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{linha.status}</TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right text-xs text-slate-500`}>
                      {dataCurta(String(linha.updated_at ?? '').slice(0, 10))}
                    </TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <FinanceActionButton
                          title={linha.is_modelo ? 'Duplicar para criar uma modelagem' : 'Duplicar'}
                          icon={Copy}
                          onClick={() => abrirDuplicacao(linha)}
                        />
                        {/* Só na modelo: como o clique da linha ali duplica, o
                            acesso ao editor precisa de porta própria. A modelo é
                            editável — é assim que o plano de contas evolui. */}
                        {linha.is_modelo ? (
                          <FinanceActionButton
                            title="Editar o plano de contas"
                            icon={Pencil}
                            onClick={() => setAbertaId(Number(linha.id))}
                          />
                        ) : null}
                        <FinanceActionButton
                          title={linha.status === 'arquivada' ? 'Reabrir' : 'Arquivar'}
                          icon={linha.status === 'arquivada' ? ArchiveRestore : Archive}
                          onClick={() => arquivar(linha)}
                        />
                        {/* Na modelo o excluir é AUSENTE, não desabilitado: um
                            botão apagado convida a clicar e a descobrir que não
                            funciona. O title do próprio card já diz o porquê. */}
                        {linha.is_modelo ? null : (
                          <FinanceActionButton
                            title="Excluir"
                            tone="danger"
                            icon={Trash2}
                            onClick={() => excluir(linha)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ListingTableCard>
      )}

      <Dialog
        open={novaAberta}
        onOpenChange={(v) => {
          setNovaAberta(v);
          // Fechar volta ao passo da escolha: reabrir e cair direto no
          // formulário de um tipo escolhido numa sessão anterior é como alguém
          // cria uma locação achando que criou uma venda.
          if (!v) setTipoNova(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tipoNova === null ? 'Que tipo de modelagem?' : `Nova modelagem · ${ROTULO_TIPO_MODELAGEM[tipoNova]}`}
            </DialogTitle>
          </DialogHeader>

          {/* ─── PASSO 1: o tipo ────────────────────────────────────────────
              Dois cartões grandes, e não um select: a escolha NÃO muda depois de
              criada (cada modo tem campos que o outro ignora, e trocar deixaria
              campos órfãos), então ela merece uma tela própria, com uma frase
              dizendo o que cada modo é. */}
          {tipoNova === null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {TIPOS_MODELAGEM.map((tipo) => {
                const Icone = tipo === 'locacao' ? Building2 : Store;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoNova(tipo)}
                    className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-900 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Icone className="h-5 w-5 text-slate-500 group-hover:text-slate-900" />
                      <span className="text-base font-semibold text-slate-900">
                        {ROTULO_TIPO_MODELAGEM[tipo]}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {EXPLICACAO_TIPO_MODELAGEM[tipo]}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input value={nova.localizacao} onChange={(e) => setNova({ ...nova, localizacao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data do mês 1</Label>
              <Input type="date" value={nova.dataInicio} onChange={(e) => setNova({ ...nova, dataInicio: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['Aprovação', 'aprovacao'],
                ['Construção', 'construcao'],
                ['Pós-obra', 'posObra'],
              ] as const).map(([rotulo, campo]) => (
                <div key={campo} className="space-y-2">
                  <Label>{rotulo} (meses)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={nova[campo]}
                    onChange={(e) => setNova({ ...nova, [campo]: Number(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
          </div>
          )}

          {/* O rodapé só existe no passo 2: no passo 1 os próprios cartões são a
              ação, e um botão "Continuar" desabilitado só acrescentaria ruído. */}
          {tipoNova === null ? null : (
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTipoNova(null)}>
                Voltar
              </Button>
              <Button onClick={criar} disabled={criando}>
                {criando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicar. Vale para a modelo e para qualquer outra: o SQL é o mesmo, e
          a cópia sempre nasce com is_modelo = FALSE e status 'rascunho'. */}
      <Dialog open={duplicando != null} onOpenChange={(v) => !v && setDuplicando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {duplicando?.ehModelo ? 'Nova modelagem a partir do modelo' : 'Duplicar modelagem'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              className={listingFilterFieldClassName}
              value={nomeCopia}
              onChange={(e) => setNomeCopia(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !duplicandoAgora) confirmarDuplicacao();
              }}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              {duplicando?.ehModelo
                ? 'A cópia nasce com o plano de contas do modelo, todas as linhas zeradas.'
                : `Copia tudo de "${duplicando?.nome}": tipologias, fases, custos, sócios, takedowns, overrides e curva de benchmark.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicando(null)} disabled={duplicandoAgora}>
              Cancelar
            </Button>
            <Button onClick={confirmarDuplicacao} disabled={duplicandoAgora}>
              {duplicandoAgora ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
