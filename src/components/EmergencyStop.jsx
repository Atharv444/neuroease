import React from 'react';
import { useBluetooth } from '../context/BluetoothContext';

export default function EmergencyStop() {
  const { stopTherapy } = useBluetooth();

  return (
    <button
      onClick={stopTherapy}
      style={{
        position: 'fixed',
        bottom: '100px', // above bottom nav
        right: '20px',
        backgroundColor: 'var(--color-danger)',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(232, 85, 85, 0.4)',
        zIndex: 999,
        fontWeight: 'bold',
        fontSize: '12px'
      }}
    >
      <span style={{ fontSize: '20px', marginBottom: '-2px' }}>🆘</span>
      STOP
    </button>
  );
}
