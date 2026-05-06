const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy source files to dist
const srcDir = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(srcDir).filter((f) => !f.includes('.test.'));

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
}

console.log(`Build complete: ${files.length} file(s) copied to dist/`);
