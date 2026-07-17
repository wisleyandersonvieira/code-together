'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  id: number;
  nome: string;
}

interface MultiSelectIdFilterProps {
  /** Texto exibido no gatilho quando nada está selecionado. */
  placeholder: string;
  options: MultiSelectOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  disabled?: boolean;
  /** Mensagem do tooltip nativo — usada principalmente quando desabilitado. */
  title?: string;
  className?: string;
}

/**
 * Seleção múltipla por checkbox (Popover + Command + Checkbox) sobre opções
 * identificadas por id numérico. Mesmo padrão visual do MultiSelectFilter de
 * AportesPorCliente, porém trabalhando com ids em vez de strings.
 */
export function MultiSelectIdFilter({
  placeholder,
  options,
  selected,
  onChange,
  disabled = false,
  title,
  className,
}: MultiSelectIdFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? options.filter((option) => option.nome.toLowerCase().includes(term)) : options;
  }, [options, search]);

  const visibleIds = useMemo(() => visibleOptions.map((option) => option.id), [visibleOptions]);
  const selectedVisibleCount = visibleIds.filter((id) => selected.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const handleToggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const handleToggleAll = () => {
    onChange(
      allVisibleSelected
        ? selected.filter((item) => !visibleIds.includes(item))
        : Array.from(new Set([...selected, ...visibleIds])),
    );
  };

  // Rótulo do gatilho: nome quando há 1 selecionado, contagem quando há vários.
  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((option) => option.id === selected[0])?.nome ?? placeholder;
    }
    return `${selected.length} selecionadas`;
  }, [selected, options, placeholder]);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          title={title}
          className={cn(
            'h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-4 text-sm font-normal text-slate-700 shadow-sm',
            selected.length === 0 && 'text-slate-500',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar..." value={search} onValueChange={setSearch} />
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
                    <CommandItem
                      key={option.id}
                      value={String(option.id)}
                      onSelect={() => handleToggle(option.id)}
                    >
                      <Checkbox checked={selected.includes(option.id)} className="mr-2" />
                      <span className="truncate">{option.nome}</span>
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
