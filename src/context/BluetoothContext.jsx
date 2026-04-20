import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useToast } from './ToastContext';

const SERVICE_UUID = "12345678-1234-1234-1234-123456789012";
const CHARACTERISTIC_UUID = "87654321-4321-4321-4321-210987654321";

const initialState = {
  isConnected: false,
  deviceName: 'None',
  batteryLevel: 100,
  activeComponents: { vibration: false, light: false, audio: false },
  sessionActive: false,
  signalStrength: 'weak',
  demoMode: JSON.parse(localStorage.getItem('neuroDemo') || 'false'),
};

function bluetoothReducer(state, action) {
  switch (action.type) {
    case 'CONNECT':
      return { ...state, isConnected: true, deviceName: action.payload.name, signalStrength: 'strong' };
    case 'DISCONNECT':
      return { ...initialState };
    case 'UPDATE_BATTERY':
      return { ...state, batteryLevel: action.payload };
    case 'SET_SESSION_ACTIVE':
      return { ...state, sessionActive: action.payload.active, activeComponents: action.payload.components || state.activeComponents };
    case 'UPDATE_COMPONENTS':
      return { ...state, activeComponents: { ...state.activeComponents, ...action.payload } };
    case 'TOGGLE_DEMO':
      localStorage.setItem('neuroDemo', JSON.stringify(action.payload));
      return { ...state, demoMode: action.payload };
    default:
      return state;
  }
}

const BluetoothContext = createContext(null);

export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (!context) throw new Error("useBluetooth must be used within BluetoothProvider");
  return context;
};

export const BluetoothProvider = ({ children }) => {
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const { addToast } = useToast();
  
  const deviceRef = useRef(null);
  const characteristicRef = useRef(null);

  const handleDisconnected = useCallback(() => {
    dispatch({ type: 'DISCONNECT' });
    addToast('Device disconnected. Session ended.', 'error');
  }, [addToast]);

  const connect = async () => {
    if (!navigator.bluetooth) {
      addToast("Web Bluetooth not available. Make sure you're using Chrome over HTTPS or localhost.", 'error');
      return;
    }

    try {
      addToast('Requesting Bluetooth Device...', 'info');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      device.addEventListener('gattserverdisconnected', handleDisconnected);
      deviceRef.current = device;

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      
      characteristicRef.current = characteristic;
      
      dispatch({ type: 'CONNECT', payload: { name: device.name || 'NeuroEase Pro' } });
      addToast('Connected to NeuroEase Pro', 'success');

      // Request initial battery level
      sendCommand('GET_BATTERY');

    } catch (error) {
      console.error(error);
      addToast('Connection failed: ' + error.message, 'error');
    }
  };

  const disconnect = () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      deviceRef.current.gatt.disconnect();
    }
  };

  const sendCommand = async (command) => {
    if (!characteristicRef.current || !state.isConnected) {
      console.warn("Cannot send command: not connected");
      return false;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(command);
      await characteristicRef.current.writeValue(data);
      console.log(`Sent command: ${command}`);
      return true;
    } catch (error) {
      console.error('Send error', error);
      addToast('Failed to send command', 'error');
      return false;
    }
  };

  // Helper functions exposed to context
  const startTherapy = async (components, { vibrationIntensity = 5, r = 255, g = 255, b = 255, trackId = 1 }) => {
    const commandsToRun = [];
    
    if (components.vibration && components.light && components.audio) {
      commandsToRun.push(`START_ALL:${vibrationIntensity},${r},${g},${b},${trackId}`);
    } else {
      if (components.vibration) commandsToRun.push(`START_VIB:${vibrationIntensity}`);
      if (components.light) commandsToRun.push(`START_LIGHT:${r},${g},${b}`);
      if (components.audio) commandsToRun.push(`START_AUDIO:${trackId}`);
    }

    if (commandsToRun.length === 0) {
      addToast('No therapy modes selected', 'warning');
      return;
    }

    let success = true;
    for (const cmd of commandsToRun) {
      const res = await sendCommand(cmd);
      if (!res) success = false;
    }

    if (success) {
      dispatch({ type: 'SET_SESSION_ACTIVE', payload: { active: true, components } });
      addToast('Therapy started', 'success');
    }
  };

  const stopTherapy = async () => {
    const success = await sendCommand("STOP_ALL");
    if (success || !state.isConnected) { // Even if disconnected, force clear state
      dispatch({ 
        type: 'SET_SESSION_ACTIVE', 
        payload: { active: false, components: { vibration: false, light: false, audio: false } } 
      });
      if(state.isConnected) addToast('Therapy stopped', 'info');
    }
  };

  const toggleDemoMode = (enabled) => {
    dispatch({ type: 'TOGGLE_DEMO', payload: enabled });
  };

  return (
    <BluetoothContext.Provider value={{
      ...state,
      connect,
      disconnect,
      sendCommand,
      startTherapy,
      stopTherapy,
      toggleDemoMode
    }}>
      {children}
    </BluetoothContext.Provider>
  );
};
