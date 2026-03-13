// Utilitário para atualizar todas as actions para usar o Supabase
// Execute este script para migrar todas as ações para o banco provisonsupabase

const fs = require('fs');
const path = require('path');

const ACTIONS_DIR = './actions';
const OLD_DATABASE = 'New custom app_bR26bpPQmY';
const NEW_DATABASE = 'provisonsupabase';

function updateActionFile(filePath: string) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace database name
    const oldPattern = `databaseName: '${OLD_DATABASE}'`;
    const newPattern = `databaseName: '${NEW_DATABASE}'`;
    
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      fs.writeFileSync(filePath, content);
      console.log(`Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
    return false;
  }
}

function updateAllActions() {
  if (!fs.existsSync(ACTIONS_DIR)) {
    console.error(`Actions directory not found: ${ACTIONS_DIR}`);
    return;
  }

  const files = fs.readdirSync(ACTIONS_DIR);
  let updatedCount = 0;
  
  files.forEach(file => {
    if (file.endsWith('.ts')) {
      const filePath = path.join(ACTIONS_DIR, file);
      if (updateActionFile(filePath)) {
        updatedCount++;
      }
    }
  });
  
  console.log(`\nSummary: Updated ${updatedCount} action files to use ${NEW_DATABASE}`);
}

// Run the update
updateAllActions();

export {};
