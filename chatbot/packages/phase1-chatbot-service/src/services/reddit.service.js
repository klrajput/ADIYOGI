const axios = require('axios');
const logger = require('../utils/logger');

class RedditService {
  constructor() {
    this.baseUrl = 'https://www.reddit.com';
    this.mentalHealthSubreddits = [
      'depression',
      'anxiety',
      'mentalhealth',
      'college',
      'stress',
      'socialanxiety',
      'GetMotivated'
    ];
  }

  async fetchSubredditPosts(subreddit, limit = 10) {
    try {
      const url = `${this.baseUrl}/r/${subreddit}/hot.json?limit=${limit}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': process.env.REDDIT_USER_AGENT || 'MentalHealthBot/1.0'
        }
      });

      const posts = response.data.data.children
        .map(child => child.data)
        .filter(post => !post.stickied && post.selftext && post.selftext.length > 50)
        .map(post => ({
          id: post.id,
          title: post.title,
          content: post.selftext.substring(0, 500), // Limit content length
          subreddit: post.subreddit,
          upvotes: post.ups,
          created: new Date(post.created_utc * 1000)
        }));

      return posts;
    } catch (error) {
      logger.error(`Error fetching posts from r/${subreddit}:`, error.message);
      return [];
    }
  }

  async fetchMentalHealthInsights() {
    const allPosts = [];
    
    for (const subreddit of this.mentalHealthSubreddits) {
      try {
        const posts = await this.fetchSubredditPosts(subreddit, 5);
        allPosts.push(...posts);
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Error processing subreddit ${subreddit}:`, error);
      }
    }

    return allPosts;
  }

  extractCopingStrategies(posts) {
    const strategies = [];
    const commonStrategies = [
      'therapy', 'counseling', 'meditation', 'exercise', 'breathing',
      'journaling', 'support group', 'medication', 'sleep hygiene',
      'mindfulness', 'yoga', 'talking to friends', 'professional help'
    ];

    posts.forEach(post => {
      const content = (post.title + ' ' + post.content).toLowerCase();
      commonStrategies.forEach(strategy => {
        if (content.includes(strategy) && !strategies.includes(strategy)) {
          strategies.push(strategy);
        }
      });
    });

    return strategies.slice(0, 5); // Return top 5
  }
}

module.exports = new RedditService();
