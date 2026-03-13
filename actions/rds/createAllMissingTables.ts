import { action } from '@uibakery/data';

function createAllMissingTables() {
  return action('createAllMissingTables', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Create remaining tables that were missing
      CREATE TABLE IF NOT EXISTS contas_pagar (
        id SERIAL PRIMARY KEY,
        fornecedor_id INTEGER,
        tipo_documento_id INTEGER,
        numero_documento VARCHAR(100),
        data_emissao DATE,
        data_vencimento DATE,
        data_competencia DATE,
        observacoes TEXT,
        valor_total NUMERIC(15,2),
        status VARCHAR(50) DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        matriz_id INTEGER,
        entity_type VARCHAR(50),
        entity_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS contas_receber (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER,
        tipo_documento_id INTEGER,
        numero_documento VARCHAR(100),
        data_emissao DATE,
        data_vencimento DATE,
        data_competencia DATE,
        observacoes TEXT,
        valor_total NUMERIC(15,2),
        status VARCHAR(50) DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        matriz_id INTEGER,
        entity_type VARCHAR(50),
        entity_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS titulos_pagar (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER,
        parcela INTEGER,
        total_parcelas INTEGER,
        data_vencimento DATE,
        valor NUMERIC(15,2),
        valor_pago NUMERIC(15,2) DEFAULT 0,
        data_pagamento DATE,
        conta_id INTEGER,
        status VARCHAR(50) DEFAULT 'pendente',
        observacoes_pagamento TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS titulos_receber (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER,
        parcela INTEGER,
        total_parcelas INTEGER,
        data_vencimento DATE,
        valor NUMERIC(15,2),
        valor_recebido NUMERIC(15,2) DEFAULT 0,
        data_recebimento DATE,
        conta_id INTEGER,
        status VARCHAR(50) DEFAULT 'pendente',
        observacoes_recebimento TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS socios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255),
        email VARCHAR(255),
        telefone VARCHAR(50),
        cpf VARCHAR(20),
        data_nascimento DATE,
        endereco TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matrizes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255),
        cnpj_ein VARCHAR(50),
        endereco TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matriz_socios (
        id SERIAL PRIMARY KEY,
        matriz_id INTEGER,
        socio_id INTEGER,
        percentual_participacao NUMERIC(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aportes (
        id SERIAL PRIMARY KEY,
        socio_id INTEGER,
        matriz_id INTEGER,
        conta_id INTEGER,
        data_aporte DATE,
        valor NUMERIC(15,2),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS retiradas (
        id SERIAL PRIMARY KEY,
        socio_id INTEGER,
        matriz_id INTEGER,
        conta_id INTEGER,
        data_retirada DATE,
        valor NUMERIC(15,2),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS estruturas_dre (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS estruturas_dre_itens (
        id SERIAL PRIMARY KEY,
        estrutura_dre_id INTEGER,
        tipo VARCHAR(50),
        nome VARCHAR(255),
        grupo_contabil_id INTEGER,
        subgrupo_contabil_id INTEGER,
        ordem NUMERIC(10,2),
        nivel INTEGER,
        parent_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS estruturas_dre_soma_itens (
        id SERIAL PRIMARY KEY,
        soma_item_id INTEGER,
        referenced_item_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transferencias (
        id SERIAL PRIMARY KEY,
        conta_origem_id INTEGER,
        conta_destino_id INTEGER,
        valor NUMERIC(15,2),
        data_transferencia DATE,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contas_pagar_itens (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER,
        produto_id INTEGER,
        quantidade NUMERIC(10,2),
        valor_unitario NUMERIC(15,2),
        valor_total NUMERIC(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contas_receber_itens (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER,
        produto_id INTEGER,
        quantidade NUMERIC(10,2),
        valor_unitario NUMERIC(15,2),
        valor_total NUMERIC(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255),
        content_type VARCHAR(100),
        file_size INTEGER,
        file_data TEXT,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'All missing tables created successfully' as result;
    `,
  });
}

export default createAllMissingTables;
