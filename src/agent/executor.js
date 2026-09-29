// src/agent/executor.js
// Layer 3: Execution (Deterministic Functions)

const TRACK_URLS = {
  1: "/audio/ocean.mp3",
  2: "/audio/rain.mp3",
  3: "/audio/binaural.mp3",
  4: "/audio/tone432.mp3",
  5: "/audio/forest.mp3"
};

export function sanitizeDecision(decision = {}) {
  let reasoning = decision.reasoning;
  if (typeof reasoning !== 'string' || !reasoning.trim()) {
    reasoning = 'Standard therapy applied';
  } else {
    reasoning = reasoning.trim();
    if (reasoning.length > 100) {
      reasoning = reasoning.slice(0, 97) + '...';
    }
  }

  const validModes = ['vibration', 'light', 'audio', 'combined'];
  const mode = validModes.includes(decision.mode) ? decision.mode : 'combined';

  const vibrationIntensity = Math.min(10, Math.max(1, parseInt(decision.vibrationIntensity, 10) || 5));

  const lightColor = {
    r: Math.min(255, Math.max(0, parseInt(decision.lightColor?.r, 10) ?? 100)),
    g: Math.min(255, Math.max(0, parseInt(decision.lightColor?.g, 10) ?? 100)),
    b: Math.min(255, Math.max(0, parseInt(decision.lightColor?.b, 10) ?? 150))
  };

  const audioTrack = Math.min(5, Math.max(1, parseInt(decision.audioTrack, 10) || 1));

  const validDurations = [5, 10, 15, 20, 30];
  const parsedDuration = parseInt(decision.duration, 10);
  const duration = validDurations.includes(parsedDuration) ? parsedDuration : 10;

  return {
    mode,
    vibrationIntensity,
    lightColor,
    audioTrack,
    duration,
    reasoning
  };
}

// Track all active audio instances globally
if (typeof window !== 'undefined') {
  if (!window.__neuroeaseActiveAudios) {
    window.__neuroeaseActiveAudios = new Set();
  }
}

export function sendBLECommand(command) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neuroease-ble-command', { detail: { command } }));
  }
  return true;
}

export function stopDemoTherapy() {
  if (typeof window !== 'undefined') {
    // 1. Stop tracked audio
    if (window.__neuroeaseDemoAudio) {
      try {
        window.__neuroeaseDemoAudio.pause();
        window.__neuroeaseDemoAudio.currentTime = 0;
      } catch (e) {
        console.warn('Audio pause error:', e);
      }
      window.__neuroeaseDemoAudio = null;
    }

    // 2. Stop all audios in global registry
    if (window.__neuroeaseActiveAudios) {
      window.__neuroeaseActiveAudios.forEach(audio => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      });
      window.__neuroeaseActiveAudios.clear();
    }

    // 3. Stop any audio elements in the DOM
    if (typeof document !== 'undefined') {
      try {
        document.querySelectorAll('audio').forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });
      } catch (e) {}
    }

    // 4. Stop vibration loop & cancel vibration
    if (window.__neuroeaseDemoVibInterval) {
      clearInterval(window.__neuroeaseDemoVibInterval);
      window.__neuroeaseDemoVibInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }

    // 5. Remove simulated light overlays from DOM
    if (typeof document !== 'undefined') {
      const overlays = document.querySelectorAll('#demo-light-overlay');
      overlays.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }

    // 6. Broadcast stop event
    window.dispatchEvent(new CustomEvent('neuroease-therapy-stopped'));
  }
}

export function triggerDemoVibration(intensity) {
  if (typeof window === 'undefined') return;
  
  // Clear any existing vibration interval
  if (window.__neuroeaseDemoVibInterval) {
    clearInterval(window.__neuroeaseDemoVibInterval);
    window.__neuroeaseDemoVibInterval = null;
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    let pattern;
    if (intensity <= 3) pattern = [200, 100, 200];
    else if (intensity <= 6) pattern = [400, 150, 400, 150, 400];
    else pattern = [600, 100, 600, 100, 600, 100, 600];
    
    try {
      navigator.vibrate(pattern);
      window.__neuroeaseDemoVibInterval = setInterval(() => {
        navigator.vibrate(pattern);
      }, 2000);
    } catch (e) {
      console.warn('Vibration error:', e);
    }
  }
}

