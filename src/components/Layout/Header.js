import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/board/anxiety', label: 'Anxiety', icon: '😰' },
  { path: '/board/depression', label: 'Depression', icon: '😔' },
  { path: '/board/support', label: 'Support', icon: '🤝' },
  { path: '/board/success', label: 'Success', icon: '✨' },
  { path: '/guidelines', label: 'Guidelines', icon: '📋' },
];

const Header = () => {
  const location = useLocation();
  const [stripVisible, setStripVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="chan-header">
      {/* Crisis Strip */}
      {stripVisible && (
        <div className="crisis-strip">
          <span>🚨 In crisis? Call <a href="tel:988">988</a> · Text HOME to <a href="sms:741741&body=HOME">741741</a> · Emergency: <a href="tel:911">911</a></span>
          <button
            className="crisis-strip-dismiss"
            onClick={() => setStripVisible(false)}
            aria-label="Dismiss crisis strip"
          >✕</button>
        </div>
      )}

      {/* Main Header Row */}
      <div className="header-inner">
        {/* Logo */}
        <Link to="/" className="header-logo" onClick={() => setDrawerOpen(false)}>
          <div className="header-logo-icon">🧠</div>
          <div className="header-logo-text">
            <h1>AdiYogi</h1>
            <p>Safe · Anonymous · Supportive</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="chan-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
          <Link to="/crisis" className="nav-item nav-crisis">
            <span className="nav-icon">🚨</span>
            <span className="nav-label">Crisis Help</span>
          </Link>
        </nav>

        {/* Hamburger */}
        <button
          className={`hamburger-btn ${drawerOpen ? 'open' : ''}`}
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        <div className="mobile-drawer-panel">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <Link
            to="/crisis"
            className="mobile-crisis-btn"
            onClick={() => setDrawerOpen(false)}
          >
            🚨 Crisis Help
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
