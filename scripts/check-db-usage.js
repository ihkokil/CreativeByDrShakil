const fs = require('fs');
const path = require('path');

const CATEGORY_A_TABLES = [
  'User', 'DeviceSession', 'SessionLockSettings', 'GlobalSessionLockSettings',
  'EmailOtp', 'Order', 'Payment', 'PaymentConfig', 'ContactSubmission',
  'LessonProgress', 'QuizAttempt', 'AttemptAnswer', 'QuizQuestionMapping',
  'StudentModuleAvailability', 'Account', 'Session', 'VerificationToken'
];

let errors = 0;
let warnings = 0;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Direct createClient calls
  // Make sure to avoid matching createClient inside src/lib/db.ts
  if (content.includes('createClient(') && !filePath.endsWith(path.join('lib', 'db.ts'))) {
    console.error(`[ERROR] Direct createClient() usage in ${filePath}. Use wrappers in lib/db.ts.`);
    errors++;
  }
  
  // 2. getSupabase( calls
  if (content.includes('getSupabase(') && !filePath.endsWith(path.join('lib', 'db.ts'))) {
    console.warn(`[WARN] Deprecated getSupabase() used in ${filePath}. Switch to getSupabaseAdmin()!`);
    warnings++;
  }
  
  // 3 & 4. getSupabaseContentRead usages
  if (content.includes('getSupabaseContentRead')) {
    // Find what variable it is assigned to, or if it is chained directly
    const varMatch = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?getSupabaseContentRead/);
    const varName = varMatch ? varMatch[1] : null;

    // Check for Category A tables
    for (const table of CATEGORY_A_TABLES) {
      const chainedMatch = new RegExp(`getSupabaseContentRead(?:\\([^)]*\\))?\\.from\\(['"\`]${table}['"\`]\\)`);
      const varMatchReg = varName ? new RegExp(`${varName}\\.from\\(['"\`]${table}['"\`]\\)`) : null;
      
      if (chainedMatch.test(content) || (varMatchReg && varMatchReg.test(content))) {
        console.error(`[ERROR] getSupabaseContentRead() used with Category A table '${table}' in ${filePath}`);
        errors++;
      }
    }

    // Check for writes (naive approach: if varName is used and any write method is present in the file, flag it if they look chained)
    // We will look for varName.from(...).insert or similar.
    // Or just look for varName followed by anything and then .insert(
    if (varName) {
      const writeMethods = ['\\.insert\\(', '\\.update\\(', '\\.delete\\(', '\\.upsert\\(', '\\.rpc\\('];
      for (const method of writeMethods) {
        // Matches varName...method but tries to keep it somewhat close to avoid huge false positives
        const writeReg = new RegExp(`${varName}\\.[\\s\\S]{0,150}?${method}`);
        if (writeReg.test(content)) {
          console.error(`[ERROR] getSupabaseContentRead() variable '${varName}' potentially used for write/rpc operation (${method}) in ${filePath}`);
          errors++;
        }
      }
    }
  }
}

console.log('Running DB Usage Check...');
scanDir(path.join(__dirname, '../src'));

console.log(`\nCheck Complete: ${errors} Errors, ${warnings} Warnings`);
if (errors > 0) {
  process.exit(1);
}
