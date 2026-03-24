// AdiYogi Forum Application
class AdiYogiForum {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'confessions';
        this.anonymousNames = [
            'Peaceful Soul', 'Inner Light', 'Mindful Being', 'Spiritual Seeker',
            'Zen Master', 'Meditation Guide', 'Life Explorer', 'Wisdom Keeper',
            'Serene Heart', 'Conscious Mind', 'Divine Essence', 'Eternal Spirit',
            'Sacred Space', 'Pure Awareness', 'Blissful Soul', 'Harmony Finder',
            'Truth Seeker', 'Love Radiator', 'Grace Holder', 'Unity Being'
        ];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.loadPosts();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Authentication
        document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signupBtn').addEventListener('click', () => this.handleSignup());

        // Post creation
        document.getElementById('newConfessionBtn').addEventListener('click', () => this.showCreatePostModal('confession'));
        document.getElementById('newPOVBtn').addEventListener('click', () => this.showCreatePostModal('pov'));
        document.getElementById('postForm').addEventListener('submit', (e) => this.handleCreatePost(e));
        document.getElementById('cancelPost').addEventListener('click', () => this.hideCreatePostModal());

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeAllModals());
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        this.currentTab = tabName;
        this.loadPosts();
    }

    async checkAuthState() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI();
        });
    }

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const newConfessionBtn = document.getElementById('newConfessionBtn');
        const newPOVBtn = document.getElementById('newPOVBtn');

        if (this.currentUser) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';
            newConfessionBtn.style.display = 'inline-flex';
            newPOVBtn.style.display = 'inline-flex';
        } else {
            loginBtn.style.display = 'inline-flex';
            logoutBtn.style.display = 'none';
            newConfessionBtn.style.display = 'none';
            newPOVBtn.style.display = 'none';
        }
    }

    showLoginModal() {
        document.getElementById('loginModal').style.display = 'block';
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.closeAllModals();
            this.showNotification('Welcome back!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleSignup() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            this.closeAllModals();
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async logout() {
        try {
            await auth.signOut();
            this.showNotification('Logged out successfully', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    showCreatePostModal(postType) {
        const modal = document.getElementById('createPostModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('postForm');

        title.textContent = postType === 'confession' ? 'Create New Confession' : 'Create New POV';
        form.dataset.postType = postType;
        modal.style.display = 'block';
    }

    hideCreatePostModal() {
        document.getElementById('createPostModal').style.display = 'none';
        document.getElementById('postForm').reset();
    }

    async handleCreatePost(e) {
        e.preventDefault();
        const form = e.target;
        const postType = form.dataset.postType;
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const category = document.getElementById('postCategory').value;

        if (!this.currentUser) {
            this.showNotification('Please login to create a post', 'error');
            return;
        }

        try {
            const anonymousName = this.getRandomAnonymousName();
            const postData = {
                title: title.trim(),
                content: content.trim(),
                category: category,
                authorId: this.currentUser.uid,
                authorName: anonymousName,
                postType: postType,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                views: 0,
                comments: postType === 'pov' ? [] : null
            };

            await db.collection('posts').add(postData);
            this.hideCreatePostModal();
            this.showNotification('Post created successfully!', 'success');
            this.loadPosts();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    getRandomAnonymousName() {
        return this.anonymousNames[Math.floor(Math.random() * this.anonymousNames.length)];
    }

    async loadPosts() {
        const container = this.currentTab === 'confessions' ? 
            document.getElementById('confessionsList') : 
            document.getElementById('povList');

        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading posts...</p></div>';

        try {
            console.log('🔄 Attempting to load posts for:', this.currentTab);
            
            // Simplified query without composite index requirement
            const snapshot = await db.collection('posts')
                .where('postType', '==', this.currentTab === 'confessions' ? 'confession' : 'pov')
                .get();

            console.log('📊 Posts loaded successfully:', snapshot.size, 'posts found');

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-feather"></i>
                        <h3>No posts yet</h3>
                        <p>Be the first to share your thoughts in this sacred space.</p>
                    </div>
                `;
                return;
            }

            const posts = [];
            snapshot.forEach(doc => {
                posts.push({ id: doc.id, ...doc.data() });
            });

            // Sort posts by creation time (client-side sorting)
            posts.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toDate() - a.createdAt.toDate();
                }
                return 0;
            });

            this.renderPosts(posts, container);
        } catch (error) {
            console.error('❌ Error loading posts:', error);
            
            let errorMessage = 'An error occurred while loading posts.';
            
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please check your Firestore security rules.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Firestore is unavailable. Please check your internet connection.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error loading posts</h3>
                    <p>${errorMessage}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
                </div>
            `;
        }
    }

    renderPosts(posts, container) {
        container.innerHTML = posts.map(post => this.createPostHTML(post)).join('');
        
        // Add event listeners to read more buttons
        container.querySelectorAll('.read-more').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.target.dataset.postId;
                this.showPostDetail(postId);
            });
        });
    }

    createPostHTML(post) {
        const timeAgo = this.getTimeAgo(post.createdAt);
        const truncatedContent = post.content.length > 200 ? 
            post.content.substring(0, 200) + '...' : post.content;

        return `
            <div class="post-card">
                <div class="post-header">
                    <div>
                        <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
                        <div class="post-meta">
                            <span class="post-author">${this.escapeHtml(post.authorName)}</span>
                            <span class="post-category">${this.escapeHtml(post.category)}</span>
                            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                        </div>
                    </div>
                </div>
                <div class="post-content">${this.escapeHtml(truncatedContent)}</div>
                <div class="post-actions">
                    <div class="post-stats">
                        <span><i class="fas fa-eye"></i> ${post.views || 0}</span>
                        ${post.postType === 'pov' ? `<span><i class="fas fa-comments"></i> ${post.comments ? post.comments.length : 0}</span>` : ''}
                    </div>
                    <button class="read-more" data-post-id="${post.id}">
                        ${post.postType === 'confession' ? 'Read More' : 'View & Comment'}
                    </button>
                </div>
            </div>
        `;
    }

    async showPostDetail(postId) {
        try {
            const doc = await db.collection('posts').doc(postId).get();
            if (!doc.exists) {
                this.showNotification('Post not found', 'error');
                return;
            }

            const post = { id: doc.id, ...doc.data() };
            const modal = document.getElementById('postDetailModal');
            const title = document.getElementById('detailTitle');
            const content = document.getElementById('postDetailContent');
            const commentsSection = document.getElementById('commentsSection');
            const commentForm = document.getElementById('commentForm');

            title.textContent = post.title;
            content.innerHTML = `
                <div class="post-meta" style="margin-bottom: 1rem;">
                    <span class="post-author">${this.escapeHtml(post.authorName)}</span>
                    <span class="post-category">${this.escapeHtml(post.category)}</span>
                    <span><i class="fas fa-clock"></i> ${this.getTimeAgo(post.createdAt)}</span>
                </div>
                <div class="post-content" style="font-size: 1.1rem; line-height: 1.8;">
                    ${this.escapeHtml(post.content)}
                </div>
            `;

            // Show comments section only for POV posts
            if (post.postType === 'pov') {
                commentsSection.style.display = 'block';
                commentForm.style.display = this.currentUser ? 'block' : 'none';
                this.loadComments(postId);
            } else {
                commentsSection.style.display = 'none';
            }

            // Increment view count
            await db.collection('posts').doc(postId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });

            modal.style.display = 'block';

            // Setup comment form
            commentForm.onsubmit = (e) => this.handleComment(e, postId);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async loadComments(postId) {
        const commentsList = document.getElementById('commentsList');
        commentsList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading comments...</p></div>';

        try {
            const doc = await db.collection('posts').doc(postId).get();
            const post = doc.data();
            const comments = post.comments || [];

            if (comments.length === 0) {
                commentsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-comments"></i>
                        <p>No comments yet. Be the first to share your thoughts!</p>
                    </div>
                `;
                return;
            }

            commentsList.innerHTML = comments.map(comment => `
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(comment.authorName)}</span>
                        <span class="comment-time">${this.getTimeAgo(comment.createdAt)}</span>
                    </div>
                    <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                </div>
            `).join('');
        } catch (error) {
            commentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading comments: ${error.message}</p>
                </div>
            `;
        }
    }

    async handleComment(e, postId) {
        e.preventDefault();
        const content = document.getElementById('commentContent').value.trim();

        if (!this.currentUser) {
            this.showNotification('Please login to comment', 'error');
            return;
        }

        try {
            const comment = {
                content: content,
                authorId: this.currentUser.uid,
                authorName: this.getRandomAnonymousName(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('posts').doc(postId).update({
                comments: firebase.firestore.FieldValue.arrayUnion(comment)
            });

            document.getElementById('commentContent').value = '';
            this.loadComments(postId);
            this.showNotification('Comment posted successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';
        
        const now = new Date();
        const postTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInSeconds = Math.floor((now - postTime) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return postTime.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdiYogiForum();
});
