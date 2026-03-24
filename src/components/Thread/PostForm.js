import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import forumStore from '../../utils/forumStore';

const MAX_CONTENT = 3000;
const MAX_SUBJECT = 120;

const PostForm = ({ boardId, threadId, isNewThread = false, placeholder = 'Share your thoughts anonymously…' }) => {
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [hasContentWarning, setHasContentWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      const sanitized = DOMPurify.sanitize(content);
      if (isNewThread) {
        const thread = forumStore.addThread({
          content: sanitized,
          subject: subject.trim() || 'Anonymous Thread',
          preview: sanitized.substring(0, 200) + (sanitized.length > 200 ? '…' : ''),
          boardId,
          hasContentWarning,
          tags: [],
        });
        setContent(''); setSubject(''); setHasContentWarning(false);
        navigate(`/thread/${thread.id}`);
      } else {
        forumStore.addReply(threadId, { content: sanitized, threadId, hasContentWarning });
        setContent(''); setHasContentWarning(false);
      }
    } catch (err) {
      console.error('Post error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const charPercent = (content.length / MAX_CONTENT) * 100;

  return (
    <div className="chan-form" style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>
          {isNewThread ? '✏️ Start New Thread' : '💬 Reply to Thread'}
        </h3>
        <span className="anonymous-badge">🔒 Anonymous</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Subject (new thread only) */}
        {isNewThread && (
          <div className="form-group">
            <label className="form-label">Thread Subject <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              className="form-control"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Briefly describe what you'd like to discuss…"
              maxLength={MAX_SUBJECT}
              style={{ marginBottom: 0 }}
            />
            <div className="form-char-counter">{subject.length}/{MAX_SUBJECT}</div>
          </div>
        )}

        {/* Content */}
        <div className="form-group">
          <label className="form-label">{isNewThread ? 'Your Message' : 'Your Reply'}</label>
          <textarea
            className="form-control form-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={placeholder}
            required
            maxLength={MAX_CONTENT}
            rows={isNewThread ? 7 : 5}
            style={{ marginBottom: 0 }}
          />
          {/* Character counter with progress bar */}
          <div style={{ marginTop: '0.4rem' }}>
            <div style={{ height: 2, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${charPercent}%`,
                background: charPercent > 85 ? 'var(--brand-coral)' : 'var(--brand-emerald)',
                transition: 'width 0.2s ease, background 0.3s ease',
                borderRadius: 2,
              }} />
            </div>
            <div className={`form-char-counter ${charPercent > 85 ? 'warning' : ''}`}>
              {content.length}/{MAX_CONTENT}
            </div>
          </div>
        </div>

        {/* Content Warning toggle */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setHasContentWarning(c => !c)}
            style={{
              background: hasContentWarning ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
              border: hasContentWarning ? '1px solid rgba(249,115,22,0.4)' : '1px solid var(--border-default)',
              color: hasContentWarning ? '#fed7aa' : 'var(--text-tertiary)',
              padding: '0.4rem 0.875rem',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              transition: 'var(--transition)',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            ⚠️ {hasContentWarning ? 'Content Warning Added' : 'Add Content Warning'}
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            For potentially triggering content
          </span>
        </div>

        {/* Crisis board special notice */}
        {boardId === 'crisis' && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#fca5a5' }}>
            🚨 <strong>For immediate crisis:</strong> Call <a href="tel:988" style={{ color: '#fcd34d', fontWeight: 700 }}>988</a> or text HOME to <a href="sms:741741&body=HOME" style={{ color: '#fcd34d', fontWeight: 700 }}>741741</a>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || !content.trim()}
          style={{ width: '100%', justifyContent: 'center', opacity: !content.trim() ? 0.5 : 1 }}
        >
          {isSubmitting ? (
            <><div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />{isNewThread ? 'Creating Thread…' : 'Posting Reply…'}</>
          ) : (
            <>{isNewThread ? '📝 Create Thread' : '💬 Post Reply'}</>
          )}
        </button>
      </form>

      {/* Reminders */}
      <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Good reminders</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {['🔒 Stay anonymous', '🤝 Be respectful', '⚠️ Add CW if needed', '👩‍⚕️ Not a substitute for therapy'].map(r => (
            <span key={r} style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)' }}>{r}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PostForm;
