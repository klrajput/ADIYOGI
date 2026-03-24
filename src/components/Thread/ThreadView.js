import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import forumStore from '../../utils/forumStore';

const formatTimeAgo = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const PostCard = ({ post, index, isOP }) => (
  <div className="post-container" style={{ borderLeft: isOP ? '3px solid var(--brand-gold)' : undefined }}>
    <div className="post-header">
      <div className="post-meta">
        <span className="anonymous-badge">{isOP ? '👤 Anon OP' : '👤 Anon'}</span>
        <span className="thread-meta-item">🕐 {formatTimeAgo(post.timestamp)}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>#{index + 1}</span>
        {isOP && (
          <span style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--brand-gold-light)', border: '1px solid rgba(245,158,11,0.25)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700 }}>
            Original Post
          </span>
        )}
      </div>
      <button
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.78rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}
        onMouseEnter={e => e.target.style.color = 'var(--brand-rose)'}
        onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
      >
        🚩 Report
      </button>
    </div>

    {post.hasContentWarning && (
      <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#fed7aa' }}>
        ⚠️ Content Warning: This post may contain triggering content. Read with care.
      </div>
    )}

    <div className="post-content">{post.content}</div>

    {/* Support reactions */}
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-subtle)' }}>
      {['❤️ Support', '🤝 Relate', '🕊️ Heal'].map(r => (
        <button key={r} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.7rem',
          fontSize: '0.75rem', cursor: 'pointer', transition: 'var(--transition-fast)',
          fontFamily: "'Inter', sans-serif",
        }}
          onMouseEnter={e => { e.target.style.background = 'rgba(245,158,11,0.08)'; e.target.style.borderColor = 'rgba(245,158,11,0.3)'; e.target.style.color = 'var(--brand-gold-light)'; }}
          onMouseLeave={e => { e.target.style.background = ''; e.target.style.borderColor = ''; e.target.style.color = ''; }}
        >{r}</button>
      ))}
    </div>
  </div>
);

const ThreadView = ({ threadId }) => {
  const [threadData, setThreadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await new Promise(r => setTimeout(r, 300));
        const data = forumStore.getThreadById(threadId);
        if (!data) throw new Error('Thread not found');
        setThreadData(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsub = forumStore.subscribe(() => {
      const t = forumStore.getThreadById(threadId);
      if (t) setThreadData(t);
    });
    return unsub;
  }, [threadId]);

  if (loading) return (
    <div className="loading-container" style={{ minHeight: '30vh' }}>
      <div className="loading-spinner"><div className="spinner" /><p>Loading thread…</p></div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
      <h2 style={{ marginBottom: '0.5rem' }}>Thread Not Found</h2>
      <p style={{ marginBottom: '1.5rem' }}>This thread may have been removed or the link is incorrect.</p>
      <Link to="/" className="btn btn-secondary">← Back to Home</Link>
    </div>
  );

  return (
    <div className="thread-view" style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
        <Link to="/" style={{ color: 'var(--text-tertiary)', transition: 'var(--transition-fast)' }}
          onMouseEnter={e => e.target.style.color = 'var(--brand-gold)'}
          onMouseLeave={e => e.target.style.color = ''}>Home</Link>
        <span>›</span>
        <Link to={`/board/${threadData.boardId}`} style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>
          /{threadData.boardId}/
        </Link>
        <span>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{threadData.subject || 'Thread'}</span>
      </div>

      {/* Thread Subject */}
      {threadData.subject && (
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          {threadData.subject}
        </h1>
      )}

      {/* OP Post */}
      <PostCard post={threadData} index={0} isOP={true} />

      {/* Replies */}
      {threadData.posts && threadData.posts.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>
              💬 {threadData.posts.length} {threadData.posts.length === 1 ? 'Reply' : 'Replies'}
            </h3>
            <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
          </div>
          {threadData.posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i + 1} isOP={false} />
          ))}
        </div>
      )}

      {/* Crisis reminder */}
      <div style={{
        marginTop: '2rem',
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
          💚 <strong>Peer support, not therapy.</strong> If you're in crisis, call <a href="tel:988" style={{ color: 'var(--brand-gold)', fontWeight: 700 }}>988</a> or text HOME to <a href="sms:741741&body=HOME" style={{ color: 'var(--brand-gold)', fontWeight: 700 }}>741741</a>.
        </p>
        <Link to="/crisis" style={{ fontSize: '0.8rem', color: 'var(--brand-emerald)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Crisis Resources →
        </Link>
      </div>
    </div>
  );
};

export default ThreadView;
