import React, { useState, useEffect } from 'react';
import forumAdmin from '../utils/forumAdmin';

const DatabaseViewer = () => {
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('stats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    const currentStats = forumAdmin.getStats();
    setStats(currentStats);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const results = forumAdmin.searchThreads(searchQuery, 'all');
    setSearchResults(results);
    setViewMode('search');
  };

  const handleExport = () => {
    const filename = `forum_backup_${new Date().toISOString().slice(0, 10)}.json`;
    forumAdmin.exportData(filename);
  };

  const handleClearData = () => {
    if (window.confirm('⚠️ This will permanently delete ALL forum data. Are you absolutely sure?')) {
      forumAdmin.clearAll(true);
    }
  };

  const handleAutoTag = () => {
    const tagged = forumAdmin.autoTag();
    alert(`Auto-tagged ${tagged} threads!`);
    loadStats();
  };

  if (!stats) return <div className="loading">Loading database stats...</div>;

  return (
    <div className="database-viewer">
      <div className="chan-container">
        <div className="chan-header">
          <h1>🗄️ Database Administration</h1>
          <p>Manage your forum's local storage database</p>
        </div>

        <div className="db-nav">
          <button 
            className={`nav-btn ${viewMode === 'stats' ? 'active' : ''}`}
            onClick={() => setViewMode('stats')}
          >
            📊 Statistics
          </button>
          <button 
            className={`nav-btn ${viewMode === 'search' ? 'active' : ''}`}
            onClick={() => setViewMode('search')}
          >
            🔍 Search
          </button>
          <button 
            className={`nav-btn ${viewMode === 'tools' ? 'active' : ''}`}
            onClick={() => setViewMode('tools')}
          >
            🛠️ Tools
          </button>
        </div>

        {viewMode === 'stats' && (
          <div className="stats-view">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>📝 Total Threads</h3>
                <div className="stat-number">{stats.totalThreads}</div>
              </div>
              <div className="stat-card">
                <h3>💬 Total Replies</h3>
                <div className="stat-number">{stats.totalReplies}</div>
              </div>
              <div className="stat-card">
                <h3>🚨 Content Warnings</h3>
                <div className="stat-number">{stats.contentWarnings}</div>
              </div>
              <div className="stat-card">
                <h3>🆕 Recent (24h)</h3>
                <div className="stat-number">{stats.recentThreads}</div>
              </div>
            </div>

            <div className="board-stats">
              <h3>📋 Threads by Board</h3>
              <div className="board-grid">
                {Object.entries(stats.boardCounts).map(([board, count]) => (
                  <div key={board} className="board-stat">
                    <span className="board-name">/{board}/</span>
                    <span className="board-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'search' && (
          <div className="search-view">
            <div className="search-form">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads and posts..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch}>🔍 Search</button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <h3>Found {searchResults.length} results:</h3>
                {searchResults.map(thread => (
                  <div key={thread.id} className="search-result">
                    <div className="result-header">
                      <span className="board-tag">/{thread.boardId}/</span>
                      <span className="thread-subject">{thread.subject}</span>
                      <span className="thread-date">
                        {new Date(thread.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="result-preview">
                      {thread.preview || thread.content.substring(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'tools' && (
          <div className="tools-view">
            <div className="tool-section">
              <h3>💾 Backup & Restore</h3>
              <div className="tool-buttons">
                <button onClick={handleExport} className="tool-btn export">
                  📥 Export All Data
                </button>
                <label htmlFor="import-file" className="tool-btn import">
                  📤 Import Data
                  <input
                    type="file"
                    id="import-file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            forumAdmin.importData(event.target.result);
                          } catch (error) {
                            alert('Import failed: ' + error.message);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="tool-section">
              <h3>🏷️ Content Management</h3>
              <div className="tool-buttons">
                <button onClick={handleAutoTag} className="tool-btn">
                  🏷️ Auto-Tag Threads
                </button>
                <button 
                  onClick={() => {
                    const words = prompt('Enter banned words (comma-separated):');
                    if (words) {
                      const banned = words.split(',').map(w => w.trim());
                      const removed = forumAdmin.moderateContent(banned);
                      alert(`Removed ${removed} pieces of content`);
                      loadStats();
                    }
                  }}
                  className="tool-btn warning"
                >
                  🚫 Moderate Content
                </button>
              </div>
            </div>

            <div className="tool-section danger">
              <h3>⚠️ Danger Zone</h3>
              <button onClick={handleClearData} className="tool-btn danger">
                🗑️ Clear All Data
              </button>
              <p><small>This action cannot be undone!</small></p>
            </div>

            <div className="console-help">
              <h3>💻 Console Commands</h3>
              <p>Open your browser's developer console and use <code>forumAdmin</code> for advanced operations:</p>
              <ul>
                <li><code>forumAdmin.help()</code> - Show all commands</li>
                <li><code>forumAdmin.getStats()</code> - Get detailed statistics</li>
                <li><code>forumAdmin.searchThreads('keyword')</code> - Search content</li>
                <li><code>forumAdmin.deleteThread('id')</code> - Delete specific thread</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .database-viewer {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 20px;
        }

        .db-nav {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          border-bottom: 2px solid var(--border-primary);
          padding-bottom: 10px;
        }

        .nav-btn {
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          color: var(--text-primary);
          padding: 10px 20px;
          cursor: pointer;
          font-weight: bold;
        }

        .nav-btn.active,
        .nav-btn:hover {
          background: var(--accent-primary);
          color: white;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }

        .stat-card {
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          padding: 20px;
          text-align: center;
        }

        .stat-number {
          font-size: 2em;
          font-weight: bold;
          color: var(--accent-primary);
          margin-top: 10px;
        }

        .board-stats {
          margin: 30px 0;
        }

        .board-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin: 15px 0;
        }

        .board-stat {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .search-form {
          display: flex;
          gap: 10px;
          margin: 20px 0;
        }

        .search-form input {
          flex: 1;
          padding: 10px;
          border: 2px solid var(--border-primary);
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .search-result {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          margin: 10px 0;
          padding: 15px;
        }

        .result-header {
          display: flex;
          gap: 15px;
          margin-bottom: 10px;
          font-weight: bold;
        }

        .tool-section {
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          margin: 20px 0;
          padding: 20px;
        }

        .tool-section.danger {
          border-color: #ff4444;
        }

        .tool-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .tool-btn {
          background: var(--bg-primary);
          border: 2px solid var(--border-primary);
          color: var(--text-primary);
          padding: 10px 20px;
          cursor: pointer;
          font-weight: bold;
        }

        .tool-btn:hover {
          background: var(--accent-primary);
          color: white;
        }

        .tool-btn.warning {
          border-color: #ffaa00;
        }

        .tool-btn.danger {
          border-color: #ff4444;
          color: #ff4444;
        }

        .console-help {
          background: #1a1a1a;
          border: 2px solid #333;
          padding: 20px;
          margin: 20px 0;
          font-family: monospace;
        }

        .console-help code {
          background: #333;
          padding: 2px 6px;
          color: #0ff;
        }
      `}</style>
    </div>
  );
};

export default DatabaseViewer;
