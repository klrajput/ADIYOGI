const mongoose = require('mongoose');

const redditPostSchema = new mongoose.Schema({
  postId: { type: String, unique: true },
  subreddit: String,
  title: String,
  content: String,
  upvotes: Number,
  sentimentScore: Number,
  themes: [String],
  copingStrategies: [String],
  processed: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('RedditPost', redditPostSchema);

