-- Migration to update existing projects to first column and ensure new projects go to first column
DO $$
DECLARE
    first_column_id INTEGER;
BEGIN
    -- Get the first column ID (lowest position)
    SELECT id INTO first_column_id 
    FROM kanban_columns 
    ORDER BY position ASC 
    LIMIT 1;
    
    -- Update all projects that don't have a kanban_column_id to use the first column
    IF first_column_id IS NOT NULL THEN
        UPDATE projetos 
        SET kanban_column_id = first_column_id,
            kanban_position = COALESCE((
                SELECT MAX(kanban_position) + 1 
                FROM projetos 
                WHERE kanban_column_id = first_column_id
            ), 0)
        WHERE kanban_column_id IS NULL;
    END IF;
END $$;
