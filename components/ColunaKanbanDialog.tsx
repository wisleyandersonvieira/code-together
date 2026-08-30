'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ICONES_KANBAN,
  ICONE_PADRAO,
  ROTULOS_ICONES,
  buscarIcones,
  iconeDaColuna,
  type NomeIconeKanban,
} from '@/lib/kanbanIcons';

export interface ValoresColuna {
  name: string;
  color: string;
  /** NULL = sem ícone; a coluna cai no ícone padrão. */
  icon: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: 'criar' | 'editar';
  /** Só é lido quando o dialog abre. */
  valorInicial?: ValoresColuna;
  onSalvar: (valores: ValoresColuna) => Promise<void>;
}

const COR_PADRAO = '#4F46E5';

/** Atalhos de cor para não obrigar ninguém a abrir o seletor do sistema. */
const CORES_PREDEFINIDAS = [
  '#4F46E5', // indigo
  '#2563EB', // azul
  '#0891B2', // ciano
  '#059669', // verde
  '#CA8A04', // âmbar
  '#EA580C', // laranja
  '#DC2626', // vermelho
  '#6B7280', // cinza
];

/** Acima disto a grade fica difícil de varrer no olho — entra a busca. */
const LIMITE_PARA_BUSCA = 24;

const TOTAL_ICONES = Object.keys(ICONES_KANBAN).length;

export function ColunaKanbanDialog({ open, onOpenChange, modo, valorInicial, onSalvar }: Props) {
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(COR_PADRAO);
  const [icone, setIcone] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  // O formulário é semeado na abertura, não a cada render: enquanto o dialog
  // está aberto, quem manda é o que a pessoa digitou.
  useEffect(() => {
    if (!open) return;
    setNome(valorInicial?.name ?? '');
    setCor(valorInicial?.color || COR_PADRAO);
    setIcone(valorInicial?.icon ?? null);
    setBusca('');
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nomeValido = nome.trim().length > 0;
  const visiveis = buscarIcones(busca);
  const IconePrevia = iconeDaColuna(icone);

  const salvar = async () => {
    if (!nomeValido || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({ name: nome.trim(), color: cor, icon: icone });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{modo === 'criar' ? 'Nova coluna' : 'Editar coluna'}</DialogTitle>
          <DialogDescription>
            O ícone e a cor aparecem no quadro e no Dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* Prévia ao vivo — mesma composição do Dashboard, para ninguém salvar
            e só então descobrir que ficou ilegível. */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${cor}1F` }}
          >
            <IconePrevia className="h-4 w-4" style={{ color: cor }} />
          </span>
          <span className="truncate text-sm font-medium">
            {nome.trim() || 'Nome da coluna'}
          </span>
          {icone === null && (
            <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">ícone padrão</span>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coluna-nome">Nome</Label>
            <Input
              id="coluna-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Fundação"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coluna-cor">Cor</Label>
            <div className="flex items-center gap-2">
              <Input
                id="coluna-cor"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-10 w-14 flex-shrink-0 p-1"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {CORES_PREDEFINIDAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    aria-label={`Usar a cor ${c}`}
                    aria-pressed={cor.toLowerCase() === c.toLowerCase()}
                    className={cn(
                      'h-6 w-6 rounded-full border border-border transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      cor.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ring ring-offset-2',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <span className="ml-auto font-mono text-xs uppercase text-muted-foreground">{cor}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>

            {TOTAL_ICONES > LIMITE_PARA_BUSCA && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar ícone (ex.: obra, chaves, prazo)"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}

            <div className="max-h-[188px] overflow-y-auto rounded-lg border border-border p-2">
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  onClick={() => setIcone(null)}
                  title="Sem ícone — usa o padrão"
                  aria-label="Sem ícone"
                  aria-pressed={icone === null}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md border border-border text-muted-foreground transition',
                    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    icone === null && 'ring-2 ring-ring',
                  )}
                >
                  <ICONE_PADRAO className="h-4 w-4" />
                </button>

                {visiveis.map((nomeIcone) => {
                  const Icone = ICONES_KANBAN[nomeIcone as NomeIconeKanban];
                  const ativo = icone === nomeIcone;
                  return (
                    <button
                      key={nomeIcone}
                      type="button"
                      onClick={() => setIcone(nomeIcone)}
                      title={`${ROTULOS_ICONES[nomeIcone]} (${nomeIcone})`}
                      aria-label={ROTULOS_ICONES[nomeIcone]}
                      aria-pressed={ativo}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-md border border-border transition',
                        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        ativo && 'ring-2 ring-ring',
                      )}
                      style={ativo ? { color: cor } : undefined}
                    >
                      <Icone className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>

              {visiveis.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Nenhum ícone com “{busca}”.
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {icone === null
                ? 'Sem ícone: a coluna usa o marcador padrão.'
                : `${ROTULOS_ICONES[icone as NomeIconeKanban] ?? icone} · ${icone}`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!nomeValido || salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {modo === 'criar' ? 'Criar coluna' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
