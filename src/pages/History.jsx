import React, { useState, useEffect } from 'react';
import { Clock, ThumbsUp, ThumbsDown, ArrowDown, ArrowUp, Minus, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('Sessions');

  useEffect(() => {
    let history = JSON.parse(localStorage.getItem('neuroHistory'));
    if (!history || history.length === 0) {
      history = [
        { id: (Date.now() - 1000).toString(), date: 'Today, 2:30 PM', duration: 15, mode: 'Combined', feedback: 'up', painBefore: 8, painAfter: 3 },
        { id: (Date.now() - 86400000).toString(), date: 'Yesterday, 8:00 PM', duration: 10, mode: 'Audio', feedback: 'down', painBefore: 5, painAfter: 5 },
        { id: (Date.now() - 86400000 * 2).toString(), date: 'Apr 16, 9:15 AM', duration: 20, mode: 'Vibration', feedback: null, painBefore: 4, painAfter: 6 },
      ];
      localStorage.setItem('neuroHistory', JSON.stringify(history));
    }
    setSessions(history);
  }, []);

  const totalMins = sessions.reduce((acc, curr) => acc + curr.duration, 0);
  const validSessions = sessions.filter(s => s.painBefore != null && s.painAfter != null);

  let averageReduction = 0;
  let bestMode = 'N/A';
  let graph1Data = [];
  let graph2Data = [];
  let graph3Data = [];
  let graph4Data = [];

  if (validSessions.length >= 2) {
    const totalReduction = validSessions.reduce((acc, s) => acc + (s.painBefore - s.painAfter), 0);
    averageReduction = (totalReduction / validSessions.length).toFixed(1);

    const modeStats = {};
    validSessions.forEach(s => {
      if (!modeStats[s.mode]) modeStats[s.mode] = { sum: 0, count: 0 };
      modeStats[s.mode].sum += (s.painBefore - s.painAfter);
      modeStats[s.mode].count += 1;
    });

    let bestModeAvg = -999;
    Object.keys(modeStats).forEach(mode => {
      const avg = modeStats[mode].sum / modeStats[mode].count;
      if (avg > bestModeAvg) {
        bestModeAvg = avg;
        bestMode = mode;
      }
      graph3Data.push({ name: mode, value: parseFloat(avg.toFixed(1)) });
    });

    graph1Data = [...validSessions].slice(0, 7).reverse().map(s => ({
      name: s.date.split(',')[0],
      Before: s.painBefore,
      After: s.painAfter
    }));

    const weeks = {};
    sessions.forEach((s, i) => {
      const weekLabel = `Week ${Math.floor(i / 3) + 1}`;
      weeks[weekLabel] = (weeks[weekLabel] || 0) + 1;
    });
    graph2Data = Object.keys(weeks).map(w => ({ name: w, count: weeks[w] })).reverse();

    const days = { 'Mon': {sum:0, c:0}, 'Tue': {sum:0, c:0}, 'Wed': {sum:0, c:0}, 'Thu': {sum:0, c:0}, 'Fri': {sum:0, c:0}, 'Sat': {sum:0, c:0}, 'Sun': {sum:0, c:0} };
    validSessions.forEach(s => {
       const realDate = new Date(parseInt(s.id));
       const dayStr = realDate.toLocaleDateString('en-US', { weekday: 'short' });
       if (days[dayStr]) {
         days[dayStr].sum += s.painBefore;
         days[dayStr].c += 1;
       }
    });
    graph4Data = Object.keys(days).map(d => ({ name: d, value: days[d].c > 0 ? parseFloat((days[d].sum/days[d].c).toFixed(1)) : 0 }));
  }

  const PIE_COLORS = { 'Vibration': '#7C6AF7', 'Light': '#4FC3F7', 'Audio': '#E040FB', 'Combined': '#4CAF82' };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Session History</h1>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('Sessions')}
          style={{
            flex: 1, padding: '10px', borderRadius: '999px', fontWeight: 'bold', border: 'none',
            backgroundColor: activeTab === 'Sessions' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'Sessions' ? 'white' : 'var(--text-muted)'
          }}
        >
          Sessions
        </button>
        <button 
          onClick={() => setActiveTab('Insights')}
          style={{
            flex: 1, padding: '10px', borderRadius: '999px', fontWeight: 'bold', border: 'none',
            backgroundColor: activeTab === 'Insights' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'Insights' ? 'white' : 'var(--text-muted)'
          }}
        >
          Insights
        </button>
      </div>

      {activeTab === 'Sessions' && (
        <>
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
            {sessions.map(s => {
              let painVisual = null;
              if (s.painBefore != null && s.painAfter != null) {
                const diff = s.painBefore - s.painAfter;
                const isReduced = diff > 0;
                const isSame = diff === 0;
                const isIncreased = diff < 0;
                
                painVisual = (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600,
                    color: isReduced ? 'var(--color-success)' : isIncreased ? 'var(--color-danger)' : 'var(--text-muted)'
                  }}>
                    Pain: {s.painBefore} → {s.painAfter}
                    {isReduced && <ArrowDown size={14} />}
                    {isSame && <Minus size={14} />}
                    {isIncreased && <ArrowUp size={14} />}
                  </div>
                );
              }

              return (
                <div key={s.id} style={{
                  backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{s.date}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>{s.duration} min</span>
                      <span>• {s.mode} {s.demo && '🧪'}</span>
                    </div>
                    {painVisual}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {s.feedback === 'up' && <ThumbsUp size={16} color="var(--color-success)" />}
                    {s.feedback === 'down' && <ThumbsDown size={16} color="var(--color-danger)" />}
                    {!s.feedback && <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>Rate</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'Insights' && (
        <div>
          {validSessions.length < 2 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>Not enough data yet</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.5 }}>Complete 2 or more sessions with pain ratings to see your insights</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
                <StatCard title="Avg Reduction" value={`-${averageReduction} pts`} color="var(--color-success)" />
                <StatCard title="Best Mode" value={bestMode} color="var(--color-primary)" icon={<Activity size={14}/>} />
                <StatCard title="Tracked" value={`${validSessions.length} sessions`} color="var(--color-accent)" />
              </div>

              {/* Graph 1 */}
              <ChartWrapper title="Pain Level — Before vs After">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={graph1Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#13131A', borderColor: '#1E1E2E', color: '#E8E8F0' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Before" fill="#E85555" radius={[4,4,0,0]} barSize={12} />
                    <Bar dataKey="After" fill="#4CAF82" radius={[4,4,0,0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              {/* Graph 2 */}
              <ChartWrapper title="Sessions Per Week">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={graph2Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#13131A', borderColor: '#1E1E2E', color: '#E8E8F0' }} />
                    <Line type="monotone" dataKey="count" stroke="#7C6AF7" strokeWidth={3} dot={{ r: 4, fill: '#7C6AF7', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>

              {/* Graph 3 */}
              <ChartWrapper title="Most Effective Therapy Mode">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={graph3Data} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {graph3Data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || '#7C6AF7'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#13131A', borderColor: '#1E1E2E', color: '#E8E8F0' }} formatter={(val) => `-${val} pts`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>

              {/* Graph 4 */}
              <ChartWrapper title="Average Pain Level by Day">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={graph4Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B6B8A" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#13131A', borderColor: '#1E1E2E', color: '#E8E8F0' }} cursor={{fill: '#1E1E2E'}} />
                    <Bar dataKey="value" name="Avg Pain" fill="#E8A838" radius={[4,4,0,0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color, icon }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', 
      borderRadius: 'var(--radius-card)', padding: '16px', minWidth: '110px', flex: 1
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon} {value}
      </div>
    </div>
  );
}

function ChartWrapper({ title, children }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>{title}</h3>
      {children}
    </div>
  );
}
