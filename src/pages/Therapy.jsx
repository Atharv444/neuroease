import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBluetooth } from '../context/BluetoothContext';
import { useToast } from '../context/ToastContext';
import useDemoEngine from '../hooks/useDemoEngine';
import { stopDemoTherapy, triggerDemoVibration, triggerDemoLight, sendBLECommand } from '../agent/executor';
import { getMidSessionAdjustment } from '../agent/orchestrator';
import { Play, Square, Activity, Lightbulb, Music, Layers, X, ArrowLeft, Zap } from 'lucide-react';

export default function Therapy() {
  const location = useLocation();
  const { isConnected, startTherapy, stopTherapy, sessionActive: bleSessionActive, demoMode } = useBluetooth();
  const { addToast } = useToast();
  const { demoActive, startDemoEngine, stopDemoEngine, updateDemoAudio, demoState } = useDemoEngine(demoMode);

  const [sessionActive, setSessionActive] = useState(false);
  const [duration, setDuration] = useState(10);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const intervalRef = useRef(null);

  // Global listener for Audio Engine Toasts and global stop events
  useEffect(() => {
    const handleToast = (e) => addToast(e.detail.message, e.detail.type);
    const handleGlobalStop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimeLeft(0);
      setSessionActive(false);
      checkinShown.current = false;
      setShowCheckinModal(false);
      setIsCountdownPaused(false);
    };

    window.addEventListener('neuroease-toast', handleToast);
    window.addEventListener('neuroease-therapy-stopped', handleGlobalStop);
    const handleTestSetTimer = (e) => {
      if (typeof e.detail === 'number') {
        setTimeLeft(e.detail);
        setSessionActive(true);
      }
    };
    window.addEventListener('neuroease-test-set-timer', handleTestSetTimer);
    return () => {
      window.removeEventListener('neuroease-toast', handleToast);
      window.removeEventListener('neuroease-therapy-stopped', handleGlobalStop);
      window.removeEventListener('neuroease-test-set-timer', handleTestSetTimer);
    };
  }, [addToast]);
  
  const [modes, setModes] = useState({ vibration: false, light: false, audio: false });
  const [vibrationIntensity, setIntensity] = useState(5);
  const [lightColor, setLightColor] = useState({ r: 255, g: 255, b: 255 });
  const [trackId, setTrackId] = useState(1);
  const [audioVolume, setAudioVolume] = useState(50);
  
  const [showPreModal, setShowPreModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [painBefore, setPainBefore] = useState(null);
  const [painAfter, setPainAfter] = useState(null);
  const [aiSessionInfo, setAiSessionInfo] = useState(null);

  // Mid-Session Check-in state & ref (triggers for ALL sessions)
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const showMidCheckin = showCheckinModal;
  const setShowMidCheckin = setShowCheckinModal;

  const checkinShown = useRef(false);
  const hasCheckedMidRef = checkinShown;
  const [isCountdownPaused, setIsCountdownPaused] = useState(false);
  const [agentAdapted, setAgentAdapted] = useState(false);
  const autoDismissTimerRef = useRef(null);

  useEffect(() => {
    if (location.state?.preset) {
      checkinShown.current = false;
      setAgentAdapted(false);
      setShowCheckinModal(false);
      setIsCountdownPaused(false);

      const p = location.state.preset;
      const effectiveModes = p.modes || { vibration: true, light: true, audio: true };
      const effectiveIntensity = p.vibrationIntensity ?? 5;
      const effectiveDuration = p.duration ?? 10;
      const effectiveTrackId = p.trackId ?? 1;
      const effectiveLight = p.lightColor ?? { r: 80, g: 0, b: 0 };

      if (p.modes) setModes(p.modes);
      if (p.vibrationIntensity != null) setIntensity(p.vibrationIntensity);
      if (p.duration != null) setDuration(p.duration);
      if (p.trackId != null) setTrackId(p.trackId);
      if (p.lightColor != null) setLightColor(p.lightColor);

      if (location.state.aiGenerated) {
        setAiSessionInfo({
          reasoning: location.state.aiReasoning,
          symptoms: location.state.symptomsText
        });
      }

      if (location.state.autoStart) {
        // Clear autoStart flag from history state so subsequent renders or navigations don't restart therapy
        try {
          if (window.history.state && window.history.state.usr) {
            window.history.replaceState({
              ...window.history.state,
              usr: { ...window.history.state.usr, autoStart: false }
            }, document.title);
          }
        } catch (e) {}

        setTimeLeft(effectiveDuration * 60);
        setSessionActive(true);
        if (demoMode) {
          startDemoEngine(effectiveModes, {
            vibrationIntensity: effectiveIntensity,
            audioVolume,
            r: effectiveLight.r,
            g: effectiveLight.g,
            b: effectiveLight.b,
            trackId: effectiveTrackId
          }, effectiveDuration);
          addToast('AI Therapy session active on this device', 'success');
        } else if (isConnected) {
          startTherapy(effectiveModes, {
            vibrationIntensity: effectiveIntensity,
            r: effectiveLight.r,
            g: effectiveLight.g,
            b: effectiveLight.b,
            trackId: effectiveTrackId
          });
          addToast('AI Therapy session started on glasses', 'success');
        } else {
          // If neither BLE is connected nor demoMode toggled, still start simulation so user gets full therapy experience
          startDemoEngine(effectiveModes, {
            vibrationIntensity: effectiveIntensity,
            audioVolume,
            r: effectiveLight.r,
            g: effectiveLight.g,
            b: effectiveLight.b,
            trackId: effectiveTrackId
          }, effectiveDuration);
          addToast('AI Therapy session active in simulation mode', 'info');
        }
      }
    }
  }, [location.state]);

  // Sync timeLeft when duration selector changes and no session is active
  useEffect(() => {
    if (!sessionActive) {
      setTimeLeft(duration * 60);
    }
  }, [duration, sessionActive]);

  useEffect(() => {
    if (!sessionActive) return;
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (isCountdownPaused) return prev;
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          handleSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [sessionActive, isCountdownPaused]);

  // Mid-Session Check-in Monitor (triggers for ALL therapy sessions at halfway point)
  const halfwayPoint = Math.floor((duration * 60) / 2);

  useEffect(() => {
    if (!sessionActive) return;
    if (checkinShown.current) return;
    
    if (timeLeft === halfwayPoint || (timeLeft <= halfwayPoint && timeLeft >= halfwayPoint - 1)) {
      setShowCheckinModal(true);
      checkinShown.current = true;
      setIsCountdownPaused(true);
    }
  }, [timeLeft, sessionActive, halfwayPoint]);

  // Auto-dismiss modal after 30 seconds if user ignores
  useEffect(() => {
    if (showMidCheckin) {
      autoDismissTimerRef.current = setTimeout(() => {
        setShowMidCheckin(false);
        setIsCountdownPaused(false);
      }, 30000);
    } else {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    }
    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [showMidCheckin]);

  useEffect(() => {
    if (demoMode && demoActive && modes.audio) {
      updateDemoAudio(trackId, audioVolume);
    }
  }, [trackId, audioVolume, demoActive, demoMode, modes.audio]);

  const selectMode = (mode) => {
    if (mode === 'vibration') {
      setModes({ vibration: true, light: false, audio: false });
    } else if (mode === 'light') {
      setModes({ vibration: false, light: true, audio: false });
    } else if (mode === 'audio') {
      setModes({ vibration: false, light: false, audio: true });
    } else if (mode === 'combined') {
      setModes({ vibration: true, light: true, audio: true });
    }
  };

  const saveToHistory = (before, after) => {
    const history = JSON.parse(localStorage.getItem('neuroHistory')) || [];
    const modeName = 
      (modes.vibration && modes.light && modes.audio) ? 'Combined' :
      (modes.vibration && !modes.light && !modes.audio) ? 'Vibration' :
      (modes.audio && !modes.light && !modes.vibration) ? 'Audio' :
      (modes.light && !modes.vibration && !modes.audio) ? 'Light' : 'Custom';

    const newSession = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }),
      duration,
      mode: modeName,
      feedback: null,
      demo: demoMode,
      painBefore: before,
      painAfter: after,
      ...(aiSessionInfo ? {
        aiGenerated: true,
        symptomsText: aiSessionInfo.symptoms || '',
        aiReasoning: aiSessionInfo.reasoning || ''
      } : {}),
      ...(agentAdapted ? { agentAdapted: true } : {})
    };

    localStorage.setItem('neuroHistory', JSON.stringify([newSession, ...history]));
  };

  const startTherapyEngine = () => {
    hasCheckedMidRef.current = false;
    setAgentAdapted(false);
    setShowMidCheckin(false);
    setIsCountdownPaused(false);
    setTimeLeft(duration * 60);
    setSessionActive(true);

    if (demoMode) {
      startDemoEngine(modes, { vibrationIntensity, audioVolume, r: lightColor.r, g: lightColor.g, b: lightColor.b, trackId }, duration);
      addToast('Demo Therapy started on this device', 'info');
    } else {
      startTherapy(modes, { vibrationIntensity, r: lightColor.r, g: lightColor.g, b: lightColor.b, trackId });
    }
  };

  const handleStart = () => {
    if (!demoMode && !isConnected) return;
    if (painBefore === null) {
      setShowPreModal(true);
      return;
    }
    startTherapyEngine();
  };

  const handlePreModalSubmit = (val) => {
    setPainBefore(val);
    setShowPreModal(false);
    startTherapyEngine();
  };

  // Loop 3: Mid-session Check-in Handlers
  const handleMidBetter = () => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    setShowMidCheckin(false);
    setIsCountdownPaused(false);
    addToast("Great! Keeping current settings.", "success");
  };

  const handleMidSame = async () => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    setShowMidCheckin(false);
    setIsCountdownPaused(false);

    try {
      const minutesRun = Math.max(1, Math.round((duration * 60 - timeLeft) / 60));
      const currentModeName = 
        (modes.vibration && modes.light && modes.audio) ? 'combined' :
        (modes.vibration && !modes.light && !modes.audio) ? 'vibration' :
        (modes.audio && !modes.light && !modes.vibration) ? 'audio' :
        (modes.light && !modes.vibration && !modes.audio) ? 'light' : 'combined';

      const adj = await getMidSessionAdjustment({
        minutesRun,
        mode: currentModeName,
        vibrationIntensity
      }, 'same');

      if (adj) {
        setAgentAdapted(true);
        if (adj.action === 'increase_vibration') {
          const newIntensity = Math.min(10, Math.max(1, parseInt(adj.newValue, 10) || (vibrationIntensity + 2)));
          setIntensity(newIntensity);
          setModes(prev => ({ ...prev, vibration: true }));
          if (demoMode) {
            triggerDemoVibration(newIntensity);
          } else if (isConnected) {
            sendBLECommand(`VIB_SET:${newIntensity}`);
          }
        } else if (adj.action === 'switch_audio') {
          const newTrack = Math.min(5, Math.max(1, parseInt(adj.newValue, 10) || 3));
          setTrackId(newTrack);
          setModes(prev => ({ ...prev, audio: true }));
          if (demoMode) {
            updateDemoAudio(newTrack, audioVolume);
          } else if (isConnected) {
            sendBLECommand(`AUDIO_TRACK:${newTrack}`);
          }
        } else if (adj.action === 'add_light') {
          setModes(prev => ({ ...prev, light: true }));
          if (demoMode) {
            triggerDemoLight(lightColor);
          } else if (isConnected) {
            sendBLECommand(`LIGHT_RGB:${lightColor.r},${lightColor.g},${lightColor.b}`);
          }
        }
        addToast(adj.message || 'Settings adjusted for better relief.', 'info');
      }
    } catch (err) {
      console.warn('Mid-session adjustment error:', err);
    }
  };

  const handleMidWorse = async () => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    setShowMidCheckin(false);
    setIsCountdownPaused(false);

    try {
      const minutesRun = Math.max(1, Math.round((duration * 60 - timeLeft) / 60));
      const currentModeName = 
        (modes.vibration && modes.light && modes.audio) ? 'combined' :
        (modes.vibration && !modes.light && !modes.audio) ? 'vibration' :
        (modes.audio && !modes.light && !modes.vibration) ? 'audio' :
        (modes.light && !modes.vibration && !modes.audio) ? 'light' : 'combined';

      const adj = await getMidSessionAdjustment({
        minutesRun,
        mode: currentModeName,
        vibrationIntensity
      }, 'worse');

      if (adj && adj.action === 'switch_mode') {
        setAgentAdapted(true);
        // 1. Stop current therapy
        stopDemoEngine();
        stopDemoTherapy();
        stopTherapy();

        // 2. Prepare new settings
        const newMode = adj.newMode || 'audio';
        const newModes = {
          vibration: newMode === 'vibration' || newMode === 'combined',
          light: newMode === 'light' || newMode === 'combined',
          audio: newMode === 'audio' || newMode === 'combined'
        };
        const newVib = Math.min(10, Math.max(1, parseInt(adj.newVibration, 10) || 2));
        const newL = adj.newLight || { r: 60, g: 0, b: 0 };
        const newLight = {
          r: Math.min(255, Math.max(0, parseInt(newL.r, 10) || 60)),
          g: Math.min(255, Math.max(0, parseInt(newL.g, 10) || 0)),
          b: Math.min(255, Math.max(0, parseInt(newL.b, 10) || 0))
        };
        const newAud = Math.min(5, Math.max(1, parseInt(adj.newAudio, 10) || 2));

        setModes(newModes);
        setIntensity(newVib);
        setLightColor(newLight);
        setTrackId(newAud);

        // 3. Execute new settings immediately
        const remainingSeconds = timeLeft > 0 ? timeLeft : Math.floor((duration * 60) / 2);
        const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));

        if (demoMode) {
          startDemoEngine(newModes, {
            vibrationIntensity: newVib,
            audioVolume,
            r: newLight.r,
            g: newLight.g,
            b: newLight.b,
            trackId: newAud
          }, remainingMinutes);
        } else if (isConnected) {
          startTherapy(newModes, {
            vibrationIntensity: newVib,
            r: newLight.r,
            g: newLight.g,
            b: newLight.b,
            trackId: newAud
          });
        } else {
          startDemoEngine(newModes, {
            vibrationIntensity: newVib,
            audioVolume,
            r: newLight.r,
            g: newLight.g,
            b: newLight.b,
            trackId: newAud
          }, remainingMinutes);
        }

        addToast(adj.message || 'Switched therapy mode to ease discomfort.', 'info');
      }
    } catch (err) {
      console.warn('Mid-session switch mode error:', err);
    }
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setTimeLeft(0);
    setSessionActive(false);

    // Dismiss any active mid check-in and reset timer
    setShowCheckinModal(false);
    setIsCountdownPaused(false);
    checkinShown.current = false;
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    // 1. Unconditionally stop all demo engine playback, intervals, DOM overlays
    stopDemoEngine();
    stopDemoTherapy();

    // 2. Stop Bluetooth hardware
    stopTherapy();

    // 3. Clear autoStart from window history state to prevent restarts
    try {
      if (window.history.state && window.history.state.usr) {
        window.history.replaceState({
          ...window.history.state,
          usr: { ...window.history.state.usr, autoStart: false }
        }, document.title);
      }
    } catch (e) {}

    addToast('Therapy stopped. Please rate your pain.', 'info');
    setShowPostModal(true);
  };

  const handleSessionEnd = () => {
    handleStop();
  };

  const handlePostModalSubmit = (val) => {
    setPainAfter(val);
    saveToHistory(painBefore, val);
    setShowPostModal(false);
    setPainBefore(null);
    setPainAfter(null);
    setAiSessionInfo(null);
    setAgentAdapted(false);
    hasCheckedMidRef.current = false;
  };

  const handlePostModalDismiss = () => {
    setShowPostModal(false);
    setPainBefore(null);
    setPainAfter(null);
    setAiSessionInfo(null);
    setAgentAdapted(false);
    hasCheckedMidRef.current = false;
  };

  const minutes = Math.floor(timeLeft / 60)
    .toString().padStart(2, '0');
  const seconds = (timeLeft % 60)
    .toString().padStart(2, '0');

  const isRunning = sessionActive;

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Therapy Control</h1>
      </header>

      {/* ======================================================== */}
      {/* 1. ACTIVE SESSION HUD (DISPLAYED WHEN THERAPY IS RUNNING) */}
      {/* ======================================================== */}
      {isRunning ? (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          padding: '24px 20px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          marginBottom: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Status Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                display: 'inline-block',
                boxShadow: '0 0 10px var(--color-success)',
                animation: 'pulseDot 1.5s infinite ease-in-out'
              }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)', letterSpacing: '0.6px' }}>
                SESSION IN PROGRESS
              </span>
            </div>

            {aiSessionInfo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  backgroundColor: 'var(--color-primary-glow)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🤖 AI Therapy Plan
                </span>
                {agentAdapted && (
                  <span style={{
                    backgroundColor: 'rgba(232, 168, 56, 0.15)',
                    color: '#E8A838',
                    border: '1px solid rgba(232, 168, 56, 0.3)',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    ⚡ Adapted
                  </span>
                )}
              </div>
            ) : (
              <span style={{
                backgroundColor: 'var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '12px'
              }}>
                {demoMode ? '🧪 Demo Device' : 'Connected Device'}
              </span>
            )}
          </div>

          {/* Circular Countdown Clock Display */}
          <div style={{ textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="200" height="200" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                {/* Background Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  stroke="var(--border-color)"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progress Arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  stroke="var(--color-primary)"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 85}
                  strokeDashoffset={
                    2 * Math.PI * 85 * (1 - (duration * 60 > 0 ? (timeLeft / (duration * 60)) : 0))
                  }
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.8s linear' }}
                />
              </svg>

              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div id="countdown-timer-display" style={{
                  fontSize: '44px',
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  color: 'var(--color-primary)',
                  letterSpacing: '2px',
                  textShadow: '0 0 25px var(--color-primary-glow)'
                }}>
                  {`${minutes}:${seconds}`}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '2px' }}>
                  Remaining
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
              {duration} min session • {Math.ceil(timeLeft / 60)} min left
            </div>
          </div>

          {/* Active Settings Grid */}
          <div>
            <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              CURRENT SESSION SETTINGS
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              backgroundColor: 'var(--bg-main)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              {/* Therapy Mode */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Therapy Mode</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {modes.vibration && modes.light && modes.audio ? '✨ Combined' : (modes.vibration ? '📳 Vibration' : (modes.light ? '💡 Light' : '🎵 Audio'))}
                </span>
              </div>

              {/* Vibration Intensity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vibration</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: modes.vibration ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                    {modes.vibration ? `Level ${vibrationIntensity}/10` : 'Off'}
                  </span>
                  {modes.vibration && (
                    <div style={{ width: '40px', height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(vibrationIntensity / 10) * 100}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Light Color */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Light Spectrum</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {modes.light ? (
                    <>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: `rgb(${lightColor.r}, ${lightColor.g}, ${lightColor.b})`,
                        boxShadow: `0 0 8px rgb(${lightColor.r}, ${lightColor.g}, ${lightColor.b})`,
                        border: '1px solid white'
                      }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'monospace' }}>
                        rgb({lightColor.r},{lightColor.g},{lightColor.b})
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Off</span>
                  )}
                </div>
              </div>

              {/* Audio Soundtrack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audio Track</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: modes.audio ? 'var(--color-accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {modes.audio ? (['🌊 Ocean Waves', '🌧️ Rain Sounds', '🎵 Binaural Beats', '🧘 432Hz Tone', '🌿 Forest Ambient'][trackId - 1] || `Track ${trackId}`) : 'Off'}
                </span>
              </div>
            </div>
          </div>

          {/* AI Reasoning if available */}
          {aiSessionInfo?.reasoning && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 106, 247, 0.08)',
              border: '1px dashed var(--color-primary)',
              fontSize: '13px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              lineHeight: 1.4
            }}>
              💡 {aiSessionInfo.reasoning}
            </div>
          )}

          {/* Stop Button */}
          <button
            id="stop-therapy-btn"
            onClick={handleStop}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'transparent',
              color: 'var(--color-danger)',
              border: '2px solid var(--color-danger)',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 15px rgba(232, 85, 85, 0.25)',
              cursor: 'pointer'
            }}
          >
            <Square fill="currentColor" size={18} />
            STOP THERAPY
          </button>
        </div>
      ) : (
        /* ======================================================== */
        /* 2. MANUAL CONTROLS (DISPLAYED WHEN NO THERAPY RUNNING)  */
        /* ======================================================== */
        <>
          {/* Mode Selector */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>SELECT MODE</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <ModeCard id="mode-vibration" active={modes.vibration && !modes.light && !modes.audio} icon={<Activity />} title="Vibration" onClick={() => selectMode('vibration')} />
              <ModeCard id="mode-light" active={modes.light && !modes.vibration && !modes.audio} icon={<Lightbulb />} title="Light" onClick={() => selectMode('light')} />
              <ModeCard id="mode-audio" active={modes.audio && !modes.light && !modes.vibration} icon={<Music />} title="Audio" onClick={() => selectMode('audio')} />
              <ModeCard id="mode-combined" active={modes.vibration && modes.light && modes.audio} icon={<Layers />} title="Combined" onClick={() => selectMode('combined')} />
            </div>
          </section>

          {/* Intensity Controls */}
          {modes.vibration && (
            <section style={{ marginBottom: '24px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600 }}>Vibration Intensity</span>
                <span style={{ color: 'var(--color-primary)' }}>{vibrationIntensity}/10</span>
              </div>
              <input 
                type="range" min="1" max="10" 
                value={vibrationIntensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span>Low</span><span>Medium</span><span>High</span>
              </div>
            </section>
          )}

          {modes.audio && (
            <section style={{ marginBottom: '24px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)' }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '12px' }}>Audio Track</span>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px' }}>
                {['🌊 Ocean', '🌧️ Rain', '🎵 Binaural', '🧘 432Hz', '🌿 Forest'].map((t, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setTrackId(idx + 1)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      whiteSpace: 'nowrap',
                      backgroundColor: trackId === idx+1 ? 'var(--color-primary)' : 'var(--bg-main)',
                      color: trackId === idx+1 ? 'white' : 'var(--text-primary)',
                      border: `1px solid ${trackId === idx+1 ? 'var(--color-primary)' : 'var(--border-color)'}`
                    }}
                  >{t}</button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', marginTop: '8px' }}>
                <span style={{ fontWeight: 600 }}>Volume</span>
                <span style={{ color: 'var(--color-primary)' }}>{audioVolume}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={audioVolume}
                onChange={(e) => setAudioVolume(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
            </section>
          )}

          {/* Duration Selector */}
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>DURATION (MINUTES)</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[5, 10, 15, 20, 30].map(m => (
                 <button 
                  key={m}
                  onClick={() => setDuration(m)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '20px',
                    backgroundColor: duration === m ? 'var(--color-accent)' : 'var(--bg-card)',
                    color: duration === m ? '#000' : 'var(--text-primary)',
                    fontWeight: 600,
                    border: '1px solid var(--border-color)'
                  }}
                 >{m}</button>
              ))}
            </div>
          </section>

          {/* Main Action Button */}
          <button
            id="start-therapy-btn"
            onClick={handleStart}
            disabled={(!demoMode && !isConnected) || (!modes.vibration && !modes.light && !modes.audio)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              opacity: (demoMode || isConnected) ? 1 : 0.5,
              cursor: (demoMode || isConnected) ? 'pointer' : 'not-allowed'
            }}
          >
            <Play fill="currentColor" size={20} />
            {demoMode ? 'START DEMO THERAPY' : (isConnected ? 'START THERAPY' : 'Connect Device First')}
          </button>
        </>
      )}

      {/* CSS Animation for pulseDot */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.3); }
        }
      `}</style>


      {showPreModal && (
        <PainModal 
          title="How is your pain right now?" 
          subtitle="Rate your pain level before therapy" 
          buttonText="Start Therapy"
          cancelText="Cancel"
          onSubmit={handlePreModalSubmit}
          onDismiss={() => setShowPreModal(false)}
        />
      )}

      {showPostModal && (
        <PainModal 
          title="How is your pain now?" 
          subtitle="Rate your pain level after therapy" 
          buttonText="Save Session"
          cancelText="Skip for now"
          onSubmit={handlePostModalSubmit}
          onDismiss={handlePostModalDismiss}
        />
      )}

      {/* Loop 3: Mid-Session Quick Check-in Modal */}
      {showMidCheckin && (
        <MidSessionCheckinModal 
          onBetter={handleMidBetter}
          onSame={handleMidSame}
          onWorse={handleMidWorse}
          onDismiss={() => {
            setShowMidCheckin(false);
            setIsCountdownPaused(false);
          }}
        />
      )}
    </div>
  );
}

function PainModal({ title, subtitle, buttonText, cancelText, onSubmit, onDismiss }) {
  const [selected, setSelected] = useState(null);

  const getColor = (num) => {
    if (num <= 3) return '#4CAF82';
    if (num <= 6) return '#E8A838';
    return '#E85555';
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && onDismiss) {
          onDismiss();
        }
      }}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex',
        justifyContent: 'center', alignItems: 'center', padding: '16px'
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-main)', width: '100%', maxWidth: '400px',
        borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', textAlign: 'center',
        margin: '0 16px', position: 'relative'
      }}>
        {/* Top-Right Close X Button */}
        {onDismiss && (
          <button
            type="button"
            id="pain-modal-close-btn"
            onClick={onDismiss}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-card)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        <h2 style={{ fontSize: '20px', marginBottom: '8px', paddingRight: onDismiss ? '20px' : 0 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>{subtitle}</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', marginBottom: '32px' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(num => {
            const color = getColor(num);
            const isSelected = selected === num;
            return (
              <button
                key={num}
                id={`pain-score-${num}`}
                type="button"
                onClick={() => setSelected(num)}
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  border: isSelected ? `2px solid ${color}` : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'transparent' : 'var(--bg-card)',
                  color: isSelected ? color : 'var(--text-primary)',
                  fontWeight: 'bold', fontSize: '14px',
                  boxShadow: isSelected ? `0 0 12px ${color}80` : 'none',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  padding: 0
                }}
              >
                {num}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          id="pain-modal-submit-btn"
          onClick={() => onSubmit(selected)}
          disabled={selected === null}
          style={{
            width: '100%', padding: '16px', borderRadius: 'var(--radius-btn)',
            backgroundColor: selected === null ? 'var(--bg-card)' : 'var(--color-primary)',
            color: selected === null ? 'var(--text-muted)' : 'white',
            fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: selected === null ? 'not-allowed' : 'pointer'
          }}
        >
          {buttonText}
        </button>

        {/* Back / Cancel Button */}
        {onDismiss && (
          <button
            type="button"
            id="pain-modal-cancel-btn"
            onClick={onDismiss}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-btn)',
              marginTop: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ArrowLeft size={16} />
            {cancelText || 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}

function MidSessionCheckinModal({ onBetter, onSame, onWorse, onDismiss }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '0 16px 24px',
      animation: 'fadeIn 0.25s ease'
    }}>
      <div style={{
        backgroundColor: '#13131A',
        width: '100%',
        maxWidth: '440px',
        borderRadius: '24px',
        padding: '24px 20px',
        border: '1px solid #1E1E2E',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary-glow)',
              color: 'var(--color-primary)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              marginBottom: '6px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                display: 'inline-block'
              }} />
              Therapy Running
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#FFFFFF' }}>
              Quick Check-in 🤖
            </h3>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
            aria-label="Dismiss Check-in"
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>
          How's the pain compared to when you started?
        </p>

        {/* 3 Large Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            id="mid-checkin-better"
            type="button"
            onClick={onBetter}
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: 'rgba(76, 175, 130, 0.12)',
              border: '1px solid rgba(76, 175, 130, 0.35)',
              color: '#4CAF82',
              fontSize: '17px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 130, 0.22)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 130, 0.12)'}
          >
            <span>😌 Better</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(76, 175, 130, 0.8)' }}>Keep settings</span>
          </button>

          <button
            id="mid-checkin-same"
            type="button"
            onClick={onSame}
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: 'rgba(124, 106, 247, 0.12)',
              border: '1px solid rgba(124, 106, 247, 0.35)',
              color: 'var(--color-primary)',
              fontSize: '17px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(124, 106, 247, 0.22)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(124, 106, 247, 0.12)'}
          >
            <span>😐 Same</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)' }}>Agent fine-tunes</span>
          </button>

          <button
            id="mid-checkin-worse"
            type="button"
            onClick={onWorse}
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: 'rgba(235, 87, 87, 0.12)',
              border: '1px solid rgba(235, 87, 87, 0.35)',
              color: '#EB5757',
              fontSize: '17px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(235, 87, 87, 0.22)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(235, 87, 87, 0.12)'}
          >
            <span>😟 Worse</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(235, 87, 87, 0.8)' }}>Switch mode</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          Auto-continuing in 30 seconds if unanswered
        </div>
      </div>
    </div>
  );
}

function ModeCard({ id, active, icon, title, onClick }) {
  return (
    <div 
      id={id}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        padding: '16px',
        minHeight: '80px',
        borderRadius: 'var(--radius-card)',
        border: `2px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
        cursor: 'pointer',
        position: 'relative',
        zIndex: 1,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: active ? '0 0 12px var(--color-primary-glow)' : 'none',
        transition: 'var(--transition)'
      }}
    >
      <div style={{ color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        {icon}
      </div>
      <span style={{ fontWeight: 500, fontSize: '14px', color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {title}
      </span>
    </div>
  )
}
