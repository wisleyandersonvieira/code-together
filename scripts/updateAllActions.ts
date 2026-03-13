import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const oldDatabase = 'New custom app_bR26bpPQmY';
const newDatabase = 'provision';

function updateFilesInDirectory(dirPath: string) {
  let updatedFiles = 0;
  
  const items = readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursivamente processar subdiretórios
      updatedFiles += updateFilesInDirectory(fullPath);
    } else if (item.endsWith('.ts')) {
      try {
        let content = readFileSync(fullPath, 'utf-8');
        const originalContent = content;
        
        // Substituir o nome do banco
        content = content.replace(new RegExp(oldDatabase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newDatabase);
        
        if (content !== originalContent) {
          writeFileSync(fullPath, content, 'utf-8');
          updatedFiles++;
          console.log(`✅ Atualizado: ${fullPath.replace(process.cwd(), '.')}`);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao processar ${fullPath}: ${error.message}`);
      }
    }
  }
  
  return updatedFiles;
}

// Executar a atualização
console.log(`🔄 Substituindo "${oldDatabase}" por "${newDatabase}" em todos os arquivos de actions...`);

const actionsDir = join(process.cwd(), 'actions');
const updatedCount = updateFilesInDirectory(actionsDir);

console.log(`\n📊 Resumo: ${updatedCount} arquivos atualizados`);
console.log(`✅ Todas as ações agora usam o banco "${newDatabase}"`);
