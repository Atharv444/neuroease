import React, { useState, useEffect } from 'react';
import { Clock, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function History() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    // Generate some mock history if empty for demonstration
    let history = JSON.parse(localStorage.getItem('neuroHistory'));
    if (!history || history.length === 0) {
      history = [
        { id: '1', date: 'Today, 2:30 PM', duration: 15, mode: 'Combined', feedback: 'up' },
        { id: '2', date: 'Yesterday, 8:00 PM', duration: 10, mode: 'Audio Only', feedback: 'down' },
        { id: '3', date: 'Apr 16, 9:15 AM', duration: 20, mode: 'Vibration', feedback: null },
      ];
      localStorage.setItem('neuroHistory', JSON.stringify(history));
    }
    setSessions(history);
  }, []);

  const totalMins = sessions.reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Session History</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{sessions.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Sessions</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-accent)' }}>{Math.floor(totalMins/60)}h {totalMins%60}m</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Relief Time</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sessions.map(s => (
          <div key={s.id} style={{
            backgroundColor: 'var(--bg-card)',
            padding: '16px',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{s.date}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>{s.duration} min</span>
                <span>• {s.mode} {s.demo && '🧪'}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {s.feedback === 'up' && <ThumbsUp size={16} color="var(--color-success)" />}
              {s.feedback === 'down' && <ThumbsDown size={16} color="var(--color-danger)" />}
              {!s.feedback && <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>Rate</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
