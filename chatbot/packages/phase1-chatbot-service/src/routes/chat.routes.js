const express = require('express');
const geminiService = require('../services/gemini.service');

const router = express.Router();

// Enhanced in-memory storage with conversation history
const conversations = new Map();

function getOrCreateSession(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, {
      id: sessionId,
      messages: [],
      riskLevel: 'low',
      created: new Date(),
      lastActive: new Date()
    });
  }
  return conversations.get(sessionId);
}

router.post('/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // Get or create session
    const session = getOrCreateSession(sessionId);
    session.lastActive = new Date();

    // Simulate human thinking delay
    const thinkingDelay = Math.min(
      Math.max(message.length * 40, 1000), // 40ms per character, min 1s
      3000 // max 3 seconds
    );
    
    await new Promise(resolve => setTimeout(resolve, thinkingDelay));

    // Generate AI response using conversation history
    const botResponse = await geminiService.generateMentalHealthResponse(
      message, 
      session.messages
    );
    
    // Assess risk level with conversation context
    const riskAssessment = await geminiService.assessRiskLevel(
      message, 
      session.messages
    );
    
    // Add messages to conversation
    const userMessage = { 
      role: 'user', 
      content: message, 
      timestamp: new Date(),
      riskLevel: riskAssessment.level,
      riskScore: riskAssessment.score
    };
    
    const assistantMessage = { 
      role: 'assistant', 
      content: botResponse, 
      timestamp: new Date() 
    };
    
    session.messages.push(userMessage, assistantMessage);
    session.riskLevel = riskAssessment.level;
    
    // Keep only last 20 messages to manage memory
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    res.json({
      success: true,
      data: {
        response: botResponse,
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        needsAttention: riskAssessment.needsImmediate,
        sessionId: sessionId,
        messageCount: session.messages.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

module.exports = router;
