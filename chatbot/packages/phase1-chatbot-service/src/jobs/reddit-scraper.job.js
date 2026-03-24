class RedditScraperJob {
  constructor() {
    this.insights = {
      posts: [],
      copingStrategies: ['deep breathing', 'exercise', 'talking to friends', 'counseling'],
      lastUpdated: new Date()
    };
  }

  async run() {
    // For now, return mock insights
    console.log('Reddit scraper job running (mock mode)...');
  }

  getInsights() {
    return this.insights;
  }

  startPeriodicScraping() {
    console.log('Reddit scraping started (mock mode)');
    this.run();
  }
}

module.exports = new RedditScraperJob();
