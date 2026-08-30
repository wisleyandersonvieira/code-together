-- Ícone por coluna do Kanban.
--
-- Idempotente: pode rodar de novo sem efeito.
--
-- NULL é o default de propósito — nenhuma coluna existente muda de aparência
-- sem alguém escolher um ícone.

ALTER TABLE kanban_columns
  ADD COLUMN IF NOT EXISTS icon VARCHAR(64);

COMMENT ON COLUMN kanban_columns.icon IS
  'Nome do ícone lucide-react (ex.: "Hammer"). NULL = ícone padrão. Resolvido por um mapa
   fechado no cliente (lib/kanbanIcons.ts) — nomes fora do mapa caem no padrão.';
