import { useEffect, useRef, useState } from 'react';
import { stopDemoTherapy } from '../agent/executor';

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

  // Internal cleanup without broadcasting global stop
  const cleanupDemoAudioAndVisuals = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }

    if (vibIntervalRef.current) {
      clearInterval(vibIntervalRef.current);
      vibIntervalRef.current = null;
    }

    if (lightOverlayRef.current && document.body.contains(lightOverlayRef.current)) {
      document.body.removeChild(lightOverlayRef.current);
      lightOverlayRef.current = null;
    }
  };

  // Stop Engine Utility
  const stopDemoEngine = () => {
    setDemoActive(false);
    cleanupDemoAudioAndVisuals();
    // Call unified stopDemoTherapy to guarantee all global audios, DOM audios, intervals and overlays are destroyed
    stopDemoTherapy();
  };

  // Start Engine Utility
  const startDemoEngine = (modes, intensities, duration) => {
    // Ensure any previous audio/demo state is cleaned up first without broadcasting stop event
    cleanupDemoAudioAndVisuals();
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

        if (typeof window !== 'undefined') {
          if (!window.__neuroeaseActiveAudios) window.__neuroeaseActiveAudios = new Set();
          window.__neuroeaseActiveAudios.add(audio);
          window.__neuroeaseDemoAudio = audio;
          audio.onended = () => { window.__neuroeaseActiveAudios?.delete(audio); };
          audio.onpause = () => { window.__neuroeaseActiveAudios?.delete(audio); };
        }

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
      const targetPath = TRACK_URLS[trackId];
      if (targetPath && !audioRef.current.src.endsWith(targetPath)) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {}
        
        const newAudio = new Audio(targetPath);
        newAudio.loop = true;
        newAudio.volume = volume / 100;
        
        if (typeof window !== 'undefined') {
          if (!window.__neuroeaseActiveAudios) window.__neuroeaseActiveAudios = new Set();
          window.__neuroeaseActiveAudios.add(newAudio);
          window.__neuroeaseDemoAudio = newAudio;
          newAudio.onended = () => { window.__neuroeaseActiveAudios?.delete(newAudio); };
          newAudio.onpause = () => { window.__neuroeaseActiveAudios?.delete(newAudio); };
        }

        newAudio.addEventListener('error', () => {
          window.dispatchEvent(new CustomEvent('neuroease-toast', { detail: { message: "Could not load audio. Check your internet connection.", type: "error" } }));
        });
        
        newAudio.play().catch(e => console.error("Audio playback failed", e));
        audioRef.current = newAudio;
      }
    }
  };

  // Sync with global therapy stop event
  useEffect(() => {
    const handleGlobalStop = () => {
      setDemoActive(false);
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {}
        audioRef.current = null;
      }
      if (vibIntervalRef.current) {
        clearInterval(vibIntervalRef.current);
        vibIntervalRef.current = null;
      }
      if (lightOverlayRef.current && document.body.contains(lightOverlayRef.current)) {
        document.body.removeChild(lightOverlayRef.current);
        lightOverlayRef.current = null;
      }
    };

    window.addEventListener('neuroease-therapy-stopped', handleGlobalStop);
    return () => window.removeEventListener('neuroease-therapy-stopped', handleGlobalStop);
  }, []);

  // Cleanup on unmount or disable
  useEffect(() => {
    if (!demoMode) {
      stopDemoEngine();
    }
    return () => {
      stopDemoEngine();
    };
  }, [demoMode]);

  return { demoActive, startDemoEngine, stopDemoEngine, updateDemoAudio, demoState };
}
