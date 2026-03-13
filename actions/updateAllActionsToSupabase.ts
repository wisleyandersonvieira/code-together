import { action } from '@uibakery/data';

function updateAllActionsToSupabase() {
  return action('updateAllActionsToSupabase', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- This is a placeholder action to test Supabase connectivity
      -- The actual action updates will be done manually or via script
      SELECT 
        'All actions will be updated to use provisonsupabase database' as message,
        CURRENT_TIMESTAMP as timestamp;
    `,
  });
}

export default updateAllActionsToSupabase;
