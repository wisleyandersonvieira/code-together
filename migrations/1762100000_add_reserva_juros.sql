-- Modelagem Financeira — reserva de juros.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O saldo da reserva mês a mês é DERIVADO pelo motor e nunca gravado.
--
-- Numa pro forma, a reserva de juros é sacada do próprio empréstimo e paga os
-- juros até acabar; a partir daí a linha vira "interest after reserve" e passa a
-- sair do caixa. `capitalizar_juros` fazia algo parecido — juro virando principal
-- — mas sem saldo, sem o momento em que a reserva acaba e sem separar juro pago
-- pela reserva de juro pago pelo caixa.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Com
-- reserva_juros = 0 não há saldo para absorver juro nenhum, e cada mês cai
-- exatamente no caminho de hoje.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS reserva_juros DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserva_juros_sacada BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN modelagem_financiamento.reserva_juros IS
  'Valor da reserva de juros. Os juros incorridos são pagos por ela até zerar; o '
  'excedente volta a sair do caixa. DEFAULT 0 para que toda modelagem anterior a '
  'esta migration continue produzindo o mesmo ModelOutput — sem saldo, não há o '
  'que absorver. A reserva NÃO substitui capitalizar_juros: os dois coexistem, e '
  'a ordem é reserva primeiro, capitalização depois (ver o passo 2 de `passe` em '
  'lib/modelagem/motor.ts).';

COMMENT ON COLUMN modelagem_financiamento.reserva_juros_sacada IS
  'TRUE (default): a reserva é constituída no PRIMEIRO SAQUE e sacada do próprio '
  'empréstimo — soma ao principal, rende juros como qualquer principal, e não '
  'passa pelo caixa do projeto (o dinheiro vai direto para a conta da reserva). '
  'FALSE: a reserva é bancada pelo equity e é apenas ORÇAMENTÁRIA — não aumenta a '
  'dívida nem gera chamada de capital própria; o efeito é que os juros deixam de '
  'sair do caixa enquanto ela durar, e o equity acaba sendo chamado mais tarde. '
  'Sem efeito quando reserva_juros = 0.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- modelagem_financiamento já nasceu com RLS habilitado e sem policy na
-- 1760800000, e não há tabela nova aqui. Reafirmado por ser idempotente e para
-- que a migration continue correta se for aplicada fora de ordem.
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
