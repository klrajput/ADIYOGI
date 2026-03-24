import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import forumStore from '../../utils/forumStore';

const formatTimeAgo = (timestamp) => {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const ThreadList = ({ boardId }) => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise(r => setTimeout(r, 300));
      const all = forumStore.getThreadsByBoard(boardId);
      setThreads(sorted(all, sortBy));
      setLoading(false);
    };
    load();
    const unsub = forumStore.subscribe(() => {
      setThreads(sorted(forumStore.getThreadsByBoard(boardId), sortBy));
    });
    return unsub;
  }, [boardId, sortBy]);

  const sorted = (arr, by) => [...arr].sort((a, b) => {
    if (by === 'replies') return b.replyCount - a.replyCount;
    if (by === 'created') return new Date(b.timestamp) - new Date(a.timestamp);
    return new Date(b.lastReply) - new Date(a.lastReply);
  });

  if (loading) return (
    <div className="loading-container" style={{ minHeight: '30vh' }}>
      <div className="loading-spinner">
        <div className="spinner" />
        <p>Loading threads…</p>
      </div>
    </div>
  );

  if (threads.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--glass-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
      <h3 style={{ marginBottom: '0.5rem' }}>No threads yet</h3>
      <p>Be the first to start a discussion in this board!</p>
    </div>
  );

  return (
    <div className="thread-list">
      {/* Header & Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <span style={{ color: 'var(--brand-gold)' }}>/{boardId}/</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontWeight: 400 }}>{threads.length} threads</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Sort:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="form-control"
            style={{ margin: 0, padding: '0.4rem 0.7rem', fontSize: '0.82rem', width: 'auto', borderRadius: 'var(--radius-sm)' }}
          >
            <option value="recent">Recent Activity</option>
            <option value="created">Newest First</option>
            <option value="replies">Most Replies</option>
          </select>
        </div>
      </div>

      {/* Thread Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {threads.map((thread, idx) => {
          const isNew = (Date.now() - new Date(thread.timestamp)) < 3600000;
          return (
            <Link
              key={thread.id}
              to={`/thread/${thread.id}`}
              className="thread-item"
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  {/* Meta row */}
                  <div className="thread-meta" style={{ marginBottom: '0.6rem' }}>
                    <span className="anonymous-badge">👤 Anon</span>
                    <span className="thread-meta-item">🕐 {formatTimeAgo(thread.timestamp)}</span>
                    <span className="thread-meta-item">/{thread.boardId}/</span>
                    {isNew && <span className="thread-new-badge">NEW</span>}
                    {thread.hasContentWarning && (
                      <span style={{ background: 'rgba(249,115,22,0.12)', color: '#fed7aa', border: '1px solid rgba(249,115,22,0.3)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700 }}>
                        ⚠️ CW
                      </span>
                    )}
                  </div>

                  {thread.subject && <h3 className="thread-title">{thread.subject}</h3>}
                  <p className="thread-preview">{thread.preview}</p>

                  {thread.tags && (
                    <div className="board-tags" style={{ marginBottom: 0 }}>
                      {thread.tags.map(t => <span key={t} className="board-tag">#{t}</span>)}
                    </div>
                  )}
                </div>

                {/* Reply count badge */}
                <div style={{ textAlign: 'center', flexShrink: 0, padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-md)', minWidth: 64 }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-gold)', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    {thread.replyCount}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>
                    replies
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
        Showing {threads.length} threads · All discussions are 100% anonymous
      </p>
    </div>
  );
};

export default ThreadList;
