import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBluetooth } from '../context/BluetoothContext';
import { useToast } from '../context/ToastContext';
import { getTherapyDecision } from '../agent/orchestrator';
import { executeTherapy, sanitizeDecision } from '../agent/executor';
import {
  X,
  Brain,
  Play,
  Edit3,
  Mic,
  MicOff,
  Activity,
  Lightbulb,
  Music,
  Layers,
  Sparkles,
  Check
} from 'lucide-react';

const LOADING_MESSAGES = [
  'Analyzing your symptoms...',
  'Selecting best therapy mode...',
  'Calibrating intensity levels...',
  'Preparing your session...'
];

const KEYWORD_GROUPS = [
  {
    category: 'Severity',
    chips: ['Mild', 'Moderate', 'Severe']
  },
  {
    category: 'Location',
    chips: ['Behind Eyes', 'Temples', 'Forehead', 'Neck']
  },
  {
    category: 'Symptoms',
    chips: ['Nausea', 'Light Sensitive', "Can't Sleep", 'Stress']
  },
  {
    category: 'Duration',
    chips: ['Just Started', '1-2 Hours', 'All Day']
  }
];

const TRACK_NAMES = {
  1: '🌊 Ocean Waves (Track 1)',
  2: '🌧️ Rain Sounds (Track 2)',
  3: '🎵 Binaural Beats (Track 3)',
  4: '🧘 432Hz Healing Tone (Track 4)',
  5: '🌿 Forest Ambient (Track 5)'
};

