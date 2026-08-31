// scripts/build-userscript.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';

const revisionArg = process.argv.find(arg => arg.startsWith('--revision='));
const revision = revisionArg?.slice('--revision='.length) || '005';
const outfile = `dist/voxthread-${revision}.user.js`;

const metadata = `// ==UserScript==
// @name         VoxThread
// @namespace    https://github.com/buzlet/voxthread
// @version      0.5.0
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
  legalComments: 'none',
  sourcemap: false,
});

console.log(outfile);
