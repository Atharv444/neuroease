import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlayCircle, Sliders, Clock, Settings } from 'lucide-react';

export default function BottomNav() {
  const navItems = [
    { id: 'dashboard', path: '/dashboard', icon: <Home size={24} />, label: 'Home' },
    { id: 'therapy', path: '/therapy', icon: <PlayCircle size={24} />, label: 'Therapy' },
    { id: 'profiles', path: '/profiles', icon: <Sliders size={24} />, label: 'Profiles' },
    { id: 'history', path: '/history', icon: <Clock size={24} />, label: 'History' },
    { id: 'settings', path: '/settings', icon: <Settings size={24} />, label: 'Settings' }
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: '80px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100,
      maxWidth: '480px',
      margin: '0 auto',
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none',
            color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
            transition: 'color 200ms ease'
          })}
        >
          {item.icon}
          <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
