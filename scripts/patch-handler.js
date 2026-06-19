import fs from 'fs';
import path from 'path';

const handlerPath = path.resolve('.open-next/server-functions/default/handler.mjs');

if (fs.existsSync(handlerPath)) {
  let content = fs.readFileSync(handlerPath, 'utf8');
  
  // Find the pattern: default\node_modules
  // Since it might be escaped as \\node_modules or literal \node_modules, let's match both
  const searchPattern = /default\\+node_modules/g;
  
  if (content.match(searchPattern) || content.includes('default\\node_modules') || content.includes('default\node_modules')) {
    console.log('Found Windows path separators in handler.mjs, replacing with forward slashes...');
    
    // Replace all default\node_modules or default\\node_modules with default/node_modules
    content = content.replace(/default\\+node_modules/g, 'default/node_modules');
    // Also handle if it is a literal unescaped backslash in the JS string
    content = content.replace(/default\\node_modules/g, 'default/node_modules');
    content = content.replace(/default\x00ode_modules/g, 'default/node_modules'); // in case \n was parsed as a newline or null char
    content = content.replace(/default\node_modules/g, 'default/node_modules');
    
    fs.writeFileSync(handlerPath, content, 'utf8');
    console.log('Successfully patched handler.mjs!');
  } else {
    console.log('No Windows path separator issues detected in handler.mjs.');
  }
} else {
  console.error('handler.mjs not found at:', handlerPath);
}
