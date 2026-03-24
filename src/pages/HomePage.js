import React from 'react';
import { Link } from 'react-router-dom';
import BoardList from '../components/Board/BoardList';

const stats = [
  { value: '50K+', label: 'Community Posts' },
  { value: '10K+', label: 'Members Helped' },
  { value: '24/7', label: 'Always Available' },
  { value: '100%', label: 'Anonymous' },
];

const features = [
  {
    icon: '🔒',
    title: 'Fully Anonymous',
    desc: 'No account, no tracking, no judgment. Share freely without revealing who you are.',
    color: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
  },
  {
    icon: '🤝',
    title: 'Peer Support',
    desc: 'Real people who understand. Our community of peers offers genuine empathy and shared experience.',
    color: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
  },
  {
    icon: '🛡️',
    title: 'AI-Moderated Safety',
    desc: 'Intelligent crisis detection and moderation to keep every conversation safe and supportive.',
    color: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
];

const recentActivity = [
  { board: 'Anxiety', text: 'Breathing exercises that actually helped my panic attacks', time: '2m ago' },
  { board: 'Success', text: 'One year clean — sharing what worked for me', time: '8m ago' },
  { board: 'Depression', text: 'Finally talked to a therapist. Here\'s what happened.', time: '15m ago' },
  { board: 'Support', text: 'How do you tell your family about your diagnosis?', time: '22m ago' },
];

const HomePage = () => {
  return (
    <div className="home-page" style={{ animation: 'fadeIn 0.5s ease' }}>

      {/* ===== HERO ===== */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="badge-dot" />
          Smart India Hackathon 2024 · Mental Health Innovation
        </div>

        <h1>
          You Don't Have to Face This{' '}
          <span className="hero-gradient-text">Alone</span>
        </h1>

        <p>
          AdiYogi is a safe, anonymous peer-support community for mental health.
          No registration, no judgment — just compassionate people who understand.
        </p>

        <div className="hero-cta-row">
          <Link to="/board/support" className="btn btn-primary btn-lg">
            💬 Start a Conversation
          </Link>
          <Link to="/crisis" className="btn btn-secondary btn-lg">
            🚨 Get Crisis Help
          </Link>
        </div>

        <div className="hero-stats">
          {stats.map(s => (
            <div className="hero-stat" key={s.label}>
              <span className="hero-stat-value">{s.value}</span>
              <span className="hero-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="section" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: f.color,
              border: `1px solid ${f.border}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              transition: 'var(--transition)',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.05rem', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SAFETY NOTICE ===== */}
      <section className="section" style={{ marginBottom: '2.5rem' }}>
        <div className="notice-card">
          <h3>🛡️ Community Guidelines</h3>
          <ul>
            <li><strong>Be respectful</strong> — Everyone is fighting their own battles</li>
            <li><strong>Stay anonymous</strong> — Don't share personal identifying information</li>
            <li><strong>Seek professional help</strong> — This community supplements, not replaces therapy</li>
            <li><strong>Crisis support</strong> — If in immediate danger, call 988 or 911</li>
          </ul>
          <Link to="/guidelines" className="guidelines-link">
            📋 Read Full Community Guidelines →
          </Link>
        </div>
      </section>

      {/* ===== BOARDS ===== */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">🏠 Support Boards</h2>
          <p className="section-subtitle">
            Choose a board that matches your needs. All discussions are anonymous and moderated for safety.
          </p>
        </div>
        <div className="section-divider" />
        <BoardList />
      </section>

      {/* ===== LIVE ACTIVITY ===== */}
      <section className="section" style={{ marginTop: '3rem' }}>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title">⚡ Community Activity</h2>
          <span className="live-indicator">
            <span className="live-dot" />
            Live
          </span>
        </div>
        <div className="activity-preview">
          {recentActivity.map((item, i) => (
            <div className="activity-item" key={i}>
              <span className="board-name">{item.board}</span>
              <span className="activity-text">{item.text}</span>
              <span className="activity-time">{item.time}</span>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.825rem', color: 'var(--text-tertiary)' }}>
          <em>Join thousands of others in supportive, anonymous conversations every day.</em>
        </p>
      </section>

      {/* ===== MISSION STATEMENT ===== */}
      <section className="section" style={{ marginTop: '3rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(16,185,129,0.05))',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💚</div>
          <h2 style={{ fontSize: '1.7rem', marginBottom: '1rem' }}>
            Mental health matters — and{' '}
            <span className="hero-gradient-text">so do you</span>
          </h2>
          <p style={{ maxWidth: '540px', margin: '0 auto 1.5rem', fontSize: '1rem', lineHeight: 1.7 }}>
            AdiYogi was built on the belief that no one should face mental health struggles alone.
            Our anonymous community provides the peer support, resources, and compassion that everyone deserves.
          </p>
          <Link to="/board/support" className="btn btn-primary">
            Join the Community →
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
