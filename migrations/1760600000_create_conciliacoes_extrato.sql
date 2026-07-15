-- Migration: tabela dedicada de CONCILIAÇÃO do extrato bancário.
--
-- Objetivo: permitir marcar cada lançamento do extrato como "conciliado"
-- (conferência visual contra o extrato do banco), de forma PERMANENTE e
-- persistente entre gerações do extrato.
--
-- Design (por que uma tabela à parte): NÃO alteramos as tabelas de lançamento
-- (titulos_pagar, titulos_receber, aportes, retiradas, emprestimos,
-- transferencias). A conciliação vive nesta tabela isolada, que apenas
-- REFERENCIA cada lançamento pelo par (origem, origem_id). Assim a conciliação
-- não afeta nenhum valor, saldo ou cálculo do extrato — é só uma camada de
-- conferência.
--
-- Chave de conciliação = (origem, origem_id):
--   origem                | origem_id           | bloco do UNION em loadExtrato
--   ----------------------+---------------------+------------------------------
--   titulo_pagar          | titulos_pagar.id    | Contas a Pagar (parcela paga)
--   titulo_receber        | titulos_receber.id  | Contas a Receber (parcela receb.)
--   transferencia_saida   | transferencias.id   | Transferência (débito na origem)
--   transferencia_entrada | transferencias.id   | Transferência (crédito no destino)
--   aporte                | aportes.id          | Aporte
--   retirada              | retiradas.id        | Retirada
--   emprestimo            | emprestimos.id      | Empréstimo (saída)
--   pagamento_emprestimo  | emprestimos.id      | Pagamento de empréstimo (entrada)
--
-- Obs.: a MESMA transferência aparece em duas contas (saída na conta de origem
-- e entrada na conta de destino). Por isso a origem carrega a direção
-- (transferencia_saida / transferencia_entrada): cada perna é conciliada de
-- forma independente, sem colidir na UNIQUE (origem, origem_id).
--
-- Idempotente: pode ser reaplicada sem efeito colateral.

CREATE TABLE IF NOT EXISTS conciliacoes_extrato (
  id             SERIAL PRIMARY KEY,
  origem         VARCHAR(40) NOT NULL,
  origem_id      INTEGER     NOT NULL,
  conta_id       INTEGER     NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  conciliado     BOOLEAN     NOT NULL DEFAULT true,
  conciliado_em  TIMESTAMP   DEFAULT NOW(),
  conciliado_por UUID,  -- id do usuário GoTrue (auth.users) que marcou; opcional
  CONSTRAINT uq_conciliacoes_extrato_origem UNIQUE (origem, origem_id)
);

CREATE INDEX IF NOT EXISTS idx_conciliacoes_extrato_conta
  ON conciliacoes_extrato (conta_id);

CREATE INDEX IF NOT EXISTS idx_conciliacoes_extrato_origem
  ON conciliacoes_extrato (origem, origem_id);

-- Postura de segurança (ver 1760200000_enable_rls_and_close_postgrest):
-- RLS ativo SEM policy = negado por padrão para anon/authenticated (fecha o
-- PostgREST). O app_executor tem BYPASSRLS e as DEFAULT PRIVILEGES já concedem
-- CRUD a ele automaticamente, então o app continua funcionando normalmente.
ALTER TABLE conciliacoes_extrato ENABLE ROW LEVEL SECURITY;
