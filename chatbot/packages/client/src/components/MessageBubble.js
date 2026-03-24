import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';

const MessageContainer = styled(Box)(({ theme, isUser }) => ({
  display: 'flex',
  justifyContent: isUser ? 'flex-end' : 'flex-start',
  marginBottom: theme.spacing(2),
  alignItems: 'flex-end',
}));

const MessageBubbleStyled = styled(Box)(({ theme, isUser }) => ({
  maxWidth: '70%',
  padding: theme.spacing(1.5, 2),
  borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
  backgroundColor: isUser ? theme.palette.primary.main : theme.palette.grey[100],
  color: isUser ? 'white' : theme.palette.text.primary,
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  margin: theme.spacing(0, 1),
}));

const MessageBubble = ({ message, isUser, timestamp }) => {
  return (
    <MessageContainer isUser={isUser}>
      {!isUser && (
        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
          🤗
        </Avatar>
      )}
      <MessageBubbleStyled isUser={isUser}>
        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
          {message}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            mt: 0.5, 
            opacity: 0.7,
            fontSize: '0.75rem'
          }}
        >
          {timestamp}
        </Typography>
      </MessageBubbleStyled>
      {isUser && (
        <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
          👤
        </Avatar>
      )}
    </MessageContainer>
  );
};

export default MessageBubble;
