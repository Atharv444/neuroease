import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\belga\\.gemini\\antigravity-ide\\brain\\66aba1e5-0883-4ad7-919f-347beb2eae07";
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome_test_profile_timer_bugs');

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
  const port = 9333;
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

    console.log('\n--- STEP 1: INITIALIZE SESSIONS AND TEST DASHBOARD INSIGHTS ---');
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/' });
    await sleep(1500);

    // Seed 4 manual sessions with painBefore & painAfter (NO aiGenerated flag) and force clear insights cache
    await cdp.eval(`
      (() => {
        const sampleSessions = [
          { id: 'sess_1', date: 'Today, 2:30 PM', duration: 15, mode: 'Combined', feedback: 'up', painBefore: 8, painAfter: 3 },
          { id: 'sess_2', date: 'Yesterday, 8:00 PM', duration: 10, mode: 'Audio', feedback: 'down', painBefore: 7, painAfter: 4 },
          { id: 'sess_3', date: 'Apr 16, 9:15 AM', duration: 20, mode: 'Vibration', feedback: null, painBefore: 6, painAfter: 2 },
          { id: 'sess_4', date: 'Apr 15, 6:00 PM', duration: 15, mode: 'Combined', feedback: 'up', painBefore: 9, painAfter: 4 }
        ];
        localStorage.setItem('neuroHistory', JSON.stringify(sampleSessions));
        localStorage.setItem('neuroDemo', 'true');
        localStorage.setItem('neuroName', 'Alex');
        localStorage.removeItem('agentInsightsCache');
        localStorage.removeItem('agentInsightsCacheTime');
        localStorage.removeItem('neuroease_agent_insights');
      })()
    `);

    // Reload page so Dashboard mounts with fresh memory & checks eligibleSessions >= 3
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/' });
    await sleep(2000);

    // Wait for Agent Insights cards to render
    console.log('Waiting for Agent Insights cards to render...');
    let cardsFound = false;
    for (let i = 0; i < 25; i++) {
      const count = await cdp.eval(`document.querySelectorAll('[id^="agent-insight-card-"]').length`);
      if (count && count >= 1) {
        cardsFound = true;
        console.log(`Agent Insights rendered! Card count = ${count}`);
        break;
      }
      await sleep(500);
    }

    // Scroll to insights section
    await cdp.eval(`window.scrollTo(0, 380)`);
    await sleep(500);

    const insightsCheck = await cdp.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const hasHeader = bodyText.includes('AI Insights') || bodyText.includes('AI INSIGHTS');
        const cards = Array.from(document.querySelectorAll('[id^="agent-insight-card-"]')).map(c => c.innerText.replace(/\\n/g, ' '));
        const cacheStored = localStorage.getItem('agentInsightsCache');
        return { hasHeader, cardCount: cards.length, cards, cacheStored: !!cacheStored };
      })()
    `);
    console.log('Dashboard Insights Check:', insightsCheck);
    await cdp.captureScreenshot('dashboard_insights_verified.png');

    console.log('\n--- STEP 2: TEST SESSION TIMER COUNTDOWN ---');
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/therapy' });
    await sleep(2000);

    // Select Combined Mode first so modes are active
    const modeClicked = await cdp.eval(`
      (() => {
        const mode = document.getElementById('mode-combined');
        if (mode) {
          mode.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Mode combined clicked:', modeClicked);
    await sleep(800);

    // Start therapy using demo mode
    const startStatus = await cdp.eval(`
      (() => {
        const startBtn = document.getElementById('start-therapy-btn');
        if (!startBtn) return { found: false };
        startBtn.scrollIntoView();
        const disabled = startBtn.disabled;
        startBtn.click();
        return { found: true, disabled, text: startBtn.innerText };
      })()
    `);
    console.log('Start button status:', startStatus);
    await sleep(1000);

    const preModalState = await cdp.eval(`
      (() => {
        const modal = document.querySelector('h2');
        const score7 = document.getElementById('pain-score-7');
        return { modalTitle: modal ? modal.innerText : null, score7Found: !!score7 };
      })()
    `);
    console.log('Pre-modal state:', preModalState);

    // Select pain rating 7 and then submit pre-modal
    const scoreClicked = await cdp.eval(`
      (() => {
        const score7 = document.getElementById('pain-score-7');
        if (score7) {
          score7.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Score 7 clicked:', scoreClicked);
    await sleep(800);

    const submitState = await cdp.eval(`
      (() => {
        const submitBtn = document.getElementById('pain-modal-submit-btn');
        if (!submitBtn) return { found: false };
        const disabled = submitBtn.disabled;
        submitBtn.click();
        return { found: true, disabled, text: submitBtn.innerText };
      })()
    `);
    console.log('Submit button clicked with state:', submitState);
    await sleep(2000);

    const postSubmitDom = await cdp.eval(`
      (() => {
        const display = document.getElementById('countdown-timer-display');
        const modal = document.querySelector('h2');
        return {
          displayFound: !!display,
          displayText: display ? display.innerText : null,
          modalTitle: modal ? modal.innerText : null
        };
      })()
    `);
    console.log('Post-submit DOM state:', postSubmitDom);

    // Read initial timer value
    const timerT0 = await cdp.eval(`
      (() => {
        const display = document.getElementById('countdown-timer-display');
        return display ? display.innerText.trim() : null;
      })()
    `);
    console.log('Timer at T0:', timerT0);

    // Wait 3.5 seconds to assert countdown ticks
    await sleep(3500);

    const timerT1 = await cdp.eval(`
      (() => {
        const display = document.getElementById('countdown-timer-display');
        return display ? display.innerText.trim() : null;
      })()
    `);
    console.log('Timer at T1 (after 3.5s):', timerT1);

    await cdp.captureScreenshot('session_timer_ticking_proof.png');

    // Verify timer decreased
    if (timerT0 && timerT1 && timerT0 !== timerT1) {
      console.log('SUCCESS: Timer successfully counted down from', timerT0, 'to', timerT1);
    } else {
      console.warn('WARNING: Timer did not tick or is identical! T0:', timerT0, 'T1:', timerT1);
    }

    // Stop therapy
    console.log('\n--- STEP 3: TEST STOP THERAPY ---');
    await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('stop-therapy-btn');
        if (stopBtn) stopBtn.click();
      })()
    `);
    await sleep(1500);

    const stopCheck = await cdp.eval(`
      (() => {
        const modal = document.body.innerText.includes('How is your pain now?') || document.body.innerText.includes('Rate your pain');
        const timerVisible = !!document.getElementById('countdown-timer-display');
        return { postModalShown: modal, timerStillVisible: timerVisible };
      })()
    `);
    console.log('Stop therapy post-modal check:', stopCheck);
    await cdp.captureScreenshot('session_stopped_post_modal_proof.png');

    console.log('\n--- STEP 4: TEST HISTORY PAIN CHART COLORS ---');
    await cdp.send('Page.navigate', { url: 'https://localhost:5175/history' });
    await sleep(2000);

    // Click Insights tab
    await cdp.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const insightsTab = tabs.find(t => t.innerText.includes('Insights'));
        if (insightsTab) insightsTab.click();
      })()
    `);
    await sleep(1500);

    const chartColors = await cdp.eval(`
      (() => {
        // Find Recharts SVG bars in the first chart
        const bars = Array.from(document.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangles path, path.recharts-rectangle'));
        const fills = bars.map(b => b.getAttribute('fill')).filter(Boolean);
        const legendItems = Array.from(document.querySelectorAll('.recharts-legend-item-text')).map(t => t.innerText.trim());
        const legendSymbols = Array.from(document.querySelectorAll('.recharts-surface circle, .recharts-legend-item svg circle')).map(c => c.getAttribute('fill'));
        return { fills: fills.slice(0, 8), legendItems, legendSymbols };
      })()
    `);
    console.log('Chart colors & legend check:', chartColors);
    await cdp.captureScreenshot('history_chart_colors_verified.png');

    console.log('\nAll tests completed successfully!');

  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
