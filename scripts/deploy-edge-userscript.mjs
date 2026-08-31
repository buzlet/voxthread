// scripts/deploy-edge-userscript.mjs
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const fileArg = process.argv[2];
if (!fileArg) throw new Error('Usage: node scripts/deploy-edge-userscript.mjs <file.user.js>');

const root = process.cwd();
const file = path.resolve(fileArg);
if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
const rel = path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');

function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (r.status !== 0) throw new Error(`${command}: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureServer() {
  try {
    const r = await fetch(`http://127.0.0.1:8765/${rel}`);
    if (r.ok) return;
  } catch {}

  const p = spawn('python3', [
    '-m', 'http.server', '8765',
    '--bind', '0.0.0.0',
    '--directory', root,
  ], { detached: true, stdio: 'ignore' });
  p.unref();

  for (let i = 0; i < 20; i += 1) {
    await sleep(150);
    try {
      const r = await fetch(`http://127.0.0.1:8765/${rel}`);
      if (r.ok) return;
    } catch {}
  }
  throw new Error('Local userscript server did not start');
}

function getLanIp() {
  const ips = run('hostname', ['-I']).split(/\s+/).filter(Boolean);
  return ips.find(ip => /^192\.168\./.test(ip))
    || ips.find(ip => /^10\./.test(ip))
    || ips.find(ip => !/^127\./.test(ip) && !/^172\.(1[6-9]|2\d|3[01])\./.test(ip));
}

async function getPrompt() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const pages = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
      const prompt = pages.find(p =>
        p.type === 'page'
        && p.url.startsWith('chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/ask.html')
      );
      if (prompt) return prompt;
    } catch {}
    await sleep(200);
  }
  throw new Error('Tampermonkey install/update prompt not found');
}

async function applyPrompt(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(msg.error) : p.resolve(msg.result);
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const callId = ++id;
  ws.send(JSON.stringify({
    id: callId,
    method: 'Runtime.evaluate',
    params: {
      returnByValue: true,
      expression: `(() => {
        const items = [...document.querySelectorAll('button,input,a')]
          .map(el => ({
            el,
            label: (el.innerText || el.value || el.textContent || '').trim(),
            r: el.getBoundingClientRect()
          }))
          .filter(x => x.el.offsetParent !== null && x.r.width > 0 && x.r.height > 0);
        const action = items.find(x => /^(install|update|reinstall)$/i.test(x.label));
        if (!action) return { applied: false, action: null };
        action.el.click();
        return { applied: true, action: action.label };
      })()`,
    },
  }));

  const result = await new Promise((resolve, reject) =>
    pending.set(callId, { resolve, reject })
  );
  ws.close();
  return result.result?.value;
}

await ensureServer();

const host = process.env.VOXTHREAD_HOST || getLanIp();
if (!host) throw new Error('Cannot determine LAN IP; set VOXTHREAD_HOST');

run('adb', ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote']);
const url = `http://${host}:8765/${rel}`;

run('adb', [
  'shell', 'am', 'start',
  '-a', 'android.intent.action.VIEW',
  '-d', url,
  'com.microsoft.emmx',
]);

const prompt = await getPrompt();
const result = await applyPrompt(prompt);
if (!result?.applied) throw new Error('Tampermonkey action button not found');

await sleep(300);
run('adb', [
  'shell', 'am', 'start',
  '-a', 'android.intent.action.VIEW',
  '-d', 'https://web.telegram.org/k/',
  'com.microsoft.emmx',
]);

console.log(`${result.action}: ${path.basename(file)}`);
