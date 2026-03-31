'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Calendar, Filter, Lock, Unlock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Bloqueio {
  id: number;
  referencia_mes: string;
  bloqueia_competencia: boolean;
  bloqueia_pagamento: boolean;
  aplica_todas_matrizes: boolean;
  status: string;
  created_at: string;
  matrizes?: { id: number; nome: string }[];
}

interface Matriz {
  id: number;
  nome: string;
}

const meses = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function PeriodosBloqueados() {
  const { toast } = useToast();
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBloqueio, setEditingBloqueio] = useState<Bloqueio | null>(null);

  // Form state
  const [formMes, setFormMes] = useState('');
  const [formAno, setFormAno] = useState(new Date().getFullYear().toString());
  const [formBloqueiaCompetencia, setFormBloqueiaCompetencia] = useState(false);
  const [formBloqueiaPagamento, setFormBloqueiaPagamento] = useState(false);
  const [formAplicaTodasMatrizes, setFormAplicaTodasMatrizes] = useState(false);
  const [formMatrizesSelecionadas, setFormMatrizesSelecionadas] = useState<number[]>([]);

  // Filters
  const [filtroMatriz, setFiltroMatriz] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');

  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 10 }, (_, i) => (currentYear - 3 + i).toString());

  const loadMatrizes = useCallback(async () => {
    const { data } = await supabase.from('matrizes').select('id, nome').order('nome');
    if (data) setMatrizes(data as any);
  }, []);

  const loadBloqueios = useCallback(async () => {
    setLoading(true);
    const { data: bloqueiosData, error } = await supabase
      .from('periodos_bloqueados' as any)
      .select('*')
      .order('referencia_mes', { ascending: false });

    if (error) {
      console.error('Error loading bloqueios:', error);
      setLoading(false);
      return;
    }

    // Load matrizes for each bloqueio
    const bloqueiosComMatrizes: Bloqueio[] = [];
    for (const b of (bloqueiosData || []) as any[]) {
      let matrizesVinculadas: { id: number; nome: string }[] = [];
      if (!b.aplica_todas_matrizes) {
        const { data: vinculos } = await supabase
          .from('periodos_bloqueados_matrizes' as any)
          .select('matriz_id')
          .eq('periodo_bloqueado_id', b.id);

        if (vinculos && vinculos.length > 0) {
          const matrizIds = (vinculos as any[]).map((v: any) => v.matriz_id);
          matrizesVinculadas = matrizes.filter((m) => matrizIds.includes(m.id));
        }
      }
      bloqueiosComMatrizes.push({ ...b, matrizes: matrizesVinculadas });
    }

    setBloqueios(bloqueiosComMatrizes);
    setLoading(false);
  }, [matrizes]);

  useEffect(() => {
    loadMatrizes();
  }, [loadMatrizes]);

  useEffect(() => {
    if (matrizes.length > 0) {
      loadBloqueios();
    }
  }, [matrizes, loadBloqueios]);

  const resetForm = () => {
    setFormMes('');
    setFormAno(currentYear.toString());
    setFormBloqueiaCompetencia(false);
    setFormBloqueiaPagamento(false);
    setFormAplicaTodasMatrizes(false);
    setFormMatrizesSelecionadas([]);
    setEditingBloqueio(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (bloqueio: Bloqueio) => {
    const date = new Date(bloqueio.referencia_mes + 'T00:00:00');
    setFormMes((date.getMonth() + 1).toString().padStart(2, '0'));
    setFormAno(date.getFullYear().toString());
    setFormBloqueiaCompetencia(bloqueio.bloqueia_competencia);
    setFormBloqueiaPagamento(bloqueio.bloqueia_pagamento);
    setFormAplicaTodasMatrizes(bloqueio.aplica_todas_matrizes);
    setFormMatrizesSelecionadas(bloqueio.matrizes?.map((m) => m.id) || []);
    setEditingBloqueio(bloqueio);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formMes || !formAno) {
      toast({ title: 'Erro', description: 'Selecione o mês e o ano.', variant: 'destructive' });
      return;
    }
    if (!formBloqueiaCompetencia && !formBloqueiaPagamento) {
      toast({ title: 'Erro', description: 'Selecione pelo menos um tipo de bloqueio.', variant: 'destructive' });
      return;
    }
    if (!formAplicaTodasMatrizes && formMatrizesSelecionadas.length === 0) {
      toast({ title: 'Erro', description: 'Selecione pelo menos uma matriz ou marque "Todas as matrizes".', variant: 'destructive' });
      return;
    }

    const referenciaMes = `${formAno}-${formMes}-01`;

    // Check for duplicates (only when creating new)
    if (!editingBloqueio) {
      const { data: existentes } = await supabase
        .from('periodos_bloqueados' as any)
        .select('id, bloqueia_competencia, bloqueia_pagamento, aplica_todas_matrizes')
        .eq('referencia_mes', referenciaMes)
        .eq('status', 'ativo');

      if (existentes && existentes.length > 0) {
        for (const ex of existentes as any[]) {
          // Check if exact same config already exists
          if (ex.bloqueia_competencia === formBloqueiaCompetencia && ex.bloqueia_pagamento === formBloqueiaPagamento) {
            if (ex.aplica_todas_matrizes && formAplicaTodasMatrizes) {
              toast({ title: 'Duplicidade', description: 'Já existe um bloqueio idêntico para este mês.', variant: 'destructive' });
              return;
            }
          }
        }
      }
    }

    try {
      if (editingBloqueio) {
        // Update
        const { error } = await supabase
          .from('periodos_bloqueados' as any)
          .update({
            referencia_mes: referenciaMes,
            bloqueia_competencia: formBloqueiaCompetencia,
            bloqueia_pagamento: formBloqueiaPagamento,
            aplica_todas_matrizes: formAplicaTodasMatrizes,
          } as any)
          .eq('id', editingBloqueio.id);

        if (error) throw error;

        // Delete old matrix bindings
        await supabase
          .from('periodos_bloqueados_matrizes' as any)
          .delete()
          .eq('periodo_bloqueado_id', editingBloqueio.id);

        // Insert new matrix bindings
        if (!formAplicaTodasMatrizes) {
          for (const matrizId of formMatrizesSelecionadas) {
            await supabase
              .from('periodos_bloqueados_matrizes' as any)
              .insert({ periodo_bloqueado_id: editingBloqueio.id, matriz_id: matrizId } as any);
          }
        }

        toast({ title: 'Sucesso', description: 'Bloqueio atualizado com sucesso.' });
      } else {
        // Create
        const { data: newBloqueio, error } = await supabase
          .from('periodos_bloqueados' as any)
          .insert({
            referencia_mes: referenciaMes,
            bloqueia_competencia: formBloqueiaCompetencia,
            bloqueia_pagamento: formBloqueiaPagamento,
            aplica_todas_matrizes: formAplicaTodasMatrizes,
          } as any)
          .select('id')
          .single();

        if (error) throw error;

        // Insert matrix bindings
        if (!formAplicaTodasMatrizes && newBloqueio) {
          for (const matrizId of formMatrizesSelecionadas) {
            await supabase
              .from('periodos_bloqueados_matrizes' as any)
              .insert({ periodo_bloqueado_id: (newBloqueio as any).id, matriz_id: matrizId } as any);
          }
        }

        toast({ title: 'Sucesso', description: 'Bloqueio criado com sucesso.' });
      }

      setShowForm(false);
      resetForm();
      await loadBloqueios();
    } catch (error: any) {
      console.error('Error saving bloqueio:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar bloqueio.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await supabase.from('periodos_bloqueados_matrizes' as any).delete().eq('periodo_bloqueado_id', id);
      await supabase.from('periodos_bloqueados' as any).delete().eq('id', id);
      toast({ title: 'Sucesso', description: 'Bloqueio excluído com sucesso.' });
      await loadBloqueios();
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao excluir bloqueio.', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (bloqueio: Bloqueio) => {
    const newStatus = bloqueio.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await supabase
        .from('periodos_bloqueados' as any)
        .update({ status: newStatus } as any)
        .eq('id', bloqueio.id);
      toast({ title: 'Sucesso', description: `Bloqueio ${newStatus === 'ativo' ? 'ativado' : 'desativado'}.` });
      await loadBloqueios();
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao alterar status.', variant: 'destructive' });
    }
  };

  const toggleMatriz = (matrizId: number) => {
    setFormMatrizesSelecionadas((prev) =>
      prev.includes(matrizId) ? prev.filter((id) => id !== matrizId) : [...prev, matrizId]
    );
  };

  const formatMesAno = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${month}/${d.getFullYear()}`;
  };

  // Apply filters
  const filteredBloqueios = bloqueios.filter((b) => {
    if (filtroStatus && b.status !== filtroStatus) return false;
    if (filtroMes) {
      const d = new Date(b.referencia_mes + 'T00:00:00');
      const monthKey = (d.getMonth() + 1).toString().padStart(2, '0');
      if (monthKey !== filtroMes) return false;
    }
    if (filtroTipo) {
      if (filtroTipo === 'competencia' && !b.bloqueia_competencia) return false;
      if (filtroTipo === 'pagamento' && !b.bloqueia_pagamento) return false;
      if (filtroTipo === 'ambos' && (!b.bloqueia_competencia || !b.bloqueia_pagamento)) return false;
    }
    if (filtroMatriz) {
      const matrizId = parseInt(filtroMatriz);
      if (!b.aplica_todas_matrizes && !b.matrizes?.some((m) => m.id === matrizId)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Controle de Períodos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie bloqueios mensais para competência e pagamento
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Bloqueio
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={filtroMatriz} onValueChange={setFiltroMatriz}>
              <SelectTrigger>
                <SelectValue placeholder="Matriz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {matrizes.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger>
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {meses.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Bloqueio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="competencia">Competência</SelectItem>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Matrizes</TableHead>
                <TableHead className="text-center">Competência</TableHead>
                <TableHead className="text-center">Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredBloqueios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum bloqueio encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBloqueios.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatMesAno(b.referencia_mes)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.aplica_todas_matrizes ? (
                        <Badge variant="secondary">Todas</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {b.matrizes?.map((m) => (
                            <Badge key={m.id} variant="outline" className="text-xs">
                              {m.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {b.bloqueia_competencia ? (
                        <Lock className="h-4 w-4 text-red-500 mx-auto" />
                      ) : (
                        <Unlock className="h-4 w-4 text-green-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {b.bloqueia_pagamento ? (
                        <Lock className="h-4 w-4 text-red-500 mx-auto" />
                      ) : (
                        <Unlock className="h-4 w-4 text-green-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'ativo' ? 'default' : 'secondary'}>
                        {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(b)} title={b.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                          {b.status === 'ativo' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir bloqueio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O bloqueio de {formatMesAno(b.referencia_mes)} será removido.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(b.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBloqueio ? 'Editar Bloqueio' : 'Novo Bloqueio de Período'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Month/Year */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-600">Mês *</Label>
                <Select value={formMes} onValueChange={setFormMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-600">Ano *</Label>
                <Select value={formAno} onValueChange={setFormAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Block types */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-600">Tipo de Bloqueio *</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bloqueia_competencia"
                    checked={formBloqueiaCompetencia}
                    onCheckedChange={(checked) => setFormBloqueiaCompetencia(checked === true)}
                  />
                  <Label htmlFor="bloqueia_competencia" className="text-sm cursor-pointer">
                    Data de Competência
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bloqueia_pagamento"
                    checked={formBloqueiaPagamento}
                    onCheckedChange={(checked) => setFormBloqueiaPagamento(checked === true)}
                  />
                  <Label htmlFor="bloqueia_pagamento" className="text-sm cursor-pointer">
                    Data de Pagamento
                  </Label>
                </div>
              </div>
            </div>

            {/* Matrizes */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-600">Matrizes *</Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  id="todas_matrizes"
                  checked={formAplicaTodasMatrizes}
                  onCheckedChange={setFormAplicaTodasMatrizes}
                />
                <Label htmlFor="todas_matrizes" className="text-sm cursor-pointer">
                  Aplicar a todas as matrizes
                </Label>
              </div>
              {!formAplicaTodasMatrizes && (
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {matrizes.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`matriz-${m.id}`}
                        checked={formMatrizesSelecionadas.includes(m.id)}
                        onCheckedChange={() => toggleMatriz(m.id)}
                      />
                      <Label htmlFor={`matriz-${m.id}`} className="text-sm cursor-pointer">
                        {m.nome}
                      </Label>
                    </div>
                  ))}
                  {matrizes.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma matriz cadastrada.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingBloqueio ? 'Salvar Alterações' : 'Criar Bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
