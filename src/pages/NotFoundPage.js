import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div style={{
    minHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '3rem 1.5rem',
    animation: 'fadeUp 0.6s ease',
  }}>
    <div style={{
      fontSize: '5rem',
      marginBottom: '1rem',
      display: 'inline-block',
      animation: 'float 3s ease-in-out infinite',
    }}>🧠</div>

    <h1 style={{
      fontSize: 'clamp(4rem, 12vw, 8rem)',
      fontWeight: 900,
      background: 'linear-gradient(135deg, #F59E0B, #10B981)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      lineHeight: 1,
      marginBottom: '0.5rem',
      letterSpacing: '-0.04em',
    }}>404</h1>

    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
      Page Not Found
    </h2>

    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '2rem', lineHeight: 1.6 }}>
      Looks like this page wandered off. Let's get you back to a safe space.
    </p>

    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <Link to="/" className="btn btn-primary">🏠 Go Home</Link>
      <Link to="/board/support" className="btn btn-secondary">🤝 Support Board</Link>
      <Link to="/crisis" className="btn btn-secondary">🚨 Crisis Help</Link>
    </div>

    <div style={{
      marginTop: '3rem',
      padding: '1.25rem 2rem',
      background: 'rgba(244,63,94,0.08)',
      border: '1px solid rgba(244,63,94,0.2)',
      borderRadius: 'var(--radius-lg)',
      maxWidth: '420px',
    }}>
      <p style={{ fontSize: '0.875rem', color: '#fca5a5', margin: 0 }}>
        🚨 If you're in crisis, call <a href="tel:988" style={{ color: '#fcd34d', fontWeight: 700 }}>988</a> or
        text <a href="sms:741741&body=HOME" style={{ color: '#fcd34d', fontWeight: 700 }}>HOME to 741741</a>
      </p>
    </div>
  </div>
);

export default NotFoundPage;
