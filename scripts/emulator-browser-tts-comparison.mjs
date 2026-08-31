// scripts/emulator-browser-tts-comparison.mjs
import fs from 'node:fs/promises';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PORT = 8766;
const reports = new Map();

function run(file, args = [], options = {}) {
  return execFileSync(file, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function adb(...args) {
  return run('adb', args);
}

function reportKey(browser, scenario) {
  return `${browser}:${scenario}`;
}

function probeHtml(browser, scenario) {
  const longText = Array.from({ length: 18 }, (_, index) =>
    `Lifecycle sentence ${index + 1}. The reader must not silently skip this message.`
  ).join(' ');

  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font: 16px sans-serif; }
  .bubble { display:block; min-height:48px; margin:8px; padding:8px; }
</style>
<div class="chat tabs-tab active">
  <section class="bubbles-date-group">
    <div class="bubbles-group">
      <div class="bubble is-in is-group-first is-group-last"
           data-mid="probe-1" data-peer-id="-2002" data-timestamp="1780000100">
        <span class="peer-title" data-peer-id="77">Probe author</span>
        <div class="message spoilers-container">
          <span class="translatable-message">${longText}</span>
        </div>
      </div>
    </div>
  </section>
</div>
<script>
const browserName = ${JSON.stringify(browser)};
const scenarioName = ${JSON.stringify(scenario)};
let sequence = 0;
async function send(phase, extra = {}) {
  const app = window.__voxThreadApp;
  const diagnostics = app?.getDiagnostics?.() || null;
  const payload = {
    browser: browserName,
    scenario: scenarioName,
    sequence: sequence++,
    phase,
    time: Date.now(),
    hidden: document.hidden,
    visibilityState: document.visibilityState,
    hasSpeechSynthesis: Boolean(window.speechSynthesis),
    hasUtterance: typeof window.SpeechSynthesisUtterance === 'function',
    appReady: Boolean(app),
    diagnostics,
    ...extra,
  };
  try {
    await fetch('/report', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}
window.addEventListener('error', event => {
  send('window-error', { message: String(event.message || event.error || 'unknown') });
});
document.addEventListener('visibilitychange', () => send('visibilitychange'));
window.addEventListener('pagehide', () => send('pagehide'));
window.addEventListener('pageshow', () => send('pageshow'));
</script>
<script src="/dist/voxthread-dev.js"></script>
<script>
setTimeout(async () => {
  const app = window.__voxThreadApp;
  if (!app) {
    await send('runtime-unavailable');
    return;
  }
  app.setReaderPreferences({
    announceAuthors: false,
    mergeAdjacent: false,
    autoResumeOnVisible: true,
  });
  app.buildQueue();
  app.player.play();
  await send('play-started');
  const timer = setInterval(() => send('heartbeat'), 500);
  setTimeout(() => clearInterval(timer), 12000);
}, 350);
</script>`;
}

async function startServer() {
  const bundle = await fs.readFile('dist/voxthread-dev.js');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'POST' && url.pathname === '/report') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const payload = JSON.parse(body);
        const key = reportKey(payload.browser, payload.scenario);
        const bucket = reports.get(key) || [];
        bucket.push(payload);
        reports.set(key, bucket);
        res.writeHead(204);
        res.end();
      } catch (error) {
        res.writeHead(400);
        res.end(String(error));
      }
      return;
    }
    if (url.pathname === '/dist/voxthread-dev.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
      res.end(bundle);
      return;
    }
    if (url.pathname === '/probe') {
      const browser = url.searchParams.get('browser') || 'unknown';
      const scenario = url.searchParams.get('scenario') || 'unknown';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(probeHtml(browser, scenario));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise(resolve => server.listen(PORT, '0.0.0.0', resolve));
  return server;
}

function findBounds(xml, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const node = xml.match(new RegExp(
      `<node[^>]*(?:text|content-desc)="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*>`,'i'
    ));
    if (node) return node.slice(1, 5).map(Number);
    const reverse = xml.match(new RegExp(
      `<node[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*(?:text|content-desc)="${escaped}"[^>]*>`,'i'
    ));
    if (reverse) return reverse.slice(1, 5).map(Number);
  }
  return null;
}

