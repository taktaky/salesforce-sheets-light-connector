const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  fs.mkdirSync('dist', { recursive: true });

  const staleFiles = ['dist/code.js', 'dist/Code.gs'];
  for (const file of staleFiles) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/lib.js',
    format: 'iife',
    globalName: 'Sfc',
    target: 'es2019',
  });

  // Apps Script simple triggers must stay as top-level functions.
  await esbuild.build({
    entryPoints: ['src/Code.ts'],
    bundle: false,
    outfile: 'dist/Code.js',
    target: 'es2019',
  });

  fs.copyFileSync('appsscript.json', path.join('dist', 'appsscript.json'));
}

build().catch(() => process.exit(1));
