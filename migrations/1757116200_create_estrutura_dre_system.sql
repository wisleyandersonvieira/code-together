-- Migration to create DRE structure system
-- Creates tables for DRE (Demonstrativo de Resultado do Exercício) structure management

-- Table for DRE structure definitions
CREATE TABLE estruturas_dre (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for DRE structure items (groups, subgroups, and sum lines)
CREATE TABLE estruturas_dre_itens (
  id SERIAL PRIMARY KEY,
  estrutura_dre_id INTEGER NOT NULL REFERENCES estruturas_dre(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('GRUPO', 'SUBGRUPO', 'SOMA')),
  nome VARCHAR(255) NOT NULL,
  grupo_contabil_id INTEGER REFERENCES grupos_contabeis(id),
  subgrupo_contabil_id INTEGER REFERENCES subgrupos_contabeis(id),
  ordem DECIMAL(10,2) NOT NULL,
  nivel INTEGER NOT NULL DEFAULT 1,
  parent_id INTEGER REFERENCES estruturas_dre_itens(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for sum line references (which groups/subgroups to include in sum)
CREATE TABLE estruturas_dre_soma_itens (
  id SERIAL PRIMARY KEY,
  soma_item_id INTEGER NOT NULL REFERENCES estruturas_dre_itens(id) ON DELETE CASCADE,
  referenced_item_id INTEGER NOT NULL REFERENCES estruturas_dre_itens(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_estruturas_dre_itens_estrutura_id ON estruturas_dre_itens(estrutura_dre_id);
CREATE INDEX idx_estruturas_dre_itens_ordem ON estruturas_dre_itens(estrutura_dre_id, ordem);
CREATE INDEX idx_estruturas_dre_itens_parent ON estruturas_dre_itens(parent_id);
CREATE INDEX idx_estruturas_dre_soma_itens_soma ON estruturas_dre_soma_itens(soma_item_id);
