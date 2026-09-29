import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBluetooth } from '../context/BluetoothContext';
import { useToast } from '../context/ToastContext';
import { Bluetooth, Zap, Moon, Focus, Flame, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import AIAgentModal from '../components/AIAgentModal';
import { buildUserMemory } from '../agent/memory';
import { getDashboardInsights } from '../agent/orchestrator';

export default function Dashboard() {
  const { isConnected, connect, batteryLevel, signalStrength, activeComponents, demoMode, toggleDemoMode } = useBluetooth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [userName, setUserName] = useState('Friend');
  const [lastSession, setLastSession] = useState(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [agentInsights, setAgentInsights] = useState([]);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem('neuroName');
    if (name) setUserName(name);
    
    try {
      const history = JSON.parse(localStorage.getItem('neuroHistory')) || [];
      if (history.length > 0) setLastSession(history[0]);
    } catch(e) {}
  }, []);

  // Loop 5: Proactive Dashboard Agent (Background fetch & 6-hr / new-session caching)
  useEffect(() => {
    let isCancelled = false;

    async function loadAgentInsights() {
      try {
        const rawHistory = localStorage.getItem('neuroHistory');
        const sessions = rawHistory ? JSON.parse(rawHistory) : [];

        // FIX A: Show if 3+ ANY sessions exist with painBefore and painAfter data
        const eligibleSessions = sessions.filter(s => 
          s.painBefore !== undefined && 
          s.painAfter !== undefined
        );
        const showInsights = eligibleSessions.length >= 3;
        if (!isCancelled) setShowInsights(showInsights);

        if (!showInsights) {
          if (!isCancelled) setAgentInsights([]);
          return;
        }

        const latestSessionId = sessions.length > 0 ? sessions[0].id : null;
        const now = Date.now();
        const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

        // FIX C: Support agentInsightsCache & agentInsightsCacheTime
        const cachedRaw = localStorage.getItem('agentInsightsCache') || localStorage.getItem('neuroease_agent_insights');
        const cachedTime = localStorage.getItem('agentInsightsCacheTime');

        if (cachedRaw) {
          try {
            let cachedList = null;
            let timestamp = cachedTime ? parseInt(cachedTime, 10) : null;
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed)) {
              cachedList = parsed;
            } else if (parsed && Array.isArray(parsed.insights)) {
              cachedList = parsed.insights;
              if (!timestamp && parsed.timestamp) timestamp = parsed.timestamp;
            }

            const isFresh = timestamp ? (now - timestamp < SIX_HOURS_MS) : true;
            if (isFresh && cachedList && cachedList.length > 0) {
              if (!isCancelled) setAgentInsights(cachedList);
              return;
            }
          } catch (e) {
            console.warn('Cached insights parse error:', e);
          }
        }

        const memoryStr = buildUserMemory();
        if (!memoryStr) return;

        const results = await getDashboardInsights(memoryStr);
        if (!isCancelled && Array.isArray(results) && results.length > 0) {
          setAgentInsights(results);
          try {
            localStorage.setItem('agentInsightsCache', JSON.stringify(results));
            localStorage.setItem('agentInsightsCacheTime', now.toString());
            localStorage.setItem('neuroease_agent_insights', JSON.stringify({
              timestamp: now,
              lastSessionId: latestSessionId,
              insights: results
            }));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Dashboard insights background error:', err);
      }
    }

    loadAgentInsights();
    return () => { isCancelled = true; };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const startQuickTherapy = (settings) => {
    navigate('/therapy', { state: { preset: settings } });
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px', marginTop: '16px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--text-primary)' }}>
          {getGreeting()}, {userName}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          How are you feeling today?
        </p>
      </header>

      {window.isSecureContext === false && (
        <div style={{ backgroundColor: '#E8A838', color: '#0A0A0F', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>⚠️</span>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Bluetooth requires HTTPS. Open this app over HTTPS or on localhost for device connection to work.</span>
        </div>
      )}

      <section style={{ marginBottom: '24px' }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧪 Demo Mode
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Simulate therapy on this device (no glasses needed)
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '28px' }}>
            <input 
              type="checkbox" 
              checked={demoMode}
              onChange={(e) => toggleDemoMode(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: demoMode ? 'var(--color-primary)' : 'var(--border-color)',
              transition: '0.3s', borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', height: '20px', width: '20px', left: '4px', bottom: '4px',
                backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                transform: demoMode ? 'translateX(20px)' : 'none'
              }} />
            </span>
          </label>
        </div>
      </section>

      {!(isConnected || demoMode) ? (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', 
            backgroundColor: 'var(--color-primary-glow)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Bluetooth color="var(--color-primary)" size={32} />
          </div>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Connect Your NeuroEase Glasses</h2>
          
          <div style={{ textAlign: 'left', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            <p style={{ marginBottom: '8px' }}><strong>Step 1:</strong> Turn on your glasses (hold power 3s)</p>
            <p style={{ marginBottom: '8px' }}><strong>Step 2:</strong> Enable Bluetooth on your device</p>
            <p><strong>Step 3:</strong> Press Connect below</p>
          </div>

          <button 
            onClick={() => {
              if (!window.isSecureContext || !navigator.bluetooth) {
                addToast('Bluetooth unavailable. Use Chrome over HTTPS.', 'error');
                return;
              }
              connect();
            }}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-btn)',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Bluetooth size={20} />
            Connect to Device
          </button>
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            Requires Chrome on Android. Not supported on iOS Safari.
          </div>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-muted)' }}>Device Status</h3>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              padding: '16px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>Battery</span>
                <span style={{ fontSize: '14px', color: batteryLevel > 20 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {batteryLevel}%
                </span>
              </div>
              <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${batteryLevel}%`, 
                  backgroundColor: batteryLevel > 50 ? 'var(--color-success)' : batteryLevel > 20 ? 'var(--color-warning)' : 'var(--color-danger)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Badge active={activeComponents.vibration} label="Vibration" />
                <Badge active={activeComponents.light} label="Light" />
                <Badge active={activeComponents.audio} label="Audio" />
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-muted)' }}>Quick Start</h3>
            
            {/* AI Agent Card */}
            <div 
              id="ai-agent-card"
              onClick={() => setIsAIModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #7C6AF7 0%, #5E4EE6 100%)',
                borderRadius: 'var(--radius-card)',
                padding: '16px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(124, 106, 247, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                marginBottom: '12px',
                transition: 'var(--transition)'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}>
                  🤖
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 AI Agent
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
                    Describe your symptoms — AI sets everything
                  </div>
                </div>
              </div>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <Sparkles size={16} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <QuickCard 
                icon={<Zap size={24} color="var(--color-accent)"/>}
                title="Quick Calm"
                desc="2 min combined"
                onClick={() => startQuickTherapy({ modes: {vibration: true, light: true, audio: true}, duration: 2, vibrationIntensity: 3 })}
              />
              <QuickCard 
                icon={<Moon size={24} color="var(--color-primary)"/>}
                title="Sleep Assist"
                desc="5 min audio"
                onClick={() => startQuickTherapy({ modes: {audio: true}, duration: 5, trackId: 2 })}
              />
              <QuickCard 
                icon={<Focus size={24} color="var(--color-success)"/>}
                title="Focus Relief"
                desc="3 min vib+light"
                onClick={() => startQuickTherapy({ modes: {vibration: true, light: true}, duration: 3, vibrationIntensity: 5 })}
              />
              <QuickCard 
                icon={<Flame size={24} color="var(--color-warning)"/>}
                title="Full Therapy"
                desc="10 min intense"
                onClick={() => startQuickTherapy({ modes: {vibration: true, light: true, audio: true}, duration: 10, vibrationIntensity: 7 })}
              />
            </div>
          </section>

          {/* Loop 5: Agent Insights Section */}
          {showInsights && agentInsights && agentInsights.length > 0 && (
            <section style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px'
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.5px'
                }}>
                  🤖 AI Insights
                </span>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                paddingBottom: '8px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {agentInsights.map((card, idx) => (
                  <div
                    key={idx}
                    id={`agent-insight-card-${idx}`}
                    style={{
                      minWidth: '220px',
                      maxWidth: '260px',
                      flexShrink: 0,
                      backgroundColor: '#13131A',
                      border: '1px solid #1E1E2E',
                      borderLeft: '4px solid var(--color-primary)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{card.icon}</span>
                    <p style={{
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      margin: 0,
                      fontWeight: 500
                    }}>
                      {card.insight}
                    </p>
                    {card.action && (
                      <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem',
                        fontStyle: 'italic',
                        margin: 0
                      }}>
                        {card.action}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {lastSession && (
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-muted)' }}>Last Session</h3>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                padding: '16px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                  {lastSession.duration} mins • {lastSession.date}
                </div>
                {!lastSession.feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Feeling better?</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ padding: '6px', backgroundColor: 'var(--border-color)', borderRadius: '6px' }}><ThumbsUp size={16}/></button>
                      <button style={{ padding: '6px', backgroundColor: 'var(--border-color)', borderRadius: '6px' }}><ThumbsDown size={16}/></button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <AIAgentModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
      />
    </div>
  );
}

function Badge({ active, label }) {
  return (
    <div style={{
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 500,
      backgroundColor: active ? 'var(--color-primary-glow)' : 'transparent',
      color: active ? 'var(--color-primary)' : 'var(--text-muted)',
      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`
    }}>
      {label}
    </div>
  );
}

function QuickCard({ icon, title, desc, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        padding: '16px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-color)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'var(--transition)'
      }}
      onMouseOver={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
      onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
    >
      {icon}
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </div>
  )
}
