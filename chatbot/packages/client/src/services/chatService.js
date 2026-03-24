import axios from 'axios';

class ChatService {
  constructor() {
    this.baseURL = 'http://localhost:3002'; // Updated to correct backend port
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(message, sessionId) {
    try {
      const response = await this.client.post('/api/chat/message', {
        message,
        sessionId,
      });

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Chat service error:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackResponse: this.getFallbackResponse(message)
      };
    }
  }

  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Add more human, varied responses
    const anxietyResponses = [
      "I hear you on the anxiety - it really can feel overwhelming sometimes. You know what? Try this: breathe in for 4, hold it, then slowly exhale for 6. It's like hitting a reset button. 💙 Your campus counseling center is there for you too.",
      "Hmm, anxiety about exams is so common - you're definitely not alone in feeling this way. Breaking things down into smaller chunks can help... like, instead of 'study everything,' maybe 'review chapter 1 today.' 🤗",
      "Oh, I totally understand that anxious feeling. It's like your mind is racing, right? The 4-7-8 breathing technique helps many students - breathe in for 4, hold for 7, out for 8. Talking to a counselor can really make a difference too."
    ];
    
    const sadnessResponses = [
      "I'm really sorry you're going through this difficult time... your feelings are completely valid, you know? Sometimes life just feels heavy. Even reaching out like this shows real strength. 💙",
      "That sounds really tough, and I want you to know it's okay to not be okay sometimes. Hmm... what you're feeling matters, and you deserve support. Maybe talking to someone could help lighten that load a bit?",
      "I hear you, and I'm glad you shared this with me. Going through difficult emotions is... well, it's hard. But you're stronger than you realize. Consider reaching out to your campus counseling center. 🤗"
    ];
    
    const generalResponses = [
      "Thanks for sharing that with me... it means a lot that you felt comfortable opening up. You know, whatever you're going through, you're not alone in this. 💙",
      "I'm really glad you reached out. That takes courage, you know? Life can throw some curveballs, especially during college. Your campus counseling center has helped so many students.",
      "Hmm, it sounds like you've got a lot on your mind. I appreciate you sharing with me... it shows real strength to reach out when things are difficult. 🤗"
    ];
    
    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
      return anxietyResponses[Math.floor(Math.random() * anxietyResponses.length)];
    }
    
    if (lowerMessage.includes('sad') || lowerMessage.includes('depressed')) {
      return sadnessResponses[Math.floor(Math.random() * sadnessResponses.length)];
    }
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  }
}

const chatService = new ChatService();
export default chatService;
