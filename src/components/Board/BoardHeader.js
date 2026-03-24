import React from 'react';
import { Link } from 'react-router-dom';

const supportLevelColors = {
  crisis: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.25)', text: '#fca5a5', label: '🚨 Crisis Support' },
  peer:    { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', label: '🤝 Peer Support' },
  general: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)',  text: '#7dd3fc', label: '💬 General Discussion' },
};

const BoardHeader = ({ board }) => {
  if (!board) return null;
  const level = supportLevelColors[board.supportLevel] || supportLevelColors.general;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${level.bg.replace('0.08', '0.12')}, rgba(245,158,11,0.04))`,
      border: `1px solid ${level.border}`,
      borderRadius: 'var(--radius-xl)',
      padding: '2rem',
      marginBottom: '2rem',
      position: 'relative',
      overflow: 'hidden',
      animation: 'fadeUp 0.5s ease',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '-50%', right: '-5%', width: 200, height: 200, background: `radial-gradient(circle, ${level.bg}, transparent)`, pointerEvents: 'none' }} />

      {/* Breadcrumb */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-tertiary)', transition: 'color 0.15s' }}>Home</Link>
        <span>›</span>
        <span style={{ color: level.text, fontWeight: 600 }}>/{board.id}/</span>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: 52, height: 52,
              background: level.bg,
              border: `1px solid ${level.border}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', flexShrink: 0,
            }}>
              {board.icon}
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)', margin: 0, lineHeight: 1.2 }}>
                {board.name}
              </h1>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                /{board.id}/
              </span>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
            {board.description}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            { n: board.stats?.threads || 0, l: 'Threads' },
            { n: board.stats?.posts || 0,   l: 'Posts' },
            { n: board.stats?.active || 0,  l: 'Active Now', color: 'var(--brand-emerald)' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center', padding: '0.75rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color || 'var(--brand-gold)', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                {s.n.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Support Level + Guidelines */}
      <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ background: level.bg, border: `1px solid ${level.border}`, color: level.text, padding: '0.3rem 0.7rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
          {level.label}
        </span>
        {board.guidelines?.slice(0, 2).map((g, i) => (
          <span key={i} style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ color: 'var(--brand-emerald)', fontSize: '0.7rem' }}>✓</span> {g}
          </span>
        ))}
      </div>

      {/* Crisis board special warning */}
      {board.supportLevel === 'crisis' && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#fca5a5' }}>
          🚨 <strong>For immediate crisis:</strong> Call <a href="tel:988" style={{ color: '#fcd34d', fontWeight: 700 }}>988</a> now · This board provides peer support, not crisis intervention.
        </div>
      )}
    </div>
  );
};

export default BoardHeader;
