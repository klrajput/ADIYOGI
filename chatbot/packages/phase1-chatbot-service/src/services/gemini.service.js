const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not found. Using fallback responses.');
      this.genAI = null;
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async generateMentalHealthResponse(message, sessionHistory = []) {
    if (!this.genAI) {
      return this.getFallbackResponse(message);
    }

    try {
      const conversationContext = sessionHistory
        .slice(-4)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = `
        You are Alex, a warm and empathetic mental health support companion for college students. 
        
        Your personality traits:
        - Speak naturally with occasional "hmm", "I see", "you know"
        - Use gentle, conversational language like a caring friend
        - Show genuine empathy and understanding
        - Occasionally use supportive emojis (but not too many)
        - Sometimes pause to "think" with phrases like "let me think about that..."
        - Use inclusive, non-judgmental language
        - Reference college life experiences naturally
        
        Current message: "${message}"
        
        ${conversationContext ? `Recent conversation:\n${conversationContext}\n` : ''}
        
        Respond as Alex would - naturally, warmly, and with genuine care. Include:
        1. Acknowledge their feelings authentically
        2. Use natural conversation fillers occasionally
        3. Provide practical, student-focused support
        4. Maintain hope and encouragement
        5. Gently suggest professional resources when appropriate
        
        Keep responses 100-150 words, conversational and supportive.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackResponse(message);
    }
  }

  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    const anxietyResponses = [
      "I hear you on the anxiety - it really can feel overwhelming sometimes. You know what? Try this: breathe in for 4, hold it, then slowly exhale for 6. It's like hitting a reset button. 💙 And hey, your campus counseling center gets this stuff - they're there for you.",
      "Hmm, anxiety about exams is so common, you're definitely not alone in feeling this way. I find that breaking things down into smaller chunks can help... like, instead of 'study everything,' maybe 'review chapter 1 today.' Your campus has great support too if you want to talk to someone. 🤗"
    ];
    
    const sadnessResponses = [
      "I'm really sorry you're going through this difficult time... your feelings are completely valid, you know? Sometimes life just feels heavy. Small steps can help - even just reaching out like this shows strength. Have you thought about connecting with a counselor? 💙",
      "That sounds really tough, and I want you to know it's okay to not be okay sometimes. Hmm... what you're feeling matters, and you deserve support. Maybe talking to someone could help lighten that load a bit? 🤗"
    ];
    
    const generalResponses = [
      "Thanks for sharing that with me... it means a lot that you felt comfortable opening up. You know, whatever you're going through, you're not alone in this. There are people who want to help. 💙",
      "I'm really glad you reached out. That takes courage, you know? Life can throw some curveballs, especially during college. Your campus counseling center has helped so many students work through tough times."
    ];
    
    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
      return anxietyResponses[Math.floor(Math.random() * anxietyResponses.length)];
    }
    
    if (lowerMessage.includes('sad') || lowerMessage.includes('depressed')) {
      return sadnessResponses[Math.floor(Math.random() * sadnessResponses.length)];
    }
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  }

  async assessRiskLevel(message, sessionHistory = []) {
    const crisisKeywords = ['suicide', 'kill myself', 'end it all', 'self harm', 'hurt myself'];
    const lowerMessage = message.toLowerCase();
    
    const hasCrisisKeywords = crisisKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasCrisisKeywords) {
      return {
        level: 'crisis',
        score: 8,
        needsImmediate: true
      };
    }
    
    const anxietyKeywords = ['anxious', 'panic', 'overwhelmed', 'stressed'];
    const depressionKeywords = ['depressed', 'sad', 'hopeless', 'worthless'];
    
    const hasAnxiety = anxietyKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasDepression = depressionKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasDepression) {
      return { level: 'moderate', score: 5, needsImmediate: false };
    }
    
    if (hasAnxiety) {
      return { level: 'mild', score: 3, needsImmediate: false };
    }
    
    return { level: 'low', score: 1, needsImmediate: false };
  }
}

module.exports = new GeminiService();
