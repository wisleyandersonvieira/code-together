import { action } from '@uibakery/data';

function fixTitulosReceberSequence() {
  return action('fixTitulosReceberSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Reset da sequência de titulos_receber para o valor correto
      DO $$
      DECLARE
          max_id INTEGER;
      BEGIN
          -- Obter o maior ID atual
          SELECT COALESCE(MAX(id), 0) INTO max_id FROM titulos_receber;
          
          -- Resetar sequência para o próximo valor disponível
          EXECUTE 'ALTER SEQUENCE titulos_receber_id_seq RESTART WITH ' || (max_id + 1);
          
          -- Log do resultado
          RAISE NOTICE 'Sequência titulos_receber_id_seq resetada para %', (max_id + 1);
      END $$;
      
      -- Retornar informações da sequência após o reset
      SELECT 
        'titulos_receber_id_seq' as sequence_name,
        last_value,
        is_called
      FROM titulos_receber_id_seq;
    `,
  });
}

export default fixTitulosReceberSequence;
