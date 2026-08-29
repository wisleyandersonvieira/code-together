'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Archive, ArchiveRestore, Calculator, Loader2, Plus, Search, Trash2 } from 'lucide-react';
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
import { calcular, mapearModelInput } from '@/lib/modelagem';
import { ModelagemEditor } from './ModelagemEditor';
import { dataCurta, dinheiro, multiplo, percentual } from './formato';

import loadModelagensAction from '@/actions/loadModelagens';
import createModelagemAction from '@/actions/createModelagem';
import updateModelagemPremissasAction from '@/actions/updateModelagemPremissas';
import deleteModelagemAction from '@/actions/deleteModelagem';

const HOJE = () => new Date().toISOString().slice(0, 10);

export function ModelagensList() {
  const { toast } = useToast();
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebounce(busca, 300);
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState({ nome: '', localizacao: '', dataInicio: HOJE(), aprovacao: 10, construcao: 8, posObra: 5 });
  const [criando, setCriando] = useState(false);

  const [linhas, carregando, erro, recarregar] = useLoadAction(loadModelagensAction, [], {
    busca: buscaDebounced || null,
  });

  const [criarModelagem] = useMutateAction(createModelagemAction);
  const [atualizarPremissas] = useMutateAction(updateModelagemPremissasAction);
  const [removerModelagem] = useMutateAction(deleteModelagemAction);

  /**
   * Os indicadores da lista saem do MESMO motor da tela de detalhe. É por isso
   * que a consulta traz as tabelas filhas: um número estimado aqui divergiria do
   * número exato lá dentro.
   */
  const modelagens = useMemo(
    () =>
      (Array.isArray(linhas) ? linhas : []).map((linha: any) => {
        const input = mapearModelInput(linha);
        const resultado = calcular(input);
        return { linha, input, resultado };
      }),
    [linhas],
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
      });
      setNovaAberta(false);
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
    await removerModelagem({ id: linha.id });
    toast({ title: 'Modelagem excluída' });
    recarregar();
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className={`${listingFilterFieldClassName} pl-9`}
            placeholder="Buscar por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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
                <TableHead className={`${listingTableHeadClassName} text-right`}>VGV</TableHead>
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
                    onClick={() => setAbertaId(Number(linha.id))}
                  >
                    <TableCell className={listingTableCellClassName}>
                      <div className="font-medium text-slate-900">{linha.nome}</div>
                      <div className="text-xs text-slate-500">
                        {resultado.cronograma.prazoTotal} meses · {input.unidades.length} unidades
                        {problemas > 0 ? (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            {problemas} {problemas === 1 ? 'conferência' : 'conferências'} em vermelho
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={listingTableCellClassName}>{linha.localizacao || '—'}</TableCell>
                    <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                      {dinheiro(resultado.agregados.vgv, input.moeda)}
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
                          title={linha.status === 'arquivada' ? 'Reabrir' : 'Arquivar'}
                          icon={linha.status === 'arquivada' ? ArchiveRestore : Archive}
                          onClick={() => arquivar(linha)}
                        />
                        <FinanceActionButton
                          title="Excluir"
                          tone="danger"
                          icon={Trash2}
                          onClick={() => excluir(linha)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ListingTableCard>
      )}

      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova modelagem</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovaAberta(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={criando}>
              {criando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
