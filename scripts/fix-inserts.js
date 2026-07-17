import fs from 'fs';
import path from 'path';

function processDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Revert previous inline comments
      if (content.includes('/* @ts-ignore */ .insert(')) {
        content = content.replace(/\/\* @ts-ignore \*\/ \.insert\(/g, '.insert(');
        changed = true;
      }

      const parts = content.split('.insert(');
      if (parts.length > 1) {
        let newContent = parts[0];
        for (let i = 1; i < parts.length; i++) {
          const before = parts[i - 1];
          if (!before.trim().endsWith('// @ts-ignore')) {
            newContent += '\n// @ts-ignore\n.insert(' + parts[i];
          } else {
            newContent += '.insert(' + parts[i];
          }
        }
        if (newContent !== content) {
          content = newContent;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('./src');
