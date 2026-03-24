# 📊 Mental Health Forum Database Guide

## 🎯 Current Database Storage

Your forum currently uses **Local Storage** for data persistence. Here's how it works:

### 📁 Storage Location
- **Type**: Browser Local Storage (client-side)
- **Key**: `mh_chan_threads`
- **Format**: JSON array of thread objects
- **File**: `src/utils/forumStore.js` (main data management)

### 🗂️ Data Structure

```javascript
// Each thread object structure:
{
  id: "thread_123456789_abc",           // Unique identifier
  subject: "Thread Title",              // Thread subject
  preview: "First 200 characters...",  // Preview text
  content: "Full thread content",      // Complete original post
  boardId: "anxiety",                  // Board category (anxiety, depression, etc.)
  timestamp: "2025-08-31T12:00:00Z",   // Creation time (ISO string)
  replyCount: 5,                       // Number of replies
  lastReply: "2025-08-31T13:00:00Z",   // Last reply timestamp
  hasContentWarning: false,            // Content warning flag
  anonymous: true,                     // Always true for anonymity
  tags: ["panic-attacks", "work"],     // Topic tags
  posts: [                             // Array of replies
    {
      id: "post_123456789_xyz",
      content: "Reply content here...",
      timestamp: "2025-08-31T12:30:00Z",
      anonymous: true
    }
  ]
}
```

## 🔧 Current Database Manipulation Methods

### Via ForumStore API:
```javascript
import forumStore from './src/utils/forumStore';

// 1. Get all threads
const allThreads = forumStore.threads;

// 2. Get threads by board
const anxietyThreads = forumStore.getThreadsByBoard('anxiety');

// 3. Get specific thread
const thread = forumStore.getThreadById('thread_123');

// 4. Create new thread
const newThread = forumStore.addThread({
  content: "Thread content...",
  subject: "Thread title",
  boardId: "depression",
  hasContentWarning: false
});

// 5. Add reply to thread
const newReply = forumStore.addReply('thread_123', {
  content: "Reply content...",
  hasContentWarning: false
});

// 6. Subscribe to changes
const unsubscribe = forumStore.subscribe((threads) => {
  console.log('Threads updated:', threads);
});
```

### Direct Browser Manipulation:
```javascript
// 1. View raw data in browser console:
JSON.parse(localStorage.getItem('mh_chan_threads'))

// 2. Export all data:
const exportData = () => {
  const data = localStorage.getItem('mh_chan_threads');
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'forum_backup.json';
  a.click();
};

// 3. Clear all data:
localStorage.removeItem('mh_chan_threads');

// 4. Import data:
const importData = (jsonString) => {
  localStorage.setItem('mh_chan_threads', jsonString);
  window.location.reload(); // Refresh to load new data
};
```

## 🚀 Migration to Firebase (Optional)

Your project is already configured for Firebase. To migrate:

### 1. Set up environment variables (.env file):
```bash
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=mental-health-chan-8e78f.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=mental-health-chan-8e78f
REACT_APP_FIREBASE_STORAGE_BUCKET=mental-health-chan-8e78f.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 2. Firebase advantages:
- ✅ Real-time sync across devices
- ✅ Automatic backups
- ✅ Scalable to thousands of users
- ✅ Built-in security rules
- ✅ Offline support

### 3. Local Storage advantages:
- ✅ No setup required
- ✅ Works offline always
- ✅ No external dependencies
- ✅ Complete privacy (data never leaves browser)
- ✅ No costs

## 🛠️ Database Administration Tools

### Browser Console Commands:
```javascript
// Count total threads
JSON.parse(localStorage.getItem('mh_chan_threads')).length

// Count threads by board
const threads = JSON.parse(localStorage.getItem('mh_chan_threads'));
const boardCounts = {};
threads.forEach(t => {
  boardCounts[t.boardId] = (boardCounts[t.boardId] || 0) + 1;
});
console.log(boardCounts);

// Find threads with content warnings
threads.filter(t => t.hasContentWarning);

// Get recent threads (last 24 hours)
const day = 24 * 60 * 60 * 1000;
threads.filter(t => new Date() - new Date(t.timestamp) < day);
```

## 📊 Current Storage Size
Check current storage usage in browser console:
```javascript
const data = localStorage.getItem('mh_chan_threads');
console.log(`Storage size: ${(data.length / 1024).toFixed(2)} KB`);
```

## 🔄 Backup & Restore
The forum automatically saves to localStorage on every change. For manual backups, use the export/import functions above.
