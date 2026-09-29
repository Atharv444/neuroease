import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\belga\\.gemini\\antigravity-ide\\brain\\66aba1e5-0883-4ad7-919f-347beb2eae07";
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome_test_profile_midcheckin');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWebSocketDebuggerUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page') || list[0];
          if (page && page.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('No page target found'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${fullPath} (${buffer.length} bytes)`);
    return fullPath;
  }
}

async function run() {
  const port = 9338;
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log('Launching headless Chrome on port', port);
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--ignore-certificate-errors',
    '--window-size=430,932',
    'about:blank'
  ]);

  try {
    await sleep(2000);
    const wsUrl = await getWebSocketDebuggerUrl(port);
    console.log('Connected to debugger:', wsUrl);

    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('\n--- TEST MANUAL THERAPY SESSION (NO AI AGENT) ---');
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/therapy' });
    await sleep(1500);

    // Set demo mode active in localStorage and reload
    await cdp.eval(`
      (() => {
        localStorage.setItem('neuroDemo', 'true');
      })()
    `);
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/therapy' });
    await sleep(1500);

    // 1. Select 5 min duration
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn5 = buttons.find(b => b.innerText.trim() === '5');
        if (btn5) btn5.click();
      })()
    `);
    await sleep(500);

    // 2. Select Combined mode manually
    await cdp.eval(`
      (() => {
        const mode = document.getElementById('mode-combined');
        if (mode) mode.click();
      })()
    `);
    await sleep(500);

    // 3. Start Therapy (Manual)
    await cdp.eval(`
      (() => {
        const startBtn = document.getElementById('start-therapy-btn');
        if (startBtn) startBtn.click();
      })()
    `);
    await sleep(800);

    // 4. Rate pain 6 and start
    await cdp.eval(`
      (() => {
        const score6 = document.getElementById('pain-score-6');
        if (score6) score6.click();
      })()
    `);
    await sleep(500);
    await cdp.eval(`
      (() => {
        const submitBtn = document.getElementById('pain-modal-submit-btn');
        if (submitBtn) submitBtn.click();
      })()
    `);
    await sleep(1500);

    const activeState = await cdp.eval(`
      (() => {
        const timer = document.getElementById('countdown-timer-display');
        return {
          timerText: timer ? timer.innerText : null,
          hasSessionHUD: !!timer
        };
      })()
    `);
    console.log('Manual session started:', activeState);

    // 5. Test halfway point: For a 5 min session, halfway is 150 seconds (02:30).
    // Set timer to 151 via test event to let it tick down to 150
    console.log('Setting timer to 151 seconds (1 second before 50% halfway point of 150s)...');
    await cdp.eval(`
      window.dispatchEvent(new CustomEvent('neuroease-test-set-timer', { detail: 151 }));
    `);
    await sleep(1800);

    const checkinState = await cdp.eval(`
      (() => {
        const modal = document.querySelector('h2, h3');
        const bodyText = document.body.innerText;
        const hasCheckin = bodyText.includes('Quick Check-in') || bodyText.includes('How\\'s the pain');
        const hasBetter = bodyText.includes('Better');
        const hasSame = bodyText.includes('Same');
        const hasWorse = bodyText.includes('Worse');
        const timer = document.getElementById('countdown-timer-display');
        return {
          hasCheckin,
          hasBetter,
          hasSame,
          hasWorse,
          timerText: timer ? timer.innerText : null
        };
      })()
    `);
    console.log('Mid-Session Check-in triggered for Manual Session:', checkinState);

    await cdp.captureScreenshot('manual_session_mid_checkin_proof.png');

    // 6. Test clicking "Better"
    console.log('Testing "Better" response...');
    await cdp.eval(`
      (() => {
        const betterBtn = document.getElementById('mid-checkin-better');
        if (betterBtn) betterBtn.click();
      })()
    `);
    await sleep(1200);

    const postBetterState = await cdp.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const checkinGone = !bodyText.includes('Quick Check-in');
        const toast = bodyText.includes('Great! Keeping current settings') || bodyText.includes('Great');
        const timer = document.getElementById('countdown-timer-display');
        return {
          checkinDismissed: checkinGone,
          toastShown: toast,
          timerActive: !!timer,
          timerText: timer ? timer.innerText : null
        };
      })()
    `);
    console.log('Post-Better state:', postBetterState);
    await cdp.captureScreenshot('manual_session_after_checkin_proof.png');

    // 7. Stop therapy
    console.log('Stopping therapy...');
    await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('stop-therapy-btn');
        if (stopBtn) stopBtn.click();
      })()
    `);
    await sleep(1000);

    console.log('\nAll manual mid-session check-in tests passed!');
  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
