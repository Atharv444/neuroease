import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\belga\\.gemini\\antigravity-ide\\brain\\66aba1e5-0883-4ad7-919f-347beb2eae07";
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome_ai_dash_scroll_profile');

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

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result?.value;
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  const port = 9336;
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--ignore-certificate-errors',
    '--headless=new',
    '--window-size=430,932'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        wsUrl = await getWebSocketDebuggerUrl(port);
        if (wsUrl) break;
      } catch (e) {
        await sleep(300);
      }
    }

    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'https://localhost:5175/' });
    await sleep(1500);

    // Seed history and demo
    await client.evaluate(`
      (() => {
        localStorage.setItem('neuroDemo', 'true');
        localStorage.setItem('neuroName', 'Alex');

        const mockHistory = [
          {
            id: (Date.now() - 500000).toString(),
            date: 'Today, 10:00 AM',
            duration: 15,
            mode: 'Combined',
            feedback: 'up',
            painBefore: 8,
            painAfter: 3,
            aiGenerated: true,
            symptomsText: 'severe throbbing behind eyes light sensitive'
          },
          {
            id: (Date.now() - 600000).toString(),
            date: 'Yesterday, 3:30 PM',
            duration: 10,
            mode: 'Audio',
            feedback: 'up',
            painBefore: 6,
            painAfter: 4,
            aiGenerated: true,
            symptomsText: 'stress temples tension nausea'
          },
          {
            id: (Date.now() - 700000).toString(),
            date: 'Apr 16, 8:00 PM',
            duration: 20,
            mode: 'Vibration',
            feedback: 'down',
            painBefore: 9,
            painAfter: 8,
            aiGenerated: true,
            symptomsText: 'severe migraine light sensitive'
          }
        ];
        localStorage.setItem('neuroHistory', JSON.stringify(mockHistory));
      })()
    `);

    await client.send('Page.navigate', { url: 'https://localhost:5175/dashboard' });
    
    // Wait for Agent Insights cards to render from Gemini API / cache
    console.log('Waiting for Agent Insights cards to render...');
    for (let i = 0; i < 20; i++) {
      const count = await client.evaluate(`document.querySelectorAll('[id^="agent-insight-card-"]').length`);
      if (count >= 1) {
        console.log(`Cards rendered! Count = ${count}`);
        break;
      }
      await sleep(500);
    }

    // Scroll down to reveal Agent Insights cards below Quick Start
    await client.evaluate(`
      (() => {
        window.scrollTo(0, 360);
      })()
    `);
    await sleep(500);

    const outPath = path.join(ARTIFACT_DIR, 'dashboard_agent_insights_scrolled.png');
    await client.captureScreenshot(outPath);
  } finally {
    chromeProcess.kill();
  }
}

main();
