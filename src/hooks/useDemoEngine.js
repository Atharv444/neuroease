import { useEffect, useRef, useState } from 'react';

const TRACK_URLS = {
  1: "/audio/ocean.mp3",
  2: "/audio/rain.mp3",
  3: "/audio/binaural.mp3",
  4: "/audio/tone432.mp3",
  5: "/audio/forest.mp3"
};

export default function useDemoEngine(demoMode) {
  const [demoActive, setDemoActive] = useState(false);
  const [demoState, setDemoState] = useState({ vibration: false, light: null, audio: null });
  
  // Refs for tracking Engine state
  const audioRef = useRef(null);
  const vibIntervalRef = useRef(null);
  const lightOverlayRef = useRef(null);

  // Stop Engine Utility
  const stopDemoEngine = () => {
    setDemoActive(false);
    
    // 1. Stop Vibration
    if (vibIntervalRef.current) clearInterval(vibIntervalRef.current);
    if ('vibrate' in navigator) navigator.vibrate(0);
    
    // 2. Stop Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
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
      const tId = intensities.trackId;
      const vol = intensities.audioVolume ?? 50;
      st.audio = tId;
      
      const audioUrl = TRACK_URLS[tId];
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.loop = true;
        audio.volume = vol / 100;
        
        audio.addEventListener('error', () => {
          if (window.toastQueue && window.toastQueue.addToast) {
             window.toastQueue.addToast("Could not load audio. Check your internet connection.", "error");
          } else {
             // Fallback dispatch event if toastQueue isn't available
             window.dispatchEvent(new CustomEvent('neuroease-toast', { detail: { message: "Could not load audio. Check your internet connection.", type: "error" } }));
          }
        });

        audio.play().catch(e => console.error("Audio playback failed", e));
        audioRef.current = audio;
      }
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

  const updateDemoAudio = (trackId, volume) => {
    if (!demoActive) return;
    
    // Update State
    setDemoState(prev => prev.audio ? { ...prev, audio: trackId } : prev);

    if (audioRef.current) {
      audioRef.current.volume = volume / 100;

      // Track switching
      if (audioRef.current.src !== TRACK_URLS[trackId]) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        const newAudio = new Audio(TRACK_URLS[trackId]);
        newAudio.loop = true;
        newAudio.volume = volume / 100;
        
        newAudio.addEventListener('error', () => {
          window.dispatchEvent(new CustomEvent('neuroease-toast', { detail: { message: "Could not load audio. Check your internet connection.", type: "error" } }));
        });
        
        newAudio.play().catch(e => console.error("Audio playback failed", e));
        audioRef.current = newAudio;
      }
    }
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

  return { demoActive, startDemoEngine, stopDemoEngine, updateDemoAudio, demoState };
}
