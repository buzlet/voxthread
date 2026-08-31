// scripts/verify-userscript.mjs
import fs from 'node:fs/promises';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const file = process.argv[2] || 'dist/voxthread.user.js';
const source = await fs.readFile(file, 'utf8');
const headerEnd = source.indexOf('// ==/UserScript==');
if (headerEnd < 0) throw new Error(`${file}: userscript metadata header missing`);
const header = source.slice(0, headerEnd + '// ==/UserScript=='.length);

const releaseUrl = 'https://github.com/buzlet/voxthread/releases/latest/download/voxthread.user.js';
const required = [
  `// @version      ${pkg.version}`,
  '// @match        https://web.telegram.org/k/*',
  `// @downloadURL  ${releaseUrl}`,
  `// @updateURL    ${releaseUrl}`,
];

for (const line of required) {
  if (!header.includes(line)) throw new Error(`${file}: missing metadata: ${line}`);
}

if (!source.includes(`VoxThread ${pkg.version}`) && !source.includes(JSON.stringify(pkg.version))) {
  throw new Error(`${file}: bundled application version is not ${pkg.version}`);
}

console.log(`${file}: metadata OK (${pkg.version})`);
