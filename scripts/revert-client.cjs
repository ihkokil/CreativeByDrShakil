const fs = require('fs');
const path = require('path');

const targetDirs = [
  'src/app/api/study',
  'src/app/api/students',
  'src/app/api/me',
  'src/app/api/courses/dynamic',
  'src/app/api/quiz'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  if (!content.includes('getSupabaseAdmin')) return;

  // Replace import
  content = content.replace(
    /import\s*{\s*getSupabaseAdmin\s*}\s*from\s*['"]@\/lib\/db['"];/,
    "import { getSupabase } from '@/lib/db';\nimport { extractCookieToken } from '@/lib/auth-server';"
  );

  // Replace instantiation
  content = content.replace(
    /const supabase = getSupabaseAdmin\(\);/g,
    "const token = await extractCookieToken();\n    const supabase = getSupabase(token);"
  );

  // Fix indentation for token
  content = content.replace(/(\s*)const token = await extractCookieToken\(\);\n\s*const supabase = getSupabase\(token\);/g, (match, p1) => {
    return p1 + "const token = await extractCookieToken();\n" + p1 + "const supabase = getSupabase(token);";
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const fullDir = path.resolve(__dirname, '..', dir);
  if (!fs.existsSync(fullDir)) return;
  const files = fs.readdirSync(fullDir);
  for (const file of files) {
    const fullPath = path.join(fullDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(path.join(dir, file));
    } else if (fullPath.endsWith('route.ts')) {
      processFile(fullPath);
    }
  }
}

targetDirs.forEach(walkDir);