async function dismissFirefoxOnboarding() {
  const labels = [
    'Start browsing',
    'Not now',
    'Skip',
    'Continue',
    'Got it',
  ];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/voxthread-ui.xml');
      const xml = adb('shell', 'cat', '/sdcard/voxthread-ui.xml');
      const bounds = findBounds(xml, labels);
      if (!bounds) break;
      const [x1, y1, x2, y2] = bounds;
      adb('shell', 'input', 'tap', String(Math.floor((x1 + x2) / 2)), String(Math.floor((y1 + y2) / 2)));
      await sleep(500);
    } catch {
      break;
    }
  }
}

async function waitFor(browser, scenario, predicate, timeoutMs = 9000) {
  const key = reportKey(browser, scenario);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const bucket = reports.get(key) || [];
    const match = [...bucket].reverse().find(predicate);
    if (match) return match;
    await sleep(200);
  }
  return null;
}

function openBrowser(pkg, browser, scenario) {
  const url = `http://10.0.2.2:${PORT}/probe?browser=${encodeURIComponent(browser)}&scenario=${encodeURIComponent(scenario)}&rev=${Date.now()}`;
  adb(
    'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', url,
    pkg,
  );
  return url;
}

async function ensureProbeLoaded(pkg, browser, scenario) {
  openBrowser(pkg, browser, scenario);
  if (browser === 'firefox') {
    await sleep(900);
    await dismissFirefoxOnboarding();
    openBrowser(pkg, browser, scenario);
  }
  const ready = await waitFor(
    browser,
    scenario,
    item => item.phase === 'play-started' || item.phase === 'runtime-unavailable' || item.phase === 'window-error',
  );
  if (!ready) throw new Error(`${browser}/${scenario}: probe page did not report`);
  return ready;
}

async function runScenario(browser, pkg, scenario) {
  reports.delete(reportKey(browser, scenario));
  const started = await ensureProbeLoaded(pkg, browser, scenario);
  if (!started.appReady) {
    await sleep(500);
    return reports.get(reportKey(browser, scenario)) || [started];
  }

  await waitFor(browser, scenario, item => item.phase === 'heartbeat', 3000);
  if (scenario === 'background') {
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
    await sleep(2500);
    adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
    await sleep(1500);
  } else if (scenario === 'screen-off') {
    adb('shell', 'input', 'keyevent', '26');
    await sleep(2500);
    adb('shell', 'input', 'keyevent', '26');
    await sleep(1200);
    adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
    await sleep(1200);
  } else {
    await sleep(2500);
  }

  return reports.get(reportKey(browser, scenario)) || [];
}

function summarize(items) {
  const first = items.find(item => item.phase === 'play-started') || items[0] || null;
  const last = items.at(-1) || first;
  const errors = items.filter(item => item.phase === 'window-error' || item.diagnostics?.tts?.error);
  return {
    hasSpeechSynthesis: Boolean(first?.hasSpeechSynthesis),
    hasUtterance: Boolean(first?.hasUtterance),
    appReady: Boolean(first?.appReady),
    provider: first?.diagnostics?.tts?.provider ?? null,
    firstQueueStatus: first?.diagnostics?.queue?.status ?? null,
    finalQueueStatus: last?.diagnostics?.queue?.status ?? null,
    finalSpeaking: Boolean(last?.diagnostics?.tts?.speaking),
    finalError: last?.diagnostics?.tts?.error ?? errors.at(-1)?.message ?? null,
    visibilityEvents: items.filter(item => item.phase === 'visibilitychange').map(item => item.visibilityState),
    samples: items.length,
  };
}

await fs.mkdir('artifacts', { recursive: true });
run('node', ['scripts/build-userscript.mjs', '--dev']);
const server = await startServer();

const browsers = [
  ['chrome', 'com.android.chrome'],
  ['firefox', 'org.mozilla.firefox'],
];
const scenarios = ['foreground', 'background', 'screen-off'];
const result = {
  target: 'GitHub/API36 generic Android emulator',
  measuredAt: new Date().toISOString(),
  browsers: {},
};

try {
  for (const [browser, pkg] of browsers) {
    result.browsers[browser] = {};
    for (const scenario of scenarios) {
      try {
        const items = await runScenario(browser, pkg, scenario);
        result.browsers[browser][scenario] = summarize(items);
      } catch (error) {
        result.browsers[browser][scenario] = {
          error: String(error?.message || error),
        };
      }
      try { adb('shell', 'am', 'force-stop', pkg); } catch {}
      await sleep(300);
    }
  }
} finally {
  server.close();
}

await fs.writeFile(
  'artifacts/browser-tts-comparison.json',
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
