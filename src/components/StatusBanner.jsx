import React from 'react';
import { useBluetooth } from '../context/BluetoothContext';

export default function StatusBanner() {
  const { isConnected, connect, demoMode } = useBluetooth();

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: '50px',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      maxWidth: '480px', // constrain to design max-width
      margin: '0 auto'  // center it
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '10px', height: '10px',
          borderRadius: '50%',
          backgroundColor: demoMode ? 'var(--color-primary)' : (isConnected ? 'var(--color-success)' : 'var(--color-danger)'),
          boxShadow: `0 0 8px ${demoMode ? 'var(--color-primary)' : (isConnected ? 'var(--color-success)' : 'var(--color-danger)')}`
        }} />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {demoMode ? 'Demo Mode Active — Simulating on this device' : (isConnected ? 'Connected to NeuroEase Pro' : 'Not Connected')}
        </span>
      </div>
      
      {(!isConnected && !demoMode) && (
        <button 
          onClick={connect}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-btn)',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          Connect
        </button>
      )}
    </div>
  );
}
