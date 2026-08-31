// scripts/build-userscript.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const dev = process.argv.includes('--dev');
const outfile = dev ? 'dist/voxthread-dev.js' : 'dist/voxthread.user.js';
const releaseUrl = 'https://github.com/buzlet/voxthread/releases/latest/download/voxthread.user.js';

const updateMetadata = dev
  ? ''
  : `\n// @downloadURL  ${releaseUrl}\n// @updateURL    ${releaseUrl}`;

const metadata = `// ==UserScript==
// @name         VoxThread
// @namespace    https://github.com/buzlet/voxthread
// @version      ${pkg.version}
// @description  Read Telegram Web conversations aloud.
// @homepageURL  https://github.com/buzlet/voxthread
// @supportURL   https://github.com/buzlet/voxthread/issues
// @match        https://web.telegram.org/k/*
// @run-at       document-idle
// @grant        none${updateMetadata}
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
