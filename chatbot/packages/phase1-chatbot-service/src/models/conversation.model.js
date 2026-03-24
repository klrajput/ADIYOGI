const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  title: String,
  status: { type: String, default: 'active' },
  riskLevel: { type: String, default: 'low' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: { type: Date, default: Date.now },
    riskAnalysis: {
      riskScore: Number,
      detectedIssues: [String],
      sentiment: String
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Conversation', conversationSchema);
