import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Lock, Edit2, Trash2, Plus } from 'lucide-react';

const BUILT_IN_PRESETS = [
  { id: 'p1', name: 'Mild Migraine', icon: '🟢', modes: {vibration: true, light: true, audio: true}, duration: 10, vibrationIntensity: 3, trackId: 1, builtIn: true },
  { id: 'p2', name: 'Moderate Relief', icon: '🟡', modes: {vibration: true, light: true, audio: true}, duration: 15, vibrationIntensity: 6, trackId: 3, builtIn: true },
  { id: 'p3', name: 'Severe Episode', icon: '🔴', modes: {vibration: true, light: true, audio: true}, duration: 20, vibrationIntensity: 2, trackId: 4, builtIn: true },
  { id: 'p4', name: 'Relaxation', icon: '🧘', modes: {audio: true}, duration: 30, trackId: 2, builtIn: true },
];

export default function Profiles() {
  const navigate = useNavigate();
  const [customPresets, setCustomPresets] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('neuroPresets')) || [];
    setCustomPresets(saved);
  }, []);

  const launch = (preset) => {
    navigate('/therapy', { state: { preset } });
  };

  const deletePreset = (id) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem('neuroPresets', JSON.stringify(updated));
  };

  const createNew = () => {
    // In a full app this would open a modal to configure
    const newPreset = {
      id: Date.now().toString(),
      name: 'Custom Profile',
      icon: '✨',
      modes: { vibration: true, audio: true },
      vibrationIntensity: 5,
      duration: 15,
      builtIn: false
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('neuroPresets', JSON.stringify(updated));
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Therapy Profiles</h1>
      </header>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>BUILT-IN PRESETS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {BUILT_IN_PRESETS.map(p => (
            <ProfileCard key={p.id} preset={p} onLaunch={launch} />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>YOUR PRESETS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {customPresets.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px dashed var(--border-color)' }}>
              No custom profiles yet.
            </div>
          )}
          {customPresets.map(p => (
            <ProfileCard key={p.id} preset={p} onLaunch={launch} onDelete={deletePreset} />
          ))}
        </div>
        
        <button 
          onClick={createNew}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '16px',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--color-primary)',
            backgroundColor: 'transparent',
            color: 'var(--color-primary)',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={20} />
          Create New Profile
        </button>
      </section>
    </div>
  );
}

function ProfileCard({ preset, onLaunch, onDelete }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--radius-card)',
      padding: '16px',
      border: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '24px' }}>{preset.icon}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {preset.name}
            {preset.builtIn && <Lock size={14} color="var(--text-muted)" />}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {preset.duration} min • {Object.keys(preset.modes || {}).filter(k => preset.modes[k]).join(', ')}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        {!preset.builtIn && (
          <button onClick={() => onDelete(preset.id)} style={{ padding: '8px', color: 'var(--color-danger)', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={() => onLaunch(preset)} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px' }}>
          <Play size={14} fill="currentColor" />
          Launch
        </button>
      </div>
    </div>
  );
}
