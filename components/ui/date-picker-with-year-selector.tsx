'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DatePickerWithYearSelectorProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

export function DatePickerWithYearSelector({ 
  date, 
  onDateChange, 
  placeholder = 'Selecionar data', 
  disabled,
  triggerClassName,
}: DatePickerWithYearSelectorProps) {
  const safeDate = date && !isNaN(date.getTime()) ? date : undefined;
  const [month, setMonth] = React.useState<Date>(safeDate || new Date());
  const [showYearSelector, setShowYearSelector] = React.useState(false);
  const [showMonthSelector, setShowMonthSelector] = React.useState(false);

  // Gerar lista de anos (10 anos para trás e 5 anos para frente)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => currentYear - 10 + i);
  
  // Lista de meses em português
  const months = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' },
  ];

  const handleYearChange = (year: string) => {
    const newDate = new Date(month);
    newDate.setFullYear(parseInt(year));
    setMonth(newDate);
    setShowYearSelector(false);
  };

  const handleMonthChange = (monthValue: string) => {
    const newDate = new Date(month);
    newDate.setMonth(parseInt(monthValue));
    setMonth(newDate);
    setShowMonthSelector(false);
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(month);
    newDate.setMonth(newDate.getMonth() - 1);
    setMonth(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(month);
    newDate.setMonth(newDate.getMonth() + 1);
    setMonth(newDate);
  };

  React.useEffect(() => {
    if (date && !isNaN(date.getTime())) {
      setMonth(date);
    }
  }, [date]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'h-11 w-full justify-start rounded-xl border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-slate-200/60',
            !safeDate && 'text-muted-foreground',
            triggerClassName,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {safeDate ? format(safeDate, 'dd/MM/yyyy', { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-[24px] border border-slate-200 bg-white p-0 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.32)]" align="start">
        <div className="p-3">
          {/* Cabeçalho customizado com navegação */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-8 w-8 rounded-lg border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              {/* Seletor de mês */}
              {showMonthSelector ? (
                <Select
                  value={month.getMonth().toString()}
                  onValueChange={handleMonthChange}
                  open={showMonthSelector}
                  onOpenChange={setShowMonthSelector}
                >
                  <SelectTrigger className="h-8 w-[118px] rounded-lg border-slate-200 bg-white text-xs text-slate-700 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMonthSelector(true)}
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                >
                  {format(month, 'MMMM', { locale: ptBR })}
                </Button>
              )}

              {/* Seletor de ano */}
              {showYearSelector ? (
                <Select
                  value={month.getFullYear().toString()}
                  onValueChange={handleYearChange}
                  open={showYearSelector}
                  onOpenChange={setShowYearSelector}
                >
                  <SelectTrigger className="h-8 w-[78px] rounded-lg border-slate-200 bg-white text-xs text-slate-700 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowYearSelector(true)}
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                >
                  {month.getFullYear()}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8 rounded-lg border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendário */}
          <Calendar
            mode="single"
            selected={safeDate}
            onSelect={onDateChange}
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            className="w-fit"
            classNames={{
              nav: "hidden", // Esconder navegação padrão
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
