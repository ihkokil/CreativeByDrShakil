const fs = require('fs');
const path = require('path');

const dirsToSearch = [
  'src/components/Auth',
  'src/components/Checkout',
  'src/components/Teacher',
  'src/components/Shared',
  'src/components/Admin',
  'src/components/UI'
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // 1. Remove onClick from overlay
  const overlayRegex1 = /<div\s+className=\{styles\.overlay\}\s+onClick=\{[^}]+\}>/g;
  if (overlayRegex1.test(content)) {
    content = content.replace(overlayRegex1, '<div className={styles.overlay}>');
    changed = true;
  }
  
  const overlayRegex2 = /<div\s+className=\{styles\.modalOverlay\}\s+onClick=\{[^}]+\}>/g;
  if (overlayRegex2.test(content)) {
    content = content.replace(overlayRegex2, '<div className={styles.modalOverlay}>');
    changed = true;
  }

  // 2. Add import and hook
  if (changed && !content.includes('useModalLock')) {
    const importStr = '\nimport { useModalLock } from "@/hooks/useModalLock";';
    content = content.replace(/(import\s+.*from\s+['"]react['"];?)/, '$1' + importStr);
    
    // Attempt to inject the hook at the top of the component
    // AuthModal: export default function AuthModal({ isOpen, onClose, ... }) {
    // We assume `isOpen` and `onClose` or `handleClose` are available.
    // If we look for `export default function`, we can inject it.
    let hookStr = '\n    useModalLock(isOpen, onClose);';
    if(filePath.includes('AuthModal') || filePath.includes('AlertModal')) {
         hookStr = '\n    useModalLock(isOpen, onClose);';
    }

    content = content.replace(/(export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/, '$1' + hookStr);
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Fixed', filePath);
  }
}

dirsToSearch.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    fs.readdirSync(fullPath).forEach(file => {
      if (file.endsWith('Modal.tsx') || file === 'ImageCropper.tsx') {
        processFile(path.join(fullPath, file));
      }
    });
  }
});
