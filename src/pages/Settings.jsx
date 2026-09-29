import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../context/BluetoothContext';

export default function Settings() {
  const { isConnected, deviceName, disconnect } = useBluetooth();
  const [name, setName] = useState('Friend');
  const [apiKey, setApiKey] = useState('');
  
  useEffect(() => {
    const saved = localStorage.getItem('neuroName');
    if (saved) setName(saved);
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleNameChange = (e) => {
    setName(e.target.value);
    localStorage.setItem('neuroName', e.target.value);
  };

  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem('gemini_api_key', val.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Settings</h1>
      </header>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>PROFILE</h3>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Your Name</label>
          <input 
            type="text" 
            value={name}
            onChange={handleNameChange}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'inherit',
              fontSize: '16px'
            }}
          />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>AI AGENT</h3>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Google Gemini API Key</label>
          <input 
            type="password" 
            placeholder="Enter API key..."
            value={apiKey}
            onChange={handleApiKeyChange}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
            Saved securely in your browser. Leave blank to use the built-in default key.
          </span>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>DEVICE</h3>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>Connected Device</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{isConnected ? deviceName : 'None'}</span>
          </div>
          {isConnected && (
            <div style={{ padding: '8px' }}>
              <button 
                onClick={disconnect}
                style={{ width: '100%', padding: '12px', color: 'var(--color-danger)', fontWeight: 500 }}
              >
                Disconnect Device
              </button>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '48px' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>NeuroEase Smart Migraine Relief</p>
        <p>Version 1.0.0</p>
        <p style={{ marginTop: '16px', opacity: 0.7 }}>Non-invasive therapy, designed for comfort.</p>
      </section>
    </div>
  );
}
