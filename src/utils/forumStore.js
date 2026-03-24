// Simple state management for threads and posts
class ForumStore {
  constructor() {
    this.threads = this.loadThreads();
    this.listeners = [];
  }

  // Load threads from localStorage or use mock data
  loadThreads() {
    const saved = localStorage.getItem('mh_chan_threads');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Default mock data
    return [
      {
        id: 'thread_1',
        subject: 'Dealing with panic attacks at work',
        preview: 'Hey everyone, I\'ve been having panic attacks during meetings lately and I don\'t know how to cope. Does anyone have experience with this?',
        content: 'Hey everyone, I\'ve been having panic attacks during meetings lately and I don\'t know how to cope. It started about a month ago and now I dread going to work. The physical symptoms are overwhelming - heart racing, sweating, feeling like I can\'t breathe. Has anyone else experienced this? What helped you get through it?',
        boardId: 'anxiety',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        replyCount: 12,
        lastReply: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        hasContentWarning: false,
        anonymous: true,
        tags: ['panic-attacks', 'work', 'coping'],
        posts: [
          {
            id: 'post_1',
            content: 'I\'ve been there. What helped me was practicing breathing exercises before meetings and having a "escape plan" - knowing I could step out if needed. Also, I started being more open with my manager about my anxiety.',
            timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            anonymous: true
          },
          {
            id: 'post_2',
            content: 'Grounding techniques can really help in the moment. Try the 5-4-3-2-1 method: 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. It helps bring you back to the present.',
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            anonymous: true
          }
        ]
      },
      {
        id: 'thread_2',
        subject: 'Small victory today',
        preview: 'I actually got out of bed before noon today and took a shower. I know it sounds small but it felt huge for me right now.',
        content: 'I actually got out of bed before noon today and took a shower. I know it sounds small but it felt huge for me right now. Depression has been really bad lately, but today felt different. Just wanted to share this small win with people who might understand.',
        boardId: 'success',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        replyCount: 8,
        lastReply: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        hasContentWarning: false,
        anonymous: true,
        tags: ['victory', 'depression', 'self-care'],
        posts: []
      }
    ];
  }

  // Save threads to localStorage
  saveThreads() {
    localStorage.setItem('mh_chan_threads', JSON.stringify(this.threads));
  }

  // Add a new thread
  addThread(threadData) {
    const newThread = {
      ...threadData,
      id: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      lastReply: new Date().toISOString(),
      replyCount: 0,
      anonymous: true,
      posts: []
    };

    this.threads.unshift(newThread);
    this.saveThreads();
    this.notifyListeners();
    return newThread;
  }

  // Add a reply to a thread
  addReply(threadId, replyData) {
    const threadIndex = this.threads.findIndex(t => t.id === threadId);
    if (threadIndex === -1) return null;

    const newReply = {
      ...replyData,
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      anonymous: true
    };

    this.threads[threadIndex].posts.push(newReply);
    this.threads[threadIndex].replyCount = this.threads[threadIndex].posts.length;
    this.threads[threadIndex].lastReply = new Date().toISOString();

    this.saveThreads();
    this.notifyListeners();
    return newReply;
  }

  // Get threads by board
  getThreadsByBoard(boardId) {
    if (!boardId) return this.threads;
    return this.threads.filter(thread => thread.boardId === boardId);
  }

  // Get thread by ID
  getThreadById(threadId) {
    return this.threads.find(thread => thread.id === threadId);
  }

  // Subscribe to changes
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.threads));
  }
}

// Create global store instance
const forumStore = new ForumStore();

export default forumStore;
