-- Migration: Make cliente_id nullable in contas_receber table
-- This allows us to use entity_type/entity_id for empresas and grupos

ALTER TABLE contas_receber ALTER COLUMN cliente_id DROP NOT NULL;
