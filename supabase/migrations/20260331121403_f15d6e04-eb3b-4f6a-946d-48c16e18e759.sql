
-- Tabela principal de bloqueios de períodos
CREATE TABLE public.periodos_bloqueados (
  id SERIAL PRIMARY KEY,
  referencia_mes DATE NOT NULL, -- primeiro dia do mês (ex: 2026-03-01)
  bloqueia_competencia BOOLEAN NOT NULL DEFAULT false,
  bloqueia_pagamento BOOLEAN NOT NULL DEFAULT false,
  aplica_todas_matrizes BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de vínculo com matrizes específicas
CREATE TABLE public.periodos_bloqueados_matrizes (
  id SERIAL PRIMARY KEY,
  periodo_bloqueado_id INTEGER NOT NULL REFERENCES public.periodos_bloqueados(id) ON DELETE CASCADE,
  matriz_id INTEGER NOT NULL REFERENCES public.matrizes(id) ON DELETE CASCADE,
  UNIQUE(periodo_bloqueado_id, matriz_id)
);

-- Índices
CREATE INDEX idx_periodos_bloqueados_mes ON public.periodos_bloqueados(referencia_mes);
CREATE INDEX idx_periodos_bloqueados_status ON public.periodos_bloqueados(status);
CREATE INDEX idx_periodos_bloqueados_matrizes_periodo ON public.periodos_bloqueados_matrizes(periodo_bloqueado_id);
CREATE INDEX idx_periodos_bloqueados_matrizes_matriz ON public.periodos_bloqueados_matrizes(matriz_id);

-- Trigger para updated_at
CREATE TRIGGER set_periodos_bloqueados_updated_at
  BEFORE UPDATE ON public.periodos_bloqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.periodos_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_bloqueados_matrizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read periodos_bloqueados"
  ON public.periodos_bloqueados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert periodos_bloqueados"
  ON public.periodos_bloqueados FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update periodos_bloqueados"
  ON public.periodos_bloqueados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete periodos_bloqueados"
  ON public.periodos_bloqueados FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read periodos_bloqueados_matrizes"
  ON public.periodos_bloqueados_matrizes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert periodos_bloqueados_matrizes"
  ON public.periodos_bloqueados_matrizes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete periodos_bloqueados_matrizes"
  ON public.periodos_bloqueados_matrizes FOR DELETE TO authenticated USING (true);
