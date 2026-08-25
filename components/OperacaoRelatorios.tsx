'use client';

import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { BarChart3, PauseCircle, PieChart, Users } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';
import { financeDetailTabsListClassName, financeDetailTabsTriggerClassName } from '@/components/finance/detail-ui';
import { OperacaoStatusBadge, toNumber, toOptionalNumber } from '@/components/operacao/operacao-ui';
import loadOperacaoRelatorioGargaloAction from '@/actions/loadOperacaoRelatorioGargalo';
import loadOperacaoRelatorioCargaAction from '@/actions/loadOperacaoRelatorioCarga';
import loadOperacaoRelatorioObrigacoesAction from '@/actions/loadOperacaoRelatorioObrigacoes';
import loadOperacaoRelatorioAguardandoAction from '@/actions/loadOperacaoRelatorioAguardando';
import loadJornadaFluxosAction from '@/actions/loadJornadaFluxos';
import loadObrigacoesCatalogoAction from '@/actions/loadObrigacoesCatalogo';
import loadOperacaoSetoresAction from '@/actions/loadOperacaoSetores';
import { cn } from '@/lib/utils';
import { formatDateForDisplay } from '@/utils/timezone';

function formatDias(valor: unknown) {
  const numero = toOptionalNumber(valor);
  if (numero === null) return '—';
  return `${numero.toFixed(1).replace('.', ',')} d`;
}

function Percentual({ parte, total }: { parte: unknown; total: unknown }) {
  const totalNum = toNumber(total);
  if (totalNum === 0) return <span className="text-slate-400">—</span>;

  const pct = Math.round((toNumber(parte) * 100) / totalNum);
  const classe = pct >= 90 ? 'text-emerald-700' : pct >= 70 ? 'text-amber-700' : 'text-rose-700';

  return <span className={cn('font-semibold', classe)}>{pct}%</span>;
}

