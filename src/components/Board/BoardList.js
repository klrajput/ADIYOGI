import React from 'react';
import { Link } from 'react-router-dom';

const BoardList = () => {
  // Inline boards data to avoid import issues and add visual variety
  const boards = [
    { id: 'anxiety', name: 'Anxiety & Panic', icon: '😰', color: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)', iconBg: 'rgba(139,92,246,0.15)', description: 'Support for anxiety disorders, panic attacks, social anxiety, and coping strategies', supportLevel: 'peer', tags: ['anxiety', 'panic', 'coping'], stats: { threads: 1247, posts: 8934, active: 23 } },
    { id: 'depression', name: 'Depression Support', icon: '😔', color: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.2)', iconBg: 'rgba(56,189,248,0.12)', description: 'A space for depression support, understanding, and recovery discussions', supportLevel: 'peer', tags: ['depression', 'mood', 'recovery'], stats: { threads: 892, posts: 6234, active: 18 } },
    { id: 'trauma', name: 'Trauma & PTSD', icon: '💔', color: 'rgba(244,63,94,0.06)', border: 'rgba(244,63,94,0.18)', iconBg: 'rgba(244,63,94,0.12)', description: 'Support for trauma survivors, PTSD, and healing discussions with care', supportLevel: 'peer', tags: ['trauma', 'ptsd', 'healing'], stats: { threads: 634, posts: 4521, active: 12 } },
    { id: 'addiction', name: 'Addiction & Recovery', icon: '🔄', color: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', iconBg: 'rgba(245,158,11,0.12)', description: 'Support for addiction recovery, sobriety, and substance abuse issues', supportLevel: 'peer', tags: ['addiction', 'recovery', 'sobriety'], stats: { threads: 445, posts: 3234, active: 15 } },
    { id: 'relationships', name: 'Relationships & Social', icon: '💕', color: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.2)', iconBg: 'rgba(236,72,153,0.12)', description: 'Support for relationship issues, family problems, and social difficulties', supportLevel: 'general', tags: ['relationships', 'family', 'social'], stats: { threads: 756, posts: 5123, active: 19 } },
    { id: 'success', name: 'Success Stories', icon: '✨', color: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.22)', iconBg: 'rgba(16,185,129,0.12)', description: 'Share victories, milestones, and positive progress in your mental health journey', supportLevel: 'peer', tags: ['success', 'victories', 'progress'], stats: { threads: 234, posts: 1876, active: 8 } },
    { id: 'crisis', name: 'Crisis Support', icon: '🚨', color: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', iconBg: 'rgba(220,38,38,0.15)', description: 'Immediate peer support for mental health crises — not a substitute for professional help', supportLevel: 'crisis', tags: ['crisis', 'emergency', 'immediate'], stats: { threads: 123, posts: 892, active: 6 } },
    { id: 'resources', name: 'Resources & Tools', icon: '📚', color: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', iconBg: 'rgba(245,158,11,0.1)', description: 'Share mental health resources, apps, books, and helpful tools for wellbeing', supportLevel: 'general', tags: ['resources', 'tools', 'apps'], stats: { threads: 345, posts: 2134, active: 11 } },
  ];

  return (
    <div>
      <div className="board-grid">
        {boards.map((board, idx) => (
          <Link
            key={board.id}
            to={`/board/${board.id}`}
            className="board-card"
            style={{
              background: board.color,
              borderColor: board.border,
              animationDelay: `${idx * 0.05}s`,
              animationFillMode: 'both',
              animation: `fadeUp 0.5s ease ${idx * 0.05}s both`,
            }}
          >
            {/* Icon */}
            <div className="board-card-icon" style={{ background: board.iconBg, borderColor: board.border }}>
              {board.icon}
            </div>

            {/* Title + Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <h3 className="board-title">{board.name}</h3>
              <span className={`support-badge ${board.supportLevel}`}>
                {board.supportLevel === 'crisis' ? '🚨 Crisis' : board.supportLevel === 'peer' ? '🤝 Peer' : '💬 General'}
              </span>
            </div>

            {/* Description */}
            <p className="board-description">{board.description}</p>

            {/* Tags */}
            <div className="board-tags">
              {board.tags.map(tag => (
                <span key={tag} className="board-tag">#{tag}</span>
              ))}
            </div>

            {/* Stats */}
            <div className="board-stats">
              <div className="board-stat-item">
                <span className="board-stat-number">{board.stats.threads.toLocaleString()}</span>
                <span className="board-stat-label">Threads</span>
              </div>
              <div className="board-stat-item">
                <span className="board-stat-number">{board.stats.posts.toLocaleString()}</span>
                <span className="board-stat-label">Posts</span>
              </div>
              <div className="board-stat-item">
                <span className="board-stat-number" style={{ color: 'var(--brand-emerald)' }}>{board.stats.active}</span>
                <span className="board-stat-label">Active Now</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* How It Works */}
      <div className="board-info" style={{ marginTop: '2.5rem' }}>
        <div className="info-card">
          <h4>🚀 How It Works</h4>
          <ol>
            <li><strong>Choose a board</strong> that matches your needs</li>
            <li><strong>Browse existing threads</strong> or start a new discussion</li>
            <li><strong>Post anonymously</strong> — no registration required</li>
            <li><strong>Support others</strong> and receive community support</li>
          </ol>
        </div>
        <div className="info-card">
          <h4>🔒 Your Privacy, Guaranteed</h4>
          <p>
            All posts are anonymous by design. Share freely without worrying about your identity.
            Our platform never logs IPs or requires personal information. Focus entirely on
            getting — and giving — support in a judgment-free environment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BoardList;
