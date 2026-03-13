'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface YearMonthDayPickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

const months = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
];

export function YearMonthDayPicker({ 
  date, 
  onDateChange, 
  placeholder = 'Selecionar data', 
  disabled 
}: YearMonthDayPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState<string>('');
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [calendarDate, setCalendarDate] = React.useState<Date | undefined>(undefined);

  // Initialize values when date prop changes
  React.useEffect(() => {
    if (date) {
      setSelectedYear(date.getFullYear().toString());
      setSelectedMonth(date.getMonth().toString());
      setCalendarDate(new Date(date.getFullYear(), date.getMonth(), 1));
    } else {
      setSelectedYear('');
      setSelectedMonth('');
      setCalendarDate(undefined);
    }
  }, [date]);

  // Generate years from 1900 to current year + 10
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 11 }, (_, i) => ({
    value: (currentYear - i + 10).toString(),
    label: (currentYear - i + 10).toString(),
  })).reverse();

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth(''); // Reset month when year changes
    setCalendarDate(undefined);
  };

  const handleMonthSelect = (month: string) => {
    setSelectedMonth(month);
    if (selectedYear) {
      const newDate = new Date(parseInt(selectedYear), parseInt(month), 1);
      setCalendarDate(newDate);
    }
  };

  const handleDaySelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDateChange(selectedDate);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setSelectedYear('');
    setSelectedMonth('');
    setCalendarDate(undefined);
    onDateChange(undefined);
  };

  const canShowCalendar = selectedYear && selectedMonth;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-4" align="start">
        <div className="space-y-2">
          <label className="text-sm font-medium">1. Selecione o ano:</label>
          <Select value={selectedYear} onValueChange={handleYearSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year.value} value={year.value}>
                  {year.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedYear && (
          <div className="space-y-2">
            <label className="text-sm font-medium">2. Selecione o mês:</label>
            <Select value={selectedMonth} onValueChange={handleMonthSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {canShowCalendar && (
          <div className="space-y-2">
            <label className="text-sm font-medium">3. Selecione o dia:</label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDaySelect}
              month={calendarDate}
              locale={ptBR}
            />
          </div>
        )}

        {date && (
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleClear}>
              Limpar
            </Button>
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