export function triggerDemoLight(colorObj) {
  if (typeof document === 'undefined') return;
  const color = `rgb(${colorObj.r}, ${colorObj.g}, ${colorObj.b})`;
  let overlay = document.getElementById('demo-light-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'demo-light-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '50';
    overlay.style.opacity = '0';
    overlay.style.animation = 'pulseLight 8s infinite';
    document.body.appendChild(overlay);
  }
  overlay.style.backgroundColor = color;
}

export function triggerDemoAudio(trackId) {
  if (typeof window === 'undefined') return;
  
  // Stop any previously playing demo audio first
  stopDemoTherapy();

  const audioUrl = TRACK_URLS[trackId] || TRACK_URLS[1];
  try {
    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.volume = 0.5;
    if (window.__neuroeaseActiveAudios) {
      window.__neuroeaseActiveAudios.add(audio);
      audio.onended = () => { window.__neuroeaseActiveAudios?.delete(audio); };
      audio.onpause = () => { window.__neuroeaseActiveAudios?.delete(audio); };
    }
    audio.play().catch(e => console.warn('Demo audio play prevented:', e));
    window.__neuroeaseDemoAudio = audio;
  } catch (e) {
    console.warn('Demo audio initialization error:', e);
  }
}

export function startSessionTimer(durationMinutes) {
  if (typeof window !== 'undefined') {
    const totalSeconds = durationMinutes * 60;
    window.dispatchEvent(new CustomEvent('neuroease-session-started', {
      detail: { durationMinutes, totalSeconds }
    }));
  }
}

export function saveAISessionToHistory({ safe, symptomsText = '', isDemoMode = false, painBefore = null }) {
  try {
    const history = JSON.parse(localStorage.getItem('neuroHistory') || '[]');
    const newSession = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      duration: safe.duration,
      mode: safe.mode.charAt(0).toUpperCase() + safe.mode.slice(1),
      feedback: null,
      demo: !!isDemoMode,
      painBefore: painBefore,
      painAfter: null,
      aiGenerated: true,
      symptomsText: symptomsText || '',
      aiReasoning: safe.reasoning
    };

    localStorage.setItem('neuroHistory', JSON.stringify([newSession, ...history]));
    window.dispatchEvent(new CustomEvent('neuroease-history-updated', { detail: newSession }));
    return newSession;
  } catch (e) {
    console.error('Failed to save AI session to history:', e);
    return null;
  }
}

export function executeTherapy(decision, isConnected, isDemoMode, options = {}) {
  // Validate decision object has all required fields
  // If any field is missing or out of range, use safe defaults
  const safe = sanitizeDecision(decision);

  if (!options.skipHardwareTriggers) {
    if (isConnected) {
      // Send BLE commands (existing BLE functions)
      const bleSender = options.sendBLECommand || sendBLECommand;
      bleSender(`START_ALL:${safe.vibrationIntensity},${safe.lightColor.r},${safe.lightColor.g},${safe.lightColor.b},${safe.audioTrack}`);
    } else if (isDemoMode) {
      // Trigger existing demo mode functions
      const vibTrigger = options.triggerDemoVibration || triggerDemoVibration;
      const lightTrigger = options.triggerDemoLight || triggerDemoLight;
      const audioTrigger = options.triggerDemoAudio || triggerDemoAudio;

      vibTrigger(safe.vibrationIntensity);
      lightTrigger(safe.lightColor);
      audioTrigger(safe.audioTrack);
    }
  }

  // Start timer with safe.duration
  const timerStarter = options.startSessionTimer || startSessionTimer;
  timerStarter(safe.duration);

  // Save to history unless explicitly skipped
  if (options.saveHistory !== false) {
    saveAISessionToHistory({
      safe,
      symptomsText: options.symptomsText || '',
      isDemoMode,
      painBefore: options.painBefore ?? null
    });
  }

  // Return safe decision for UI display
  return safe;
}
