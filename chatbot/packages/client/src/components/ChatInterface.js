import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Paper, 
  Typography,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Link
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { v4 as uuidv4 } from 'uuid';
import MessageBubble from './MessageBubble';
import chatService from '../services/chatService';

// Typing indicator animation
const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-10px); }
`;

const Dot = styled('span')(({ theme }) => ({
  height: '8px',
  width: '8px',
  backgroundColor: theme.palette.primary.main,
  borderRadius: '50%',
  display: 'inline-block',
  margin: '0 2px',
  animation: `${bounce} 1.4s ease-in-out infinite both`,
  '&:nth-of-type(1)': { animationDelay: '-0.32s' },
  '&:nth-of-type(2)': { animationDelay: '-0.16s' },
}));

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [crisisModalOpen, setCrisisModalOpen] = useState(false); // ADD THIS STATE
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initializeChat = () => {
    setSessionId(uuidv4());
    
    const welcomeMessage = {
      id: 1,
      text: "Hey there! I'm Alex 🤗 I'm here to listen and chat with you about whatever's on your mind. This is totally anonymous and judgment-free - just think of me as a supportive friend who's available 24/7. What's going on today?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([welcomeMessage]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ADD THIS FUNCTION
  const showCrisisModal = () => {
    setCrisisModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Show typing indicator with human-like delay
    setIsTyping(true);
    
    // Calculate response delay based on message length
    const responseDelay = Math.min(
      Math.max(userMessage.text.length * 50, 1500), // 50ms per character, min 1.5s
      4000 // max 4 seconds
    );

    try {
      // Add thinking pause
      await new Promise(resolve => setTimeout(resolve, responseDelay));
      
      const response = await chatService.sendMessage(userMessage.text, sessionId);
      
      // Add another small delay to simulate finishing typing
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let botResponseText;
      let needsAttention = false;

      if (response.success) {
        botResponseText = response.data.response;
        needsAttention = response.data.needsAttention;
      } else {
        botResponseText = response.fallbackResponse;
      }

      const botMessage = {
        id: Date.now() + 1,
        text: botResponseText,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMessage]);

      // Show crisis modal if needed
      if (needsAttention) {
        setTimeout(() => showCrisisModal(), 1000); // NOW THIS FUNCTION EXISTS
      }

    } catch (error) {
      console.error('Send message error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: "I'm having trouble connecting right now, but I want you to know that your feelings matter. If you're in crisis, please reach out to 988 or your campus counseling center.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper sx={{ height: '500px', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
        
        {/* Messages Area */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, backgroundColor: '#f9f9f9' }}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message.text}
              isUser={message.isUser}
              timestamp={message.timestamp}
            />
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <Box sx={{ display: 'flex', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mr: 1 }}>
                🤗
              </Avatar>
              <Paper sx={{ p: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Alex is thinking
                  <Dot />
                  <Dot />
                  <Dot />
                </Typography>
              </Paper>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ display: 'flex', p: 2, backgroundColor: 'white' }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isTyping}
            sx={{ mr: 1 }}
          />
          <IconButton 
            onClick={handleSendMessage} 
            disabled={!inputValue.trim() || isTyping}
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* ADD THE CRISIS MODAL */}
      <Dialog 
        open={crisisModalOpen} 
        onClose={() => setCrisisModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white' }}>
          🆘 Crisis Support Resources
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            I can tell you're going through something really difficult right now, and I want you to know that you matter. There are people who care and want to help.
          </Typography>
          
          <Typography variant="h6" gutterBottom>Emergency Contacts:</Typography>
          <Box mb={2}>
            <Link href="tel:911" sx={{ display: 'block', mb: 1, fontSize: '1.1rem' }}>
              🚨 Emergency Services: 911
            </Link>
            <Link href="tel:988" sx={{ display: 'block', mb: 1, fontSize: '1.1rem' }}>
              📞 Crisis Lifeline: 988
            </Link>
            <Link href="sms:741741" sx={{ display: 'block', mb: 1, fontSize: '1.1rem' }}>
              💬 Crisis Text Line: Text HOME to 741741
            </Link>
          </Box>

          <Typography variant="h6" gutterBottom>Campus Resources:</Typography>
          <Typography variant="body2" color="text.secondary">
            • Campus Counseling Center<br />
            • Student Health Services<br />
            • Dean of Students Office<br />
            • Campus Safety & Security
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCrisisModalOpen(false)} color="primary">
            I'm okay for now
          </Button>
          <Button 
            href="tel:988" 
            variant="contained" 
            color="secondary"
            sx={{ ml: 1 }}
          >
            Connect me with help
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInterface;
