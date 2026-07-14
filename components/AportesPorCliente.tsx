'use client';

import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronDown, DollarSign, FileDown, FolderOpen, TrendingUp, Users, X } from 'lucide-react';
import loadAportesPorClienteAction from '@/actions/loadAportesPorCliente';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { exportAportesPorClientePDF } from '@/utils/aportes-por-cliente-export';
import { ListingPageHeader } from '@/components/finance/listing-ui';

interface AportePorCliente {
  membro_key: string;
  membro_nome: string;
  membro_tipo: 'cliente' | 'empresa' | 'grupo';
  projeto_id: number;
  projeto_nome: string;
  projeto_status: string | null;
  total_previsto: number | string;
  total_realizado: number | string;
}

interface ProjetoAgregado {
  nome: string;
  status: string | null;
  realizado: number;
  previsto: number;
}

interface MembroAgregado {
  membro_key: string;
  membro_nome: string;
  membro_tipo: 'cliente' | 'empresa' | 'grupo';
  total_previsto: number;
  total_realizado: number;
  projetos: ProjetoAgregado[];
}

const toNumber = (value: number | string | null | undefined) =>
  typeof value === 'number' ? value : parseFloat(value || '0') || 0;

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? options.filter((option) => option.toLowerCase().includes(term)) : options;
  }, [options, search]);

  const selectedVisibleCount = visibleOptions.filter((option) => selected.includes(option)).length;
  const allVisibleSelected = visibleOptions.length > 0 && selectedVisibleCount === visibleOptions.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const handleToggle = (option: string) => {
    onChange((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  const handleToggleAll = () => {
    onChange((prev) =>
      allVisibleSelected
        ? prev.filter((item) => !visibleOptions.includes(item))
        : Array.from(new Set([...prev, ...visibleOptions])),
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between sm:w-64">
          <span className="truncate">
            {label}
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {visibleOptions.length === 0 ? (
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            ) : (
              <>
                <CommandGroup className="border-b border-slate-100">
                  <CommandItem value="__select-all__" onSelect={handleToggleAll}>
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      className="mr-2"
                    />
                    <span className="font-medium">Selecionar todos</span>
                  </CommandItem>
                </CommandGroup>
                <CommandGroup>
                  {visibleOptions.map((option) => (
                    <CommandItem key={option} value={option} onSelect={() => handleToggle(option)}>
                      <Checkbox checked={selected.includes(option)} className="mr-2" />
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AportesPorCliente() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [aportes, loading, error] = useLoadAction(loadAportesPorClienteAction, []);

  const [selectedProjetos, setSelectedProjetos] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);

  const rows = useMemo(() => (aportes || []) as AportePorCliente[], [aportes]);

  const handleClearFilters = () => {
    setSelectedProjetos([]);
    setSelectedStatus([]);
    setSelectedMembros([]);
  };

  const projetoOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.projeto_nome).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.projeto_status).filter((s): s is string => Boolean(s)))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
    [rows],
  );

  const membroOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.membro_nome).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchProjeto = selectedProjetos.length === 0 || selectedProjetos.includes(row.projeto_nome);
        const matchStatus = selectedStatus.length === 0 || selectedStatus.includes(row.projeto_status || '');
        const matchMembro = selectedMembros.length === 0 || selectedMembros.includes(row.membro_nome);
        return matchProjeto && matchStatus && matchMembro;
      }),
    [rows, selectedProjetos, selectedStatus, selectedMembros],
  );

  const membrosAgregados = useMemo(() => {
    const map = new Map<string, MembroAgregado>();

    filteredRows.forEach((row) => {
      const membro = map.get(row.membro_key) ?? {
        membro_key: row.membro_key,
        membro_nome: row.membro_nome,
        membro_tipo: row.membro_tipo,
        total_previsto: 0,
        total_realizado: 0,
        projetos: [],
      };

      membro.total_previsto += toNumber(row.total_previsto);
      membro.total_realizado += toNumber(row.total_realizado);
      if (!membro.projetos.some((projeto) => projeto.nome === row.projeto_nome)) {
        membro.projetos.push({
          nome: row.projeto_nome,
          status: row.projeto_status,
          realizado: toNumber(row.total_realizado),
          previsto: toNumber(row.total_previsto),
        });
      }

      map.set(row.membro_key, membro);
    });

    return Array.from(map.values()).sort((a, b) => b.total_realizado - a.total_realizado);
  }, [filteredRows]);

  const totais = useMemo(() => {
    const totalRealizado = filteredRows.reduce((sum, row) => sum + toNumber(row.total_realizado), 0);
    const totalPrevisto = filteredRows.reduce((sum, row) => sum + toNumber(row.total_previsto), 0);
    const totalProjetos = new Set(filteredRows.map((row) => row.projeto_id)).size;

    return {
      totalRealizado,
      totalPrevisto,
      totalProjetos,
      totalMembros: membrosAgregados.length,
    };
  }, [filteredRows, membrosAgregados]);

  const hasFilters = selectedProjetos.length > 0 || selectedStatus.length > 0 || selectedMembros.length > 0;

  const buildFiltroLabel = (selecionados: string[]) => {
    if (selecionados.length === 0) return 'Todos';
    if (selecionados.length <= 3) return selecionados.join(', ');
    return `${selecionados.slice(0, 3).join(', ')} +${selecionados.length - 3}`;
  };

  const handleExportPDF = () => {
    if (membrosAgregados.length === 0) return;

    exportAportesPorClientePDF(
      membrosAgregados,
      {
        qtdClientes: totais.totalMembros,
        totalRealizado: totais.totalRealizado,
        totalPrevisto: totais.totalPrevisto,
        qtdProjetos: totais.totalProjetos,
      },
      {
        projetosLabel: buildFiltroLabel(selectedProjetos),
        statusLabel: buildFiltroLabel(selectedStatus),
        clientesLabel: buildFiltroLabel(selectedMembros),
      },
      { formatCurrency },
    );

    toast({
      title: 'Relatório exportado',
      description: 'O PDF de Aportes por Cliente foi gerado com sucesso.',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando aportes por cliente...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar aportes por cliente</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Aportes por Cliente"
        description="Valores previstos e aportados por cliente, empresa ou grupo."
      />

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <MultiSelectFilter
          label="Projetos"
          options={projetoOptions}
          selected={selectedProjetos}
          onChange={setSelectedProjetos}
        />
        <MultiSelectFilter
          label="Status"
          options={statusOptions}
          selected={selectedStatus}
          onChange={setSelectedStatus}
        />
        <MultiSelectFilter
          label="Clientes"
          options={membroOptions}
          selected={selectedMembros}
          onChange={setSelectedMembros}
        />
        {hasFilters ? (
          <Button variant="outline" onClick={handleClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
        ) : null}

        <Button
          variant="outline"
          onClick={handleExportPDF}
          disabled={loading || membrosAgregados.length === 0}
          className="sm:ml-auto"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium">Clientes selecionados</div>
            </div>
            <div className="text-xl font-bold text-blue-600">{totais.totalMembros}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium">Total de Aportes Realizados</div>
            </div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(totais.totalRealizado)}</div>
            <div className="text-xs text-muted-foreground">
              {totais.totalPrevisto > 0
                ? `${((totais.totalRealizado / totais.totalPrevisto) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium">Total de Aportes Previstos</div>
            </div>
            <div className="text-xl font-bold text-purple-600">{formatCurrency(totais.totalPrevisto)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-orange-600" />
              <div className="text-sm font-medium">Projetos selecionados</div>
            </div>
            <div className="text-xl font-bold text-orange-600">{totais.totalProjetos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cards por cliente/membro */}
      {membrosAgregados.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {hasFilters
                ? 'Nenhum cliente corresponde aos filtros aplicados.'
                : 'Nenhum aporte cadastrado.'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {membrosAgregados.map((membro) => (
            <Card key={membro.membro_key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="truncate">{membro.membro_nome}</span>
                  <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                    {membro.membro_tipo}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground">Valor Aportado (Realizado)</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(membro.total_realizado)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Valor Previsto</div>
                  <div className="text-lg font-semibold text-slate-800">{formatCurrency(membro.total_previsto)}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Projetos ({membro.projetos.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {membro.projetos.map((projeto) => (
                      <Badge key={projeto.nome} variant="outline" className="text-xs font-normal">
                        {projeto.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
