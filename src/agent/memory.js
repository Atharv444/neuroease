// src/agent/memory.js
// Loop 4: Learning Agent — Personal Memory Builder

export function buildUserMemory() {
  if (typeof localStorage === 'undefined') return '';

  let history = [];
  try {
    const raw = localStorage.getItem('neuroHistory');
    history = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse neuroHistory for user memory:', e);
    return '';
  }

  // If fewer than 3 sessions exist: return empty string (not enough data to personalize yet)
  if (!Array.isArray(history) || history.length < 3) {
    return '';
  }

  // 1. Total sessions
  const totalSessions = history.length;

  // 2. Most & Least effective mode
  const validRated = history.filter(s => s && s.painBefore != null && s.painAfter != null);
  let mostEffective = 'None recorded yet';
  let leastEffective = 'None recorded yet';

  if (validRated.length > 0) {
    const modeStats = {};
    validRated.forEach(s => {
      const mode = s.mode || 'Custom';
      if (!modeStats[mode]) modeStats[mode] = { sum: 0, count: 0 };
      modeStats[mode].sum += (Number(s.painBefore) - Number(s.painAfter));
      modeStats[mode].count += 1;
    });

    const ranked = Object.keys(modeStats).map(mode => ({
      mode,
      avg: modeStats[mode].sum / modeStats[mode].count
    })).sort((a, b) => b.avg - a.avg);

    if (ranked.length > 0) {
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      mostEffective = `${best.mode} (avg pain reduction: ${best.avg.toFixed(1)} pts)`;
      leastEffective = `${worst.mode} (avg pain reduction: ${worst.avg.toFixed(1)} pts)`;
    }
  }

  // 3. Common symptoms (top 3 from symptomsText fields)
  const symptomKeywords = [
    'behind eyes', 'light sensitive', 'light sensitivity', 'nausea', 
    'stress', 'cant sleep', 'insomnia', 'temples', 'throbbing', 
    'neck tension', 'forehead', 'dizziness'
  ];
  const symptomCounts = {};

  history.forEach(s => {
    const text = (s.symptomsText || '').toLowerCase();
    if (!text) return;
    symptomKeywords.forEach(kw => {
      if (text.includes(kw)) {
        symptomCounts[kw] = (symptomCounts[kw] || 0) + 1;
      }
    });
  });

  const sortedSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw);

  const top3Symptoms = sortedSymptoms.slice(0, 3);
  const commonSymptoms = top3Symptoms.length > 0 
    ? top3Symptoms.join(', ') 
    : 'None recorded';

  // 4. Average session duration
  const validDurations = history.filter(s => typeof s.duration === 'number' && !isNaN(s.duration));
  const avgDuration = validDurations.length > 0
    ? Math.round(validDurations.reduce((acc, s) => acc + s.duration, 0) / validDurations.length)
    : 15;

  // 5. Last 3 sessions: [mode, pain before→after, date]
  const last3 = history.slice(0, 3).map(s => {
    const mode = s.mode || 'Custom';
    const before = s.painBefore != null ? s.painBefore : '?';
    const after = s.painAfter != null ? s.painAfter : '?';
    const date = s.date || 'Recent';
    return `${mode}, pain ${before}→${after}, ${date}`;
  }).join('; ');

  // 6. Modes tried for 'severe' pain
  const severeSessions = history.filter(s => {
    const isSevereRating = s.painBefore != null && Number(s.painBefore) >= 7;
    const isSevereText = s.symptomsText && /severe|intense|worst|terrible|8|9|10/i.test(s.symptomsText);
    return isSevereRating || isSevereText;
  });

  const severeModesList = Array.from(new Set(severeSessions.map(s => s.mode).filter(Boolean)));
  const severeModes = severeModesList.length > 0 ? severeModesList.join(', ') : 'None';

  return `USER HISTORY SUMMARY:
- Total sessions: ${totalSessions}
- Most effective mode: ${mostEffective}
- Least effective mode: ${leastEffective}
- Common symptoms: ${commonSymptoms}
- Average session duration: ${avgDuration} mins
- Last 3 sessions: ${last3}
- Modes tried for 'severe' pain: ${severeModes}`;
}
