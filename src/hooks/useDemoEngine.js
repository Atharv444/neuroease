import { useEffect, useRef, useState } from 'react';

// Helpers to generate Audio Buffers for Noise
function createNoiseBuffer(audioCtx, type) {
  const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; 
      b6 = white * 0.115926;
    }
  } else if (type === 'brown') {
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; 
    }
  }
  return buffer;
}

export default function useDemoEngine(demoMode) {
  const [demoActive, setDemoActive] = useState(false);
  const [demoState, setDemoState] = useState({ vibration: false, light: null, audio: null });
  
  // Refs for tracking Engine state
  const audioCtxRef = useRef(null);
  const activeNodesRef = useRef([]);
  const vibIntervalRef = useRef(null);
  const lightOverlayRef = useRef(null);

  // Stop Engine Utility
  const stopDemoEngine = () => {
    setDemoActive(false);
    
    // 1. Stop Vibration
    if (vibIntervalRef.current) clearInterval(vibIntervalRef.current);
    if ('vibrate' in navigator) navigator.vibrate(0);
    
    // 2. Stop Audio & Close Context
    if (audioCtxRef.current) {
      activeNodesRef.current.forEach(node => node.stop && node.stop());
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    activeNodesRef.current = [];
    
    // 3. Stop Light Simulation
    if (lightOverlayRef.current && document.body.contains(lightOverlayRef.current)) {
      document.body.removeChild(lightOverlayRef.current);
      lightOverlayRef.current = null;
    }
  };

  // Start Engine Utility
  const startDemoEngine = (modes, intensities, duration) => {
    setDemoActive(true);
    let st = { vibration: false, light: null, audio: null };

    // === VIBRATION ENGINE ===
    if (modes.vibration) {
      const vLvl = intensities.vibrationIntensity;
      let pattern;
      if (vLvl <= 3) pattern = [200, 100, 200];
      else if (vLvl <= 6) pattern = [400, 150, 400, 150, 400];
      else pattern = [600, 100, 600, 100, 600, 100, 600];

      st.vibration = true;

      // Start looping interval for vibration
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
        vibIntervalRef.current = setInterval(() => {
          navigator.vibrate(pattern);
        }, 2000);
      } else {
        st.vibration = "NOT_SUPPORTED";
      }
    }

    // === AUDIO ENGINE ===
    if (modes.audio) {
      st.audio = intensities.trackId;
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.5; // Fixed medium volume simulation mapping
      masterGain.connect(ctx.destination);
      
      const tId = intensities.trackId;
      
      if (tId === 1 || tId === 2 || tId === 5) {
        // Noise generators
        const noiseType = tId === 1 ? 'brown' : (tId === 2 ? 'white' : 'pink');
        const buffer = createNoiseBuffer(ctx, noiseType);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        
        // Filter it a bit if rain/ocean to simulate softness
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = tId === 2 ? 8000 : 400; // Rain higher, Ocean lower
        
        source.connect(filter);
        filter.connect(masterGain);
        source.start();
        activeNodesRef.current.push(source);
      } 
      else if (tId === 3) {
        // Binaural 200/210Hz
        const leftOsc = ctx.createOscillator();
        const rightOsc = ctx.createOscillator();
        leftOsc.frequency.value = 200;
        rightOsc.frequency.value = 210;
        
        const leftPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
        const rightPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
        if (leftPan.pan) {
          leftPan.pan.value = -1;
          rightPan.pan.value = 1;
        }
        
        leftOsc.connect(leftPan);
        rightOsc.connect(rightPan);
        leftPan.connect(masterGain);
        rightPan.connect(masterGain);
        
        leftOsc.start();
        rightOsc.start();
        activeNodesRef.current.push(leftOsc, rightOsc);
      }
      else if (tId === 4) {
        // 432Hz Single Tone
        const osc = ctx.createOscillator();
        osc.frequency.value = 432;
        const lowGain = ctx.createGain();
        lowGain.gain.value = 0.3; // Low gain so gentle
        
        osc.connect(lowGain);
        lowGain.connect(masterGain);
        osc.start();
        activeNodesRef.current.push(osc);
      }
      
      ctx.resume();
    }

    // === LIGHT ENGINE ===
    if (modes.light) {
      const color = `rgb(${intensities.r}, ${intensities.g}, ${intensities.b})`;
      st.light = color;
      
      const overlay = document.createElement("div");
      overlay.id = "demo-light-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "50"; // Above background, below content
      overlay.style.backgroundColor = color;
      overlay.style.opacity = "0";
      overlay.style.animation = "pulseLight 8s infinite";
      
      if (!document.getElementById('demo-style')) {
        const style = document.createElement('style');
        style.id = 'demo-style';
        style.innerHTML = `
          @keyframes pulseLight {
            0% { opacity: 0; }
            50% { opacity: 0.15; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(overlay);
      lightOverlayRef.current = overlay;
    }
    
    setDemoState(st);
  };

  // Cleanup on unmount or disable
  useEffect(() => {
    if (!demoMode) {
      stopDemoEngine();
    }
    return () => {
      stopDemoEngine();
    }
  }, [demoMode]);

  return { demoActive, startDemoEngine, stopDemoEngine, demoState };
}
