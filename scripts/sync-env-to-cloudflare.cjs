const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
const tempJsonPath = path.join(__dirname, '..', 'temp-secrets.json');

if (!fs.existsSync(envPath)) {
  console.error('.env file not found at', envPath);
  process.exit(1);
}

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      if (value.startsWith('"') && value.indexOf('"', 1) !== -1) {
        value = value.substring(1, value.indexOf('"', 1));
      } else if (value.startsWith("'") && value.indexOf("'", 1) !== -1) {
        value = value.substring(1, value.indexOf("'", 1));
      } else {
        // Remove trailing comment if there are no quotes
        value = value.split(' #')[0].trim();
      }
      
      env[key] = value;
    }
  });
  
  return env;
}

const envVars = parseEnv(envPath);
const keys = Object.keys(envVars);

if (keys.length === 0) {
  console.log('No valid environment variables found in .env');
  process.exit(0);
}

console.log(`Found ${keys.length} variables. Writing to temp file...`);

// Write secrets to a temp JSON file for Wrangler's bulk upload feature
fs.writeFileSync(tempJsonPath, JSON.stringify(envVars, null, 2), 'utf-8');

console.log('Starting bulk sync to Cloudflare...');

// Use npx.cmd on Windows, npx on Unix
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// We can use stdio: 'inherit' here because we don't need to pipe stdin anymore.
// This allows Wrangler to detect your interactive terminal and use your `wrangler login` session!
const result = spawnSync(npxCommand, ['wrangler', 'secret', 'bulk', 'temp-secrets.json'], {
  stdio: 'inherit',
  shell: true
});

// Clean up the temporary secrets file
if (fs.existsSync(tempJsonPath)) {
  fs.unlinkSync(tempJsonPath);
}

if (result.status === 0) {
  console.log('\n✅ Successfully synced all secrets in bulk!');
} else {
  console.error('\n❌ Failed to sync secrets.');
}
