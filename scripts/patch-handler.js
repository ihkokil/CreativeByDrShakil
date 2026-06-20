import fs from 'fs';
import path from 'path';

const basePath = path.resolve('.open-next/server-functions/default');
const handlerPath = path.join(basePath, 'handler.mjs');

if (fs.existsSync(handlerPath)) {
  let content = fs.readFileSync(handlerPath, 'utf8');
  
  const searchPattern = /default\\+node_modules/g;
  if (content.match(searchPattern) || content.includes('default\\node_modules') || content.includes('default\node_modules')) {
    console.log('Found Windows path separators in handler.mjs, replacing with forward slashes...');
    content = content.replace(/default\\+node_modules/g, 'default/node_modules');
    content = content.replace(/default\\node_modules/g, 'default/node_modules');
    content = content.replace(/default\x00ode_modules/g, 'default/node_modules'); 
    content = content.replace(/default\node_modules/g, 'default/node_modules');
    fs.writeFileSync(handlerPath, content, 'utf8');
    console.log('Successfully patched handler.mjs!');
  } else {
    console.log('No Windows path separator issues detected in handler.mjs.');
  }
} else {
  console.error('handler.mjs not found at:', handlerPath);
}

// Aggressively clean up heavy Next.js internal files that we don't need in Cloudflare Workers
const pathsToRemove = [
  'node_modules/next/dist/server/capsize-font-metrics.json',
  'node_modules/next/dist/compiled/@next/font/dist/fontkit',
  'node_modules/next/dist/compiled/next-devtools'
];

pathsToRemove.forEach(relPath => {
  const fullPath = path.join(basePath, relPath);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Deleted ${relPath} to drastically reduce Cloudflare bundle size.`);
  }
});
