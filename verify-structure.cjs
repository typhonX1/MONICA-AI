// verify-structure.cjs - Run this to check your project structure
// Save as .cjs extension for CommonJS compatibility
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Project Structure...\n');

const projectRoot = process.cwd();
console.log('📁 Project Root:', projectRoot);
console.log('');

const requiredFiles = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'src/main.ts',
  'src/preload.ts',
  'src/renderer-with-auth.ts',
  'src/authService.ts',
  'src/firebaseConfig.ts',
  'src/styles.css',
  'dist/main.js',
  'dist/preload.js',
  'dist/renderer-with-auth.js',
  'dist/authService.js',
  'dist/firebaseConfig.js',
  'dist/styles.css'
];

let allGood = true;

requiredFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  const icon = exists ? '✅' : '❌';
  console.log(`${icon} ${file}`);
  
  if (!exists) {
    allGood = false;
    if (file.startsWith('dist/')) {
      console.log(`   ℹ️  Run 'npm run build' to generate this file`);
    } else if (file === 'index.html') {
      console.log(`   ⚠️  CRITICAL: Move index.html to project root!`);
      
      // Check if it's in src folder
      const srcIndexPath = path.join(projectRoot, 'src', 'index.html');
      if (fs.existsSync(srcIndexPath)) {
        console.log(`   📍 Found at: src/index.html`);
        console.log(`   💡 Run: move src\\index.html . (Windows)`);
      }
    }
  }
});

console.log('');

if (allGood) {
  console.log('✅ All files are in place!');
  console.log('');
  console.log('Next steps:');
  console.log('1. npm run build');
  console.log('2. npm start');
} else {
  console.log('❌ Some files are missing. Please fix the issues above.');
  console.log('');
  console.log('Quick fixes:');
  console.log('• If index.html is missing from root: move src\\index.html .');
  console.log('• If dist/ files are missing: npm run build');
}

console.log('');