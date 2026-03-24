import React, { useState } from 'react';

const BreathingExercise = () => {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState('ready'); // ready, inhale, hold, exhale
  const [count, setCount] = useState(0);

  const start = () => {
    setActive(true);
    runBreath();
  };

  const runBreath = () => {
    setPhase('inhale'); setCount(4);
    let t = 4;
    const inhaleTimer = setInterval(() => {
      t--;
      setCount(t);
      if (t === 0) {
        clearInterval(inhaleTimer);
        setPhase('hold'); t = 4; setCount(4);
        const holdTimer = setInterval(() => {
          t--;
          setCount(t);
          if (t === 0) {
            clearInterval(holdTimer);
            setPhase('exhale'); t = 6; setCount(6);
            const exhaleTimer = setInterval(() => {
              t--;
              setCount(t);
              if (t === 0) {
                clearInterval(exhaleTimer);
                setPhase('ready');
                setActive(false);
              }
            }, 1000);
          }
        }, 1000);
      }
    }, 1000);
  };

  const phaseText = { ready: 'Press to begin', inhale: 'Breathe in…', hold: 'Hold…', exhale: 'Breathe out…' };
  const phaseColor = { ready: 'var(--brand-gold)', inhale: 'var(--brand-emerald)', hold: 'var(--brand-sky)', exhale: 'var(--brand-violet)' };

  return (
    <div style={{ textAlign: 'center', padding: '1.5rem' }}>
      <div
        onClick={!active ? start : undefined}
        style={{
          width: 120, height: 120,
          borderRadius: '50%',
          margin: '0 auto 1.25rem',
          background: `radial-gradient(circle, ${phaseColor[phase]}33, ${phaseColor[phase]}11)`,
          border: `3px solid ${phaseColor[phase]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: active ? 'default' : 'pointer',
          transition: 'all 0.8s ease',
          animation: active ? 'breathe 1s ease-in-out infinite' : 'none',
          boxShadow: `0 0 30px ${phaseColor[phase]}33`,
        }}
      >
        <div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: phaseColor[phase], fontFamily: "'Space Grotesk', sans-serif" }}>
            {active ? count : '🌬️'}
          </div>
        </div>
      </div>
      <p style={{ color: phaseColor[phase], fontWeight: 600, fontSize: '1rem', transition: 'color 0.5s ease' }}>
        {phaseText[phase]}
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
        4-4-6 Box Breathing · Calms your nervous system
      </p>
    </div>
  );
};

const CrisisPage = () => {
  const [expandedCoping, setExpandedCoping] = React.useState(null);

  const copingCards = [
    {
      icon: '🧘', title: 'Grounding (5-4-3-2-1)',
      steps: ['Name 5 things you can SEE', 'Name 4 things you can TOUCH', 'Name 3 things you can HEAR', 'Name 2 things you can SMELL', 'Name 1 thing you can TASTE'],
    },
    {
      icon: '💧', title: 'Cold Water Technique',
      steps: ['Splash cold water on your face', 'Hold ice cubes in your hands', 'Step outside for fresh air', 'This activates your dive reflex', 'It slows your heart rate fast'],
    },
    {
      icon: '📞', title: 'Reach Out',
      steps: ['Call a trusted friend or family', 'Use Crisis Text Line (741741)', 'Contact your therapist', 'Go to a safe public place', 'Post in this community'],
    },
  ];

  return (
    <div className="crisis-page" style={{ animation: 'fadeIn 0.5s ease' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(127,29,29,0.7), rgba(153,27,27,0.4), rgba(124,45,18,0.3))',
        border: '1px solid rgba(244,63,94,0.3)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        marginBottom: '2.5rem',
        textAlign: 'center',
        animation: 'crisisPulse 4s ease-in-out infinite',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚨</div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: '#fef2f2', marginBottom: '0.75rem' }}>
          Crisis Resources & Immediate Help
        </h1>
        <p style={{ color: '#fecaca', fontSize: '1.05rem', maxWidth: '560px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
          If you're in crisis or emotional distress, help is available right now.
          You are not alone — and this feeling <strong>will pass</strong>.
        </p>
        <div className="crisis-actions">
          <a href="tel:988" className="crisis-button primary" style={{ fontSize: '1rem', padding: '0.85rem 1.5rem' }}>
            📞 Call 988 — Crisis Lifeline
          </a>
          <a href="sms:741741&body=HOME" className="crisis-button secondary" style={{ fontSize: '1rem', padding: '0.85rem 1.5rem' }}>
            💬 Text HOME to 741741
          </a>
          <a href="tel:911" className="crisis-button emergency" style={{ fontSize: '1rem', padding: '0.85rem 1.5rem' }}>
            🚑 Call 911 — Emergency
          </a>
        </div>
        <p style={{ color: '#fca5a5', fontSize: '0.82rem', marginTop: '1rem', fontStyle: 'italic' }}>
          All crisis services are free, confidential, and available 24/7
        </p>
      </div>

      {/* Breathing Exercise */}
      <section className="section">
        <div style={{
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--brand-emerald-light)', margin: 0 }}>
              🌬️ Breathing Exercise — Calm Your Mind Now
            </h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginTop: '0.3rem', marginBottom: 0 }}>
              Box breathing reduces cortisol and activates your parasympathetic nervous system
            </p>
          </div>
          <BreathingExercise />
        </div>
      </section>

      {/* Coping Strategies */}
      <section className="section">
        <h2 className="section-title">🧘 Immediate Coping Strategies</h2>
        <div className="section-divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {copingCards.map((card, i) => (
            <div key={i}
              style={{
                background: expandedCoping === i ? 'rgba(255,255,255,0.08)' : 'var(--glass-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                transition: 'var(--transition)',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedCoping(expandedCoping === i ? null : i)}
            >
              <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{card.icon}</span>
                  <h3 style={{ fontSize: '1rem', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{card.title}</h3>
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', transition: 'var(--transition)', transform: expandedCoping === i ? 'rotate(180deg)' : 'none' }}>▼</span>
              </div>
              {expandedCoping === i && (
                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                  <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                    {card.steps.map((step, j) => (
                      <li key={j} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.4rem', lineHeight: 1.5 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Warning Signs */}
      <section className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={{
            background: 'rgba(249,115,22,0.06)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}>
            <h3 style={{ color: '#fed7aa', marginBottom: '1rem', fontSize: '1rem' }}>⚠️ Warning Signs in Yourself or Others</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Talking about wanting to die or hurt themselves', 'Feeling hopeless or having no reason to live', 'Feeling trapped or in unbearable pain', 'Withdrawing from friends and family', 'Extreme mood swings or agitation', 'Increasing alcohol or drug use'].map((s, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '0.35rem 0', paddingLeft: '1.25rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#f97316' }}>•</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div style={{
            background: 'rgba(56,189,248,0.06)',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}>
            <h3 style={{ color: '#7dd3fc', marginBottom: '1rem', fontSize: '1rem' }}>💙 How to Help Someone in Crisis</h3>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              {['Take them seriously — don\'t dismiss their feelings', 'Listen without judgment', 'Don\'t leave them alone', 'Help them call crisis resources', 'Remove means of harm safely', 'Contact professional help immediately'].map((s, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Remember Card */}
      <section className="section">
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(245,158,11,0.06))',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💚</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.25rem', color: 'var(--brand-emerald-light)' }}>Remember</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', textAlign: 'left', maxWidth: '700px', margin: '0 auto 2rem' }}>
            {[
              { label: 'You matter.', text: 'Your life has value and meaning.' },
              { label: 'This is temporary.', text: 'Crises pass — you can get through this.' },
              { label: 'Help exists.', text: 'Trained counselors are ready right now.' },
              { label: 'You\'re not alone.', text: 'Millions have recovered from crisis.' },
            ].map((p, i) => (
              <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontWeight: 700, color: 'var(--brand-emerald-light)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{p.label}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>{p.text}</p>
              </div>
            ))}
          </div>
          <a href="tel:988" className="btn btn-primary btn-lg">📞 Call 988 — Free & Confidential</a>
        </div>
      </section>
    </div>
  );
};

export default CrisisPage;
