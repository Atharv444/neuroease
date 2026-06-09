import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useBluetooth } from '../context/BluetoothContext';
import { useToast } from '../context/ToastContext';
import useDemoEngine from '../hooks/useDemoEngine';
import { Play, Square, Activity, Lightbulb, Music, Layers } from 'lucide-react';

export default function Therapy() {
  const location = useLocation();
  const { isConnected, startTherapy, stopTherapy, sessionActive, demoMode } = useBluetooth();
  const { addToast } = useToast();
  const { demoActive, startDemoEngine, stopDemoEngine, updateDemoAudio, demoState } = useDemoEngine(demoMode);

  // Global listener for Audio Engine Toasts
  useEffect(() => {
    const handleToast = (e) => addToast(e.detail.message, e.detail.type);
    window.addEventListener('neuroease-toast', handleToast);
    return () => window.removeEventListener('neuroease-toast', handleToast);
  }, [addToast]);
  
  const [modes, setModes] = useState({ vibration: false, light: false, audio: false });
  const [vibrationIntensity, setIntensity] = useState(5);
  const [lightColor, setLightColor] = useState({ r: 255, g: 255, b: 255 });
  const [trackId, setTrackId] = useState(1);
  const [audioVolume, setAudioVolume] = useState(50);
  const [duration, setDuration] = useState(10);
  const [timerLeft, setTimerLeft] = useState(null);
  
  const [showPreModal, setShowPreModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [painBefore, setPainBefore] = useState(null);
  const [painAfter, setPainAfter] = useState(null);

  useEffect(() => {
    if (location.state?.preset) {
      const p = location.state.preset;
      if (p.modes) setModes(p.modes);
      if (p.vibrationIntensity) setIntensity(p.vibrationIntensity);
      if (p.duration) setDuration(p.duration);
      if (p.trackId) setTrackId(p.trackId);
      // light handling...
    }
  }, [location.state]);

  useEffect(() => {
    let interval;
    const isRunning = demoMode ? demoActive : sessionActive;

    if (isRunning && timerLeft !== null && timerLeft > 0) {
      interval = setInterval(() => setTimerLeft(prev => prev - 1), 1000);
    } else if (timerLeft === 0) {
      handleStop();
    }
    return () => clearInterval(interval);
  }, [sessionActive, demoActive, timerLeft, demoMode]);

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
      painAfter: after
    };

    localStorage.setItem('neuroHistory', JSON.stringify([newSession, ...history]));
  };

  const startTherapyEngine = () => {
    setTimerLeft(duration * 60);

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

  const handleStop = () => {
    if (demoMode) {
      stopDemoEngine();
      addToast('Demo session complete. Please rate your pain.', 'success');
    } else {
      stopTherapy();
    }
    setTimerLeft(null);
    setShowPostModal(true);
  };

  const handlePostModalSubmit = (val) => {
    setPainAfter(val);
    saveToHistory(painBefore, val);
    setShowPostModal(false);
    setPainBefore(null);
    setPainAfter(null);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Therapy Control</h1>
      </header>

      {/* Mode Selector */}
      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>SELECT MODE</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ModeCard active={modes.vibration && !modes.light && !modes.audio} icon={<Activity />} title="Vibration" onClick={() => selectMode('vibration')} />
          <ModeCard active={modes.light && !modes.vibration && !modes.audio} icon={<Lightbulb />} title="Light" onClick={() => selectMode('light')} />
          <ModeCard active={modes.audio && !modes.light && !modes.vibration} icon={<Music />} title="Audio" onClick={() => selectMode('audio')} />
          <ModeCard active={modes.vibration && modes.light && modes.audio} icon={<Layers />} title="Combined" onClick={() => selectMode('combined')} />
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

      {/* Timer / Timer Config */}
      <section style={{ marginBottom: '32px' }}>
        {sessionActive && timerLeft !== null ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
              {formatTime(timerLeft)}
            </div>
            <span style={{ color: 'var(--text-muted)' }}>Session in progress</span>
          </div>
        ) : (
          <div>
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
          </div>
        )}

        {(demoMode && demoActive) && (
          <div style={{ marginTop: '24px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>DEMO STATUS PANEL</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: demoState.vibration ? 'var(--color-success)' : 'var(--text-muted)' }} />
                <span>📳 Vibration: {demoState.vibration ? `ON (Level ${vibrationIntensity})` : 'OFF'} {demoState.vibration === "NOT_SUPPORTED" && "(Not Supported)"}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: demoState.light ? 'var(--color-success)' : 'var(--text-muted)' }} />
                <span>💡 Light: {demoState.light ? `ON ` : 'OFF'}</span>
                {demoState.light && <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: demoState.light, border: '1px solid white' }} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: demoState.audio ? 'var(--color-success)' : 'var(--text-muted)' }} />
                <span>🎵 Audio: {demoState.audio ? `ON (Track ${demoState.audio})` : 'OFF'}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Action Button */}
      {!(demoMode ? demoActive : sessionActive) ? (
        <button
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
            opacity: (demoMode || isConnected) ? 1 : 0.5
          }}
        >
          <Play fill="currentColor" size={20} />
          {demoMode ? 'START DEMO THERAPY' : (isConnected ? 'START THERAPY' : 'Connect Device First')}
        </button>
      ) : (
        <button
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
            gap: '8px'
          }}
        >
          <Square fill="currentColor" size={20} />
          STOP THERAPY
        </button>
      )}

      {showPreModal && (
        <PainModal 
          title="How is your pain right now?" 
          subtitle="Rate your pain level before therapy" 
          buttonText="Start Therapy"
          onSubmit={handlePreModalSubmit}
        />
      )}

      {showPostModal && (
        <PainModal 
          title="How is your pain now?" 
          subtitle="Rate your pain level after therapy" 
          buttonText="Save Session"
          onSubmit={handlePostModalSubmit}
        />
      )}
    </div>
  );
}

function PainModal({ title, subtitle, buttonText, onSubmit }) {
  const [selected, setSelected] = useState(null);

  const getColor = (num) => {
    if (num <= 3) return '#4CAF82';
    if (num <= 6) return '#E8A838';
    return '#E85555';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex',
      justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '24px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-main)', width: '100%', maxWidth: '400px',
        borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', textAlign: 'center',
        margin: '0 16px'
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>{subtitle}</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', marginBottom: '32px' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(num => {
            const color = getColor(num);
            const isSelected = selected === num;
            return (
              <button
                key={num}
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
      </div>
    </div>
  );
}

function ModeCard({ active, icon, title, onClick }) {
  return (
    <div 
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