export default function AIAgentModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { isConnected, demoMode, sendCommand, startTherapy } = useBluetooth();
  const { addToast } = useToast();

  // State: 1 = INPUT, 2 = LOADING, 3 = DECISION DISPLAY
  const [modalState, setModalState] = useState(1);
  const [symptomsText, setSymptomsText] = useState('');
  const [selectedPain, setSelectedPain] = useState(null);
  const [selectedChips, setSelectedChips] = useState(new Set());
  
  // Voice input
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // Loading animation state
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Decision result from Layer 2
  const [decision, setDecision] = useState(null);

  // Check speech recognition support once on mount
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) {
            setSymptomsText(prev => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition init failed', err);
        setSpeechSupported(false);
      }
    }
  }, []);

  // Cycle loading messages every 1.5 seconds in state 2
  useEffect(() => {
    let interval;
    if (modalState === 2) {
      interval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    } else {
      setLoadingMsgIndex(0);
    }
    return () => clearInterval(interval);
  }, [modalState]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setModalState(1);
      setSymptomsText('');
      setSelectedPain(null);
      setSelectedChips(new Set());
      setDecision(null);
      setIsRetrying(false);
    } else {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Speech start error', e);
        setIsListening(false);
      }
    }
  };

  const handleChipClick = (chip) => {
    // Append to text area
    setSymptomsText(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${chip.toLowerCase()}` : chip.toLowerCase();
    });

    // Mark as selected
    setSelectedChips(prev => {
      const next = new Set(prev);
      next.add(chip);
      return next;
    });
  };

  const handlePainSelect = (num) => {
    setSelectedPain(num);
    setSymptomsText(prev => {
      const trimmed = prev.trim();
      const snippet = `pain level ${num}`;
      return trimmed ? `${trimmed} ${snippet}` : snippet;
    });
  };

  const startAnalysis = async () => {
    if (!symptomsText.trim()) return;

    setModalState(2);
    setIsRetrying(false);

    try {
      // First attempt
      const result = await getTherapyDecision(symptomsText);
      const safe = sanitizeDecision(result);
      setDecision(safe);
      setModalState(3);
    } catch (firstErr) {
      console.warn('AI Agent first attempt failed, retrying after 2s...', firstErr);
      setIsRetrying(true);

      // Self-annealing: Retry once automatically after 2 seconds
      setTimeout(async () => {
        try {
          const retryResult = await getTherapyDecision(symptomsText);
          const safe = sanitizeDecision(retryResult);
          setDecision(safe);
          setModalState(3);
          setIsRetrying(false);
        } catch (secondErr) {
          console.error('AI Agent second attempt failed:', secondErr);
          setIsRetrying(false);
          // Show toast & switch to manual mode on Therapy page
          addToast('AI unavailable. Switching to manual mode.', 'error');
          onClose();
          navigate('/therapy', {
            state: {
              preset: {
                modes: { vibration: true, light: true, audio: true },
                vibrationIntensity: 5,
                lightColor: { r: 100, g: 100, b: 150 },
                trackId: 1,
                duration: 15
              }
            }
          });
        }
      }, 2000);
    }
  };

  const handleStartTherapy = () => {
    if (!decision) return;

    // Convert mode string to boolean map
    const modesObj = {
      vibration: decision.mode === 'vibration' || decision.mode === 'combined',
      light: decision.mode === 'light' || decision.mode === 'combined',
      audio: decision.mode === 'audio' || decision.mode === 'combined'
    };

    // Execute via deterministic executor (Layer 3)
    executeTherapy(decision, isConnected, demoMode, {
      symptomsText,
      painBefore: selectedPain,
      sendBLECommand: (cmd) => {
        if (typeof sendCommand === 'function') sendCommand(cmd);
      },
      skipHardwareTriggers: true // Delegated to Therapy page autoStart to avoid duplicate audio streams
    });

    addToast('AI Therapy plan activated!', 'success');
    onClose();

    // Navigate to Therapy page with preset so live session timer runs
    navigate('/therapy', {
      state: {
        preset: {
          modes: modesObj,
          vibrationIntensity: decision.vibrationIntensity,
          lightColor: decision.lightColor,
          trackId: decision.audioTrack,
          duration: decision.duration
        },
        autoStart: true,
        aiGenerated: true,
        symptomsText,
        aiReasoning: decision.reasoning,
        painBefore: selectedPain
      }
    });
  };

  const handleAdjustManually = () => {
    if (!decision) return;

    const modesObj = {
      vibration: decision.mode === 'vibration' || decision.mode === 'combined',
      light: decision.mode === 'light' || decision.mode === 'combined',
      audio: decision.mode === 'audio' || decision.mode === 'combined'
    };

    addToast('Settings copied to manual therapy', 'info');
    onClose();

    navigate('/therapy', {
      state: {
        preset: {
          modes: modesObj,
          vibrationIntensity: decision.vibrationIntensity,
          lightColor: decision.lightColor,
          trackId: decision.audioTrack,
          duration: decision.duration
        }
      }
    });
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'vibration':
        return <Activity size={20} color="var(--color-primary)" />;
      case 'light':
        return <Lightbulb size={20} color="var(--color-accent)" />;
      case 'audio':
        return <Music size={20} color="#E040FB" />;
      case 'combined':
      default:
        return <Layers size={20} color="var(--color-success)" />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 5, 10, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        maxHeight: '92vh',
        backgroundColor: 'var(--bg-main)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px var(--color-primary-glow)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Modal Top Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(124,106,247,0.1) 0%, transparent 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7C6AF7 0%, #4FC3F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={16} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
              NeuroEase AI Agent
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* ============================================================ */}
          {/* STATE 1: INPUT                                               */}
          {/* ============================================================ */}
          {modalState === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
                  How are you feeling?
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Describe your symptoms in your own words, tap keywords, or speak.
                </p>
              </div>

              {/* Large Text Area */}
              <div style={{ position: 'relative' }}>
                <textarea
                  id="ai-symptom-input"
                  rows={4}
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder={`Type anything...\ne.g. 'severe pain 3 hours light hurts'\n     'throbbing behind eyes cant sleep'\n     'moderate stress headache'\n     'pain 8/10 nausea'`}
                  style={{
                    width: '100%',
                    minHeight: '110px',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />

                {/* Voice Input Button (Web Speech API) */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: isListening ? '#E85555' : 'rgba(124, 106, 247, 0.15)',
                      color: isListening ? '#FFFFFF' : 'var(--color-primary)',
                      border: `1px solid ${isListening ? '#E85555' : 'var(--color-primary)'}`,
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isListening ? '0 0 10px rgba(232, 85, 85, 0.6)' : 'none'
                    }}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    {isListening ? 'Listening...' : '🎤 Speak'}
                  </button>
                )}
              </div>

              {/* Keyword Hint Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Tap keywords to add
                </span>

                {KEYWORD_GROUPS.map(group => (
                  <div key={group.category} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '60px' }}>
                      {group.category}:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {group.chips.map(chip => {
                        const isChipActive = selectedChips.has(chip) || symptomsText.toLowerCase().includes(chip.toLowerCase());
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleChipClick(chip)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: 500,
                              backgroundColor: isChipActive ? 'var(--color-primary-glow)' : 'var(--bg-card)',
                              color: isChipActive ? '#FFFFFF' : 'var(--text-muted)',
                              border: `1px solid ${isChipActive ? 'var(--color-primary)' : 'var(--border-color)'}`,
                              boxShadow: isChipActive ? '0 0 10px var(--color-primary-glow)' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pain Level Quick Selector (1-10) */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '8px' }}>
                  Pain Level (1 - 10)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                    const isSelected = selectedPain === num || symptomsText.includes(`pain level ${num}`) || symptomsText.includes(`${num}/10`);
                    const color = num <= 3 ? 'var(--color-success)' : (num <= 6 ? 'var(--color-warning)' : 'var(--color-danger)');
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePainSelect(num)}
                        style={{
                          height: '32px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          backgroundColor: isSelected ? color : 'var(--bg-card)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                          border: `1px solid ${isSelected ? color : 'var(--border-color)'}`,
                          boxShadow: isSelected ? `0 0 10px ${color}80` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Analyze & Start Button */}
              <button
                id="ai-analyze-btn"
                type="button"
                onClick={startAnalysis}
                disabled={!symptomsText.trim()}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 'var(--radius-btn)',
                  background: symptomsText.trim()
                    ? 'linear-gradient(135deg, #7C6AF7 0%, #5E4EE6 100%)'
                    : 'var(--bg-card)',
                  color: symptomsText.trim() ? '#FFFFFF' : 'var(--text-muted)',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: symptomsText.trim() ? '0 8px 24px rgba(124, 106, 247, 0.4)' : 'none',
                  cursor: symptomsText.trim() ? 'pointer' : 'not-allowed',
                  marginTop: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sparkles size={18} />
                Analyze & Start
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STATE 2: LOADING                                             */}
          {/* ============================================================ */}
          {modalState === 2 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 16px',
              textAlign: 'center',
              gap: '24px',
              flex: 1
            }}>
              {/* Pulsing Brain Icon */}
              <div style={{
                position: 'relative',
                width: '100px',
                height: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(124,106,247,0.4) 0%, transparent 70%)',
                  animation: 'pulse 1.8s infinite ease-in-out'
                }} />
                <div style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  border: '2px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 25px var(--color-primary-glow)',
                  zIndex: 1
                }}>
                  <Brain size={40} color="var(--color-primary)" />
                </div>
              </div>

              {/* Rotating Message & Retrying Status */}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {isRetrying ? 'Retrying...' : LOADING_MESSAGES[loadingMsgIndex]}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {isRetrying
                    ? 'Connecting to Claude API second attempt...'
                    : 'Applying clinical migraine protocol directives'}
                </p>
              </div>

              {/* Progress Indicator */}
              <div style={{
                width: '180px',
                height: '4px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '60%',
                  height: '100%',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: '2px',
                  animation: 'indeterminate 1.5s infinite ease-in-out'
                }} />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STATE 3: DECISION DISPLAY                                    */}
          {/* ============================================================ */}
          {modalState === 3 && decision && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-primary-glow)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  <Check size={14} /> AI Analysis Complete
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                  AI Therapy Plan Ready
                </h2>
              </div>

              {/* Plan Card */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                padding: '20px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }}>
                {/* Mode */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Therapy Mode</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px' }}>
                    {getModeIcon(decision.mode)}
                    <span style={{ textTransform: 'capitalize' }}>{decision.mode}</span>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                {/* Duration */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Duration</span>
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>
                    {decision.duration} minutes
                  </span>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                {/* Vibration */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Vibration</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '60px',
                      height: '6px',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(decision.vibrationIntensity / 10) * 100}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-primary)'
                      }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      {decision.vibrationIntensity}/10
                    </span>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                {/* Light */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Light Spectrum</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: `rgb(${decision.lightColor.r}, ${decision.lightColor.g}, ${decision.lightColor.b})`,
                      border: '2px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: `0 0 10px rgb(${decision.lightColor.r}, ${decision.lightColor.g}, ${decision.lightColor.b})`
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      rgb({decision.lightColor.r},{decision.lightColor.g},{decision.lightColor.b})
                    </span>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                {/* Audio */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Soundtrack</span>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>
                    {TRACK_NAMES[decision.audioTrack] || `Track ${decision.audioTrack}`}
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div style={{
                backgroundColor: 'rgba(124, 106, 247, 0.08)',
                border: '1px dashed var(--color-primary)',
                borderRadius: '12px',
                padding: '12px 16px'
              }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  💡 {decision.reasoning}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  id="ai-start-therapy-btn"
                  type="button"
                  onClick={handleStartTherapy}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 'var(--radius-btn)',
                    background: 'linear-gradient(135deg, #7C6AF7 0%, #5E4EE6 100%)',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 20px rgba(124, 106, 247, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <Play size={18} fill="#FFFFFF" />
                  ▶ Start This Therapy
                </button>

                <button
                  id="ai-adjust-manually-btn"
                  type="button"
                  onClick={handleAdjustManually}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 'var(--radius-btn)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Edit3 size={16} />
                  ✏️ Adjust Manually
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.92); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.95; }
          100% { transform: scale(0.92); opacity: 0.6; }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
