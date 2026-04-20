import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Type: 'success', 'warning', 'error', 'info'
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard = ({ toast, onClose }) => {
  const getColors = () => {
    switch(toast.type) {
      case 'success': return { border: 'var(--color-success)', icon: <CheckCircle color="var(--color-success)" size={20}/> };
      case 'warning': return { border: 'var(--color-warning)', icon: <AlertTriangle color="var(--color-warning)" size={20}/> };
      case 'error': return { border: 'var(--color-danger)', icon: <AlertCircle color="var(--color-danger)" size={20}/> };
      default: return { border: 'var(--color-accent)', icon: <Info color="var(--color-accent)" size={20}/> };
    }
  };

  const { border, icon } = getColors();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      backgroundColor: 'var(--bg-card)',
      borderLeft: `4px solid ${border}`,
      borderTop: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      animation: 'slideIn 0.3s ease-out forwards',
      maxWidth: '300px'
    }}>
      {icon}
      <span style={{ fontSize: '14px', flex: 1 }}>{toast.message}</span>
      <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
        <X size={16} />
      </button>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