export function OperacaoRelatorios() {
  const [aba, setAba] = useState('gargalo');
  const [fluxoFilter, setFluxoFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const [obrigacaoFilter, setObrigacaoFilter] = useState('all');

  const [gargalo, loadingGargalo] = useLoadAction(loadOperacaoRelatorioGargaloAction, [], {
    fluxoId: fluxoFilter,
  });
  const [carga, loadingCarga] = useLoadAction(loadOperacaoRelatorioCargaAction, [], { setor: setorFilter });
  const [obrigacoes, loadingObrigacoes] = useLoadAction(loadOperacaoRelatorioObrigacoesAction, [], {
    obrigacaoId: obrigacaoFilter,
    setor: setorFilter,
  });
  const [aguardando, loadingAguardando] = useLoadAction(loadOperacaoRelatorioAguardandoAction, []);
  const [fluxos] = useLoadAction(loadJornadaFluxosAction, []);
  const [catalogo] = useLoadAction(loadObrigacoesCatalogoAction, []);
  const [setores] = useLoadAction(loadOperacaoSetoresAction, []);

  const listaGargalo = Array.isArray(gargalo) ? gargalo : [];
  const listaCarga = Array.isArray(carga) ? carga : [];
  const listaObrigacoes = Array.isArray(obrigacoes) ? obrigacoes : [];
  const listaAguardando = Array.isArray(aguardando) ? aguardando : [];

  const setorOptions = useMemo(
    () => (Array.isArray(setores) ? setores : []).map((linha: any) => String(linha.setor)),
    [setores],
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Relatórios da Operação"
        description="Onde a operação trava, quem está sobrecarregado e o que está travado com terceiros."
      />

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className={financeDetailTabsListClassName}>
          <TabsTrigger value="gargalo" className={financeDetailTabsTriggerClassName}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Gargalo por etapa
          </TabsTrigger>
          <TabsTrigger value="carga" className={financeDetailTabsTriggerClassName}>
            <Users className="mr-2 h-4 w-4" />
            Carga por responsável
          </TabsTrigger>
          <TabsTrigger value="obrigacoes" className={financeDetailTabsTriggerClassName}>
            <PieChart className="mr-2 h-4 w-4" />
            Obrigações por competência
          </TabsTrigger>
          <TabsTrigger value="aguardando" className={financeDetailTabsTriggerClassName}>
            <PauseCircle className="mr-2 h-4 w-4" />
            Travado com terceiros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gargalo" className="mt-4 space-y-4">
          <ListingFilterCard>
            <div className="grid gap-3 lg:grid-cols-[1fr_3fr]">
              <Select value={fluxoFilter} onValueChange={setFluxoFilter}>
                <SelectTrigger className={listingFilterFieldClassName}>
                  <SelectValue placeholder="Fluxo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fluxos</SelectItem>
                  {(Array.isArray(fluxos) ? fluxos : []).map((fluxo: any) => (
                    <SelectItem key={fluxo.id} value={String(fluxo.id)}>
                      {fluxo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="self-center text-xs text-slate-500">
                O tempo é separado em <strong>equipe</strong> e <strong>terceiros</strong>: o período aguardando
                cliente ou órgão sai da conta do SLA e aparece na própria coluna.
              </p>
            </div>
          </ListingFilterCard>

          <ListingTableCard>
            {loadingGargalo ? (
              <div className="p-8 text-center text-sm text-slate-500">Calculando...</div>
            ) : listaGargalo.length === 0 ? (
              <ListingEmptyState
                icon={BarChart3}
                title="Ainda sem histórico"
                description="Assim que as jornadas começarem a movimentar etapas, o tempo médio de cada uma aparece aqui."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Fluxo / Etapa</TableHead>
                      <TableHead className={listingTableHeadClassName}>SLA</TableHead>
                      <TableHead className={listingTableHeadClassName}>Concluídas</TableHead>
                      <TableHead className={listingTableHeadClassName}>Tempo equipe</TableHead>
                      <TableHead className={listingTableHeadClassName}>Tempo terceiros</TableHead>
                      <TableHead className={listingTableHeadClassName}>No prazo</TableHead>
                      <TableHead className={listingTableHeadClassName}>Em aberto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Atrasadas</TableHead>
                      <TableHead className={listingTableHeadClassName}>Parado há</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaGargalo.map((linha: any) => {
                      const atrasadas = toNumber(linha.atrasadas);

                      return (
                        <TableRow key={linha.etapa_id}>
                          <TableCell className={listingTableCellClassName}>
                            <div className="space-y-0.5">
                              <p className="font-medium text-slate-900">
                                {linha.ordem}. {linha.etapa_nome}
                              </p>
                              <p className="text-xs text-slate-400">
                                {linha.fluxo_nome}
                                {linha.setor ? ` · ${linha.setor}` : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {linha.prazo_dias === null ? '—' : `${linha.prazo_dias} d`}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.concluidas)}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <span
                              className={cn(
                                'font-semibold',
                                toOptionalNumber(linha.dias_equipe) !== null &&
                                  linha.prazo_dias !== null &&
                                  toNumber(linha.dias_equipe) > toNumber(linha.prazo_dias)
                                  ? 'text-rose-700'
                                  : 'text-slate-700',
                              )}
                            >
                              {formatDias(linha.dias_equipe)}
                            </span>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {formatDias(linha.dias_terceiros)}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <Percentual parte={linha.no_prazo} total={linha.com_prazo} />
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="flex items-center gap-1.5">
                              <span>{toNumber(linha.em_aberto)}</span>
                              {toNumber(linha.travadas_terceiros) > 0 ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  {toNumber(linha.travadas_terceiros)} travadas
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {atrasadas > 0 ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                {atrasadas}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {formatDias(linha.dias_parado_agora)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="carga" className="mt-4 space-y-4">
          <ListingFilterCard>
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className={`${listingFilterFieldClassName} max-w-xs`}>
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {setorOptions.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ListingFilterCard>

          <ListingTableCard>
            {loadingCarga ? (
              <div className="p-8 text-center text-sm text-slate-500">Calculando...</div>
            ) : listaCarga.length === 0 ? (
              <ListingEmptyState
                icon={Users}
                title="Nenhuma tarefa aberta"
                description="Não há etapa nem competência em aberto neste recorte."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                      <TableHead className={listingTableHeadClassName}>Total aberto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Etapas</TableHead>
                      <TableHead className={listingTableHeadClassName}>Obrigações</TableHead>
                      <TableHead className={listingTableHeadClassName}>Atrasadas</TableHead>
                      <TableHead className={listingTableHeadClassName}>Próx. 7 dias</TableHead>
                      <TableHead className={listingTableHeadClassName}>Aguardando</TableHead>
                      <TableHead className={listingTableHeadClassName}>Pior atraso</TableHead>
                      <TableHead className={listingTableHeadClassName}>Clientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaCarga.map((linha: any) => {
                      const atrasadas = toNumber(linha.atrasadas);
                      const pior = toOptionalNumber(linha.pior_atraso);

                      return (
                        <TableRow key={linha.responsavel_user_id ?? 'sem-responsavel'}>
                          <TableCell className={listingTableCellClassName}>
                            <span
                              className={cn(
                                'font-medium',
                                linha.responsavel_user_id ? 'text-slate-900' : 'text-rose-600',
                              )}
                            >
                              {linha.responsavel_nome}
                            </span>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.total)}</TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.etapas)}</TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.obrigacoes)}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {atrasadas > 0 ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                {atrasadas}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.proximos_7)}</TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.aguardando)}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            {pior !== null && pior > 0 ? `${pior} d` : '—'}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{toNumber(linha.clientes)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="obrigacoes" className="mt-4 space-y-4">
          <ListingFilterCard>
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <Select value={obrigacaoFilter} onValueChange={setObrigacaoFilter}>
                <SelectTrigger className={listingFilterFieldClassName}>
                  <SelectValue placeholder="Obrigação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as obrigações</SelectItem>
                  {(Array.isArray(catalogo) ? catalogo : []).map((obrigacao: any) => (
                    <SelectItem key={obrigacao.id} value={String(obrigacao.id)}>
                      {obrigacao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger className={listingFilterFieldClassName}>
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setorOptions.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </ListingFilterCard>

          <ListingTableCard>
            {loadingObrigacoes ? (
              <div className="p-8 text-center text-sm text-slate-500">Calculando...</div>
            ) : listaObrigacoes.length === 0 ? (
              <ListingEmptyState
                icon={PieChart}
                title="Sem competências geradas"
                description="Vincule obrigações aos clientes em Operação > Obrigações do Cliente."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Competência</TableHead>
                      <TableHead className={listingTableHeadClassName}>Total</TableHead>
                      <TableHead className={listingTableHeadClassName}>No prazo</TableHead>
                      <TableHead className={listingTableHeadClassName}>Com atraso</TableHead>
                      <TableHead className={listingTableHeadClassName}>% no prazo</TableHead>
                      <TableHead className={listingTableHeadClassName}>Em aberto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Vencidas</TableHead>
                      <TableHead className={listingTableHeadClassName}>Atraso médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaObrigacoes.map((linha: any) => (
                      <TableRow key={linha.competencia}>
                        <TableCell className={listingTableCellClassName}>
                          <span className="font-medium text-slate-900">{linha.competencia}</span>
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>{toNumber(linha.total)}</TableCell>
                        <TableCell className={listingTableCellClassName}>{toNumber(linha.no_prazo)}</TableCell>
                        <TableCell className={listingTableCellClassName}>{toNumber(linha.com_atraso)}</TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <Percentual
                            parte={linha.no_prazo}
                            total={toNumber(linha.no_prazo) + toNumber(linha.com_atraso)}
                          />
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>{toNumber(linha.em_aberto)}</TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {toNumber(linha.vencidas) > 0 ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                              {toNumber(linha.vencidas)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {formatDias(linha.dias_atraso_medio)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="aguardando" className="mt-4">
          <ListingTableCard>
            {loadingAguardando ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
            ) : listaAguardando.length === 0 ? (
              <ListingEmptyState
                icon={PauseCircle}
                title="Nada travado com terceiros"
                description="Nenhuma etapa ou competência está aguardando cliente ou órgão neste momento."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={listingTableHeadClassName}>Cliente</TableHead>
                      <TableHead className={listingTableHeadClassName}>Tarefa</TableHead>
                      <TableHead className={listingTableHeadClassName}>Aguardando</TableHead>
                      <TableHead className={listingTableHeadClassName}>O que falta</TableHead>
                      <TableHead className={listingTableHeadClassName}>Parado há</TableHead>
                      <TableHead className={listingTableHeadClassName}>Prazo</TableHead>
                      <TableHead className={listingTableHeadClassName}>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaAguardando.map((linha: any) => (
                      <TableRow key={`${linha.origem}-${linha.referencia_id}`}>
                        <TableCell className={listingTableCellClassName}>
                          <span className="font-medium text-slate-900">{linha.cliente_nome || '-'}</span>
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <div className="space-y-0.5">
                            <p>{linha.titulo}</p>
                            <p className="text-xs text-slate-400">
                              {linha.contexto}
                              {linha.setor ? ` · ${linha.setor}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <OperacaoStatusBadge status={linha.status} />
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {linha.aguardando_motivo || <span className="text-slate-400">Não informado</span>}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <span
                            className={cn(
                              'font-semibold',
                              toNumber(linha.dias_no_status) > 15 ? 'text-rose-700' : 'text-slate-700',
                            )}
                          >
                            {toNumber(linha.dias_no_status)} dias
                          </span>
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {formatDateForDisplay(linha.data_limite)}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>{linha.responsavel_nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListingTableCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
