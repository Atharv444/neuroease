import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { BluetoothProvider, useBluetooth } from './context/BluetoothContext';

// Layout Components
import StatusBanner from './components/StatusBanner';
import BottomNav from './components/BottomNav';
import EmergencyStop from './components/EmergencyStop';

// Pages
import Dashboard from './pages/Dashboard';
import Therapy from './pages/Therapy';
import Profiles from './pages/Profiles';
import History from './pages/History';
import Settings from './pages/Settings';

function AppLayout() {
  const { sessionActive } = useBluetooth();
  
  return (
    <div style={{ paddingBottom: '80px', paddingTop: '50px' }}>
      <StatusBanner />
      
      <main style={{ padding: '16px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/therapy" element={<Therapy />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <BottomNav />
      
      {sessionActive && <EmergencyStop />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <BluetoothProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </BluetoothProvider>
    </ToastProvider>
  );
}

export default App;
