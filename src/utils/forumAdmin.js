// Database administration utilities for Mental Health Forum
// These functions help you manipulate forum data directly

class ForumAdmin {
  constructor() {
    this.storageKey = 'mh_chan_threads';
  }

  // Get raw data from localStorage
  getRawData() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Save data back to localStorage
  saveData(threads) {
    localStorage.setItem(this.storageKey, JSON.stringify(threads));
    console.log('Data saved successfully');
  }

  // Export all data to downloadable JSON file
  exportData(filename = 'forum_backup.json') {
    const data = localStorage.getItem(this.storageKey);
    if (!data) {
      console.log('No data to export');
      return;
    }

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Data exported as ${filename}`);
  }

  // Import data from JSON string
  importData(jsonString, overwrite = false) {
    try {
      const newData = JSON.parse(jsonString);
      if (!Array.isArray(newData)) {
        throw new Error('Data must be an array of threads');
      }

      if (overwrite) {
        this.saveData(newData);
        console.log('Data imported and overwrote existing data');
      } else {
        const existing = this.getRawData();
        const combined = [...existing, ...newData];
        this.saveData(combined);
        console.log('Data imported and merged with existing data');
      }
      
      window.location.reload(); // Refresh to show new data
    } catch (error) {
      console.error('Import failed:', error.message);
    }
  }

  // Clear all forum data
  clearAll(confirm = false) {
    if (!confirm) {
      console.log('To really clear all data, call clearAll(true)');
      return;
    }
    localStorage.removeItem(this.storageKey);
    console.log('All forum data cleared');
    window.location.reload();
  }

  // Get statistics about the forum
  getStats() {
    const threads = this.getRawData();
    const stats = {
      totalThreads: threads.length,
      totalReplies: threads.reduce((sum, t) => sum + (t.posts?.length || 0), 0),
      boardCounts: {},
      contentWarnings: threads.filter(t => t.hasContentWarning).length,
      recentThreads: 0 // threads in last 24 hours
    };

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    threads.forEach(thread => {
      // Count by board
      stats.boardCounts[thread.boardId] = (stats.boardCounts[thread.boardId] || 0) + 1;
      
      // Count recent threads
      if (new Date(thread.timestamp) > dayAgo) {
        stats.recentThreads++;
      }
    });

    return stats;
  }

  // Search threads by content
  searchThreads(query, field = 'content') {
    const threads = this.getRawData();
    const searchTerm = query.toLowerCase();
    
    return threads.filter(thread => {
      if (field === 'all') {
        return (
          thread.subject?.toLowerCase().includes(searchTerm) ||
          thread.content?.toLowerCase().includes(searchTerm) ||
          thread.posts?.some(post => post.content?.toLowerCase().includes(searchTerm))
        );
      }
      return thread[field]?.toLowerCase().includes(searchTerm);
    });
  }

  // Delete thread by ID
  deleteThread(threadId) {
    const threads = this.getRawData();
    const filtered = threads.filter(t => t.id !== threadId);
    
    if (filtered.length < threads.length) {
      this.saveData(filtered);
      console.log(`Thread ${threadId} deleted`);
      return true;
    }
    
    console.log(`Thread ${threadId} not found`);
    return false;
  }

  // Delete all threads from a specific board
  deleteBoard(boardId) {
    const threads = this.getRawData();
    const filtered = threads.filter(t => t.boardId !== boardId);
    
    const deleted = threads.length - filtered.length;
    this.saveData(filtered);
    console.log(`Deleted ${deleted} threads from /${boardId}/`);
    return deleted;
  }

  // Moderate content - remove posts with specific words
  moderateContent(bannedWords, removeThread = false) {
    const threads = this.getRawData();
    let moderated = 0;
    
    const filtered = threads.map(thread => {
      // Check thread content
      const threadHasBannedWord = bannedWords.some(word => 
        thread.content?.toLowerCase().includes(word.toLowerCase()) ||
        thread.subject?.toLowerCase().includes(word.toLowerCase())
      );
      
      if (threadHasBannedWord && removeThread) {
        moderated++;
        return null; // Mark for removal
      }
      
      // Check and filter posts
      if (thread.posts) {
        const originalPostCount = thread.posts.length;
        thread.posts = thread.posts.filter(post => {
          const postHasBannedWord = bannedWords.some(word =>
            post.content?.toLowerCase().includes(word.toLowerCase())
          );
          if (postHasBannedWord) moderated++;
          return !postHasBannedWord;
        });
        
        // Update reply count
        thread.replyCount = thread.posts.length;
      }
      
      return thread;
    }).filter(thread => thread !== null);
    
    this.saveData(filtered);
    console.log(`Moderated ${moderated} pieces of content`);
    return moderated;
  }

  // Add tags to threads based on content analysis
  autoTag() {
    const threads = this.getRawData();
    const tagRules = {
      'anxiety': ['anxious', 'panic', 'worry', 'nervous', 'stress'],
      'depression': ['depressed', 'sad', 'hopeless', 'empty', 'worthless'],
      'recovery': ['sober', 'clean', 'recovery', 'rehab', 'addiction'],
      'relationships': ['partner', 'boyfriend', 'girlfriend', 'marriage', 'family'],
      'work': ['job', 'work', 'boss', 'career', 'workplace', 'office'],
      'self-harm': ['cut', 'harm', 'hurt myself', 'self-harm'],
      'therapy': ['therapist', 'therapy', 'counseling', 'treatment'],
      'medication': ['meds', 'medication', 'prescription', 'antidepressant']
    };

    let tagged = 0;
    threads.forEach(thread => {
      const content = (thread.subject + ' ' + thread.content).toLowerCase();
      const newTags = [];
      
      Object.keys(tagRules).forEach(tag => {
        if (tagRules[tag].some(keyword => content.includes(keyword))) {
          newTags.push(tag);
        }
      });
      
      if (newTags.length > 0) {
        thread.tags = [...(thread.tags || []), ...newTags];
        thread.tags = [...new Set(thread.tags)]; // Remove duplicates
        tagged++;
      }
    });

    this.saveData(threads);
    console.log(`Auto-tagged ${tagged} threads`);
    return tagged;
  }

  // Print helpful usage guide
  help() {
    console.log(`
🛠️  Forum Admin Utilities Help

📊 Data Analysis:
  admin.getStats()                    - Get forum statistics
  admin.getRawData()                  - View raw thread data
  admin.searchThreads('keyword')      - Search thread content
  admin.searchThreads('word', 'all')  - Search all fields

💾 Backup & Restore:
  admin.exportData()                  - Download backup file
  admin.importData(jsonString)        - Import data (merge)
  admin.importData(jsonString, true)  - Import data (overwrite)
  admin.clearAll(true)               - Delete all data (CAREFUL!)

🗑️  Content Management:
  admin.deleteThread('thread_id')     - Delete specific thread
  admin.deleteBoard('anxiety')        - Delete all threads from board
  admin.moderateContent(['word1'])    - Remove posts with banned words
  admin.autoTag()                     - Auto-add tags to threads

📈 Usage Examples:
  // Export backup before making changes
  admin.exportData('backup_' + Date.now() + '.json');
  
  // Find threads about work
  admin.searchThreads('work', 'all');
  
  // Clean up spam
  admin.moderateContent(['spam', 'advertisement'], true);
  
  // Get overview
  console.table(admin.getStats());
    `);
  }
}

// Create global admin instance
const admin = new ForumAdmin();

// Make it available globally for console access
if (typeof window !== 'undefined') {
  window.forumAdmin = admin;
  console.log('🛠️ Forum Admin loaded! Type "forumAdmin.help()" for commands');
}

export default admin;
