-- Role de privilégio mínimo usado pela edge function execute-sql.
--
-- Objetivo: mesmo que a guarda de statements da função seja burlada, o banco
-- ainda recusa qualquer DDL — este role só faz CRUD nas tabelas do schema
-- public. Nenhum privilégio de CREATE/DROP/ALTER/TRUNCATE é concedido.
--
-- ANTES DE APLICAR: troque <SENHA_FORTE_AQUI> por uma senha forte e guarde-a.
-- DEPOIS DE APLICAR: configure a secret APP_DB_URL da edge function com
--   postgresql://app_executor:<SENHA>@<host>:6543/postgres
-- (porta 6543 = pooler/Supavisor; a função não deve abrir conexão direta na 5432)

CREATE ROLE app_executor WITH
  LOGIN
  PASSWORD '<SENHA_FORTE_AQUI>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

-- Acesso ao schema, sem poder criar objetos nele
GRANT USAGE ON SCHEMA public TO app_executor;

-- CRUD nas tabelas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_executor;

-- Sequences (necessário para colunas SERIAL / nextval em INSERTs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_executor;

-- Mesmos privilégios para objetos criados no futuro (migrations rodam como
-- postgres; o app_executor recebe o acesso automaticamente).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_executor;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_executor;
