// scripts/build-userscript.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));

const revisionArg = process.argv.find(arg => arg.startsWith('--revision='));
const [, minor = '0'] = String(pkg.version).split('.');
const defaultRevision = String(Number(minor) || 0).padStart(3, '0');
const revision = revisionArg?.slice('--revision='.length) || defaultRevision;
const outfile = `dist/voxthread-${revision}.user.js`;

const metadata = `// ==UserScript==
// @name         VoxThread
// @namespace    https://github.com/buzlet/voxthread
// @version      ${pkg.version}
// @description  Read Telegram Web conversations aloud.
// @match        https://web.telegram.org/k/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==`;

await fs.mkdir('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/runtime/userscript-main.mjs'],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  banner: { js: metadata },
  define: {
    __VOXTHREAD_VERSION__: JSON.stringify(pkg.version),
  },
  legalComments: 'none',
  sourcemap: false,
});

console.log(outfile);
