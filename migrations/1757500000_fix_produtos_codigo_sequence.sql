-- Migration to ensure produtos_codigo_seq exists and is properly configured
DO $$
BEGIN
    -- Check if sequence exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'produtos_codigo_seq') THEN
        CREATE SEQUENCE produtos_codigo_seq START 1;
    END IF;
    
    -- Sync sequence with existing data
    PERFORM setval('produtos_codigo_seq', (SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM '^[0-9]+') AS INTEGER)), 0) FROM produtos WHERE codigo ~ '^[0-9]+'), false);
END
$$;
