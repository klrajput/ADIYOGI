import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="chan-footer">
      <div className="footer-content">
        {/* Brand */}
        <div className="footer-brand">
          <h4>🧠 AdiYogi</h4>
          <p>
            A safe, anonymous peer-support community for mental health discussions.
            Built with compassion for every mind on its journey.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(16,185,129,0.12)',
              color: '#34D399',
              border: '1px solid rgba(16,185,129,0.25)',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 600
            }}>100% Anonymous</span>
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(245,158,11,0.1)',
              color: '#FCD34D',
              border: '1px solid rgba(245,158,11,0.25)',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 600
            }}>24/7 Community</span>
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(139,92,246,0.1)',
              color: '#C4B5FD',
              border: '1px solid rgba(139,92,246,0.25)',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 600
            }}>AI-Moderated Safety</span>
          </div>
        </div>

        {/* Crisis Resources */}
        <div className="footer-section">
          <h4>🚨 Crisis Resources</h4>
          <ul>
            <li>
              <a href="tel:988" className="footer-crisis-number">988</a>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block' }}>Suicide & Crisis Lifeline</span>
            </li>
            <li style={{ marginTop: '0.5rem' }}>
              <a href="sms:741741&body=HOME" className="footer-crisis-number">741741</a>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block' }}>Crisis Text Line (text HOME)</span>
            </li>
            <li style={{ marginTop: '0.5rem' }}>
              <a href="tel:911" className="footer-crisis-number">911</a>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block' }}>Emergency Services</span>
            </li>
          </ul>
        </div>

        {/* Community */}
        <div className="footer-section">
          <h4>Community</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/board/anxiety">Anxiety & Panic</Link></li>
            <li><Link to="/board/depression">Depression Support</Link></li>
            <li><Link to="/board/success">Success Stories</Link></li>
            <li><Link to="/board/resources">Resources & Tools</Link></li>
          </ul>
        </div>

        {/* About */}
        <div className="footer-section">
          <h4>Platform</h4>
          <ul>
            <li><Link to="/guidelines">Community Guidelines</Link></li>
            <li><Link to="/crisis">Crisis Resources</Link></li>
            <li><Link to="/board/crisis">Crisis Support Board</Link></li>
          </ul>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.15)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
              🏆 Smart India Hackathon 2024
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0' }}>
              Team Adiyogi · Mental Health Innovation
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <p>
          ⚠️ <strong>Disclaimer:</strong> AdiYogi provides peer support only and does not replace professional mental health care. In emergencies, contact 988 or 911.
        </p>
        <p>© {year} AdiYogi · Built with 💚 for every mind</p>
      </div>
    </footer>
  );
};

export default Footer;
