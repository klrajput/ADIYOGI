import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const CrisisAlert = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="crisis-alert" role="alert" aria-live="assertive">
      <div className="crisis-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🚨 Crisis Support Detected</h3>
        <button
          className="crisis-strip-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss alert"
          style={{ position: 'static' }}
        >✕</button>
      </div>
      <p style={{ color: '#fecaca', fontSize: '0.9rem', marginBottom: '1rem' }}>
        It looks like you might be going through something difficult. You are not alone — trained counselors are available right now.
      </p>
      <div className="crisis-actions">
        <a href="tel:988" className="crisis-button primary">📞 Call 988 Now</a>
        <a href="sms:741741&body=HOME" className="crisis-button secondary">💬 Text HOME to 741741</a>
        <Link to="/crisis" className="crisis-button emergency">🛡️ All Crisis Resources</Link>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '0.75rem' }}>
        All crisis services are <strong>free, confidential, and available 24/7</strong>
      </p>
    </div>
  );
};

export default CrisisAlert;
