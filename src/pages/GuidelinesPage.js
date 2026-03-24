import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const values = [
  { icon: '🤝', title: 'Peer Support', desc: 'Real people, real empathy. Everyone has something valuable to contribute.' },
  { icon: '🔒', title: 'Anonymity', desc: 'Complete anonymity means open, honest discussions without fear of judgment.' },
  { icon: '🛡️', title: 'Safety First', desc: 'AI-powered crisis detection and active moderation keeps everyone safe.' },
  { icon: '❤️', title: 'Compassion', desc: 'We approach every interaction with kindness — everyone is fighting battles we can\'t see.' },
];

const rules = [
  {
    num: '01', icon: '🤝', title: 'Be Respectful and Kind',
    items: ['Treat all members with respect and compassion', 'No personal attacks, harassment, or discrimination', 'Respect different perspectives and experiences', 'Use supportive language, even when disagreeing'],
  },
  {
    num: '02', icon: '🔒', title: 'Maintain Anonymity',
    items: ['Don\'t share personal identifying info (names, locations, photos)', 'Don\'t ask others for personal details', 'Don\'t try to identify or contact users outside this platform'],
  },
  {
    num: '03', icon: '🎯', title: 'Stay On Topic',
    items: ['Keep discussions focused on mental health support', 'Post in the appropriate board for your topic', 'Use clear, descriptive thread titles'],
  },
  {
    num: '04', icon: '⚠️', title: 'Use Content Warnings',
    items: ['Include CW: for potentially triggering material', 'Be mindful of graphic descriptions', 'Consider the impact of your words on vulnerable readers'],
  },
  {
    num: '05', icon: '🚫', title: 'No Medical Advice',
    items: ['Share personal experiences only — not medical advice', 'Never recommend specific medications or dosages', 'Always encourage professional medical consultation'],
  },
  {
    num: '06', icon: '🚨', title: 'Report Harmful Content',
    items: ['Report posts violating guidelines', 'Flag content indicating immediate danger', 'Help keep our community safe for everyone'],
  },
];

const GuidelinesPage = () => {
  const [openRule, setOpenRule] = useState(null);

  return (
    <div className="guidelines-page" style={{ animation: 'fadeIn 0.5s ease' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(16,185,129,0.06))',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        marginBottom: '3rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '0.75rem' }}>Community Guidelines</h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
          AdiYogi is built on respect, empathy, and mutual support. These guidelines help maintain
          a safe and supportive environment for every member.
        </p>
      </div>

      {/* Core Values */}
      <section className="section">
        <h2 className="section-title">💚 Our Core Values</h2>
        <div className="section-divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {values.map(v => (
            <div key={v.title} style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              transition: 'var(--transition)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{v.icon}</div>
              <h3 style={{ fontSize: '1rem', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '0.5rem' }}>{v.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rules — Accordion */}
      <section className="section">
        <h2 className="section-title">📜 Community Rules</h2>
        <div className="section-divider" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {rules.map((rule, i) => (
            <div key={i}
              style={{
                background: openRule === i ? 'rgba(255,255,255,0.06)' : 'var(--glass-bg)',
                border: openRule === i ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'var(--transition)',
              }}
            >
              <button
                onClick={() => setOpenRule(openRule === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1.1rem 1.25rem', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ color: 'var(--brand-gold)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.05em', minWidth: 28 }}>{rule.num}</span>
                <span style={{ fontSize: '1.2rem' }}>{rule.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.975rem', fontFamily: "'Space Grotesk', sans-serif" }}>{rule.title}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', transition: 'transform 0.3s ease', transform: openRule === i ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
              </button>
              {openRule === i && (
                <div style={{ padding: '0 1.25rem 1.1rem 4rem' }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {rule.items.map((item, j) => (
                      <li key={j} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '0.35rem 0 0.35rem 1.1rem', position: 'relative', lineHeight: 1.55 }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--brand-emerald)' }}>✓</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Crisis Protocol */}
      <section className="section">
        <h2 className="section-title">🚨 Crisis Protocol</h2>
        <div className="section-divider" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ color: '#fca5a5', fontSize: '1rem', marginBottom: '1rem' }}>If You're in Crisis:</h3>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              {['Call 988 — Suicide & Crisis Lifeline (24/7)', 'Text HOME to 741741 — Crisis Text Line', 'Call 911 if in immediate physical danger', 'Go to nearest emergency room', 'Reach out to a trusted person'].map((s, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>{s}</li>
              ))}
            </ol>
          </div>
          <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ color: '#7dd3fc', fontSize: '1rem', marginBottom: '1rem' }}>If You See Someone in Crisis:</h3>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              {['Take it seriously — never dismiss crisis statements', 'Be supportive and listen without judgment', 'Share crisis hotline information', 'Use the report function in the platform', 'Don\'t try to counsel — you\'re not a professional'].map((s, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>{s}</li>
              ))}
            </ol>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            <strong style={{ color: 'var(--brand-gold)' }}>Important:</strong> AdiYogi provides peer support, not crisis intervention.
            We are not mental health professionals. Always encourage professional help for crisis situations.
          </p>
        </div>
      </section>

      {/* Commitment */}
      <section className="section">
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(245,158,11,0.06))',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🤝 Our Commitment to You</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
            AdiYogi is committed to providing a safe, anonymous space for mental health support.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '2rem' }}>
            {['Strict anonymity protection', 'Fast response to safety concerns', 'Crisis resources & support', 'Judgment-free environment', 'Community-driven improvement'].map((p, i) => (
              <span key={i} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                ✅ {p}
              </span>
            ))}
          </div>
          <Link to="/" className="btn btn-primary">🏠 Return to Community</Link>
        </div>
      </section>
    </div>
  );
};

export default GuidelinesPage;
