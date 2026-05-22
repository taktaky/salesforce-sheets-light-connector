const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/code.js',
    format: 'iife',
    target: 'es2019',
    treeShaking: false,
  });

  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('appsscript.json', path.join('dist', 'appsscript.json'));
}

build().catch(() => process.exit(1));
