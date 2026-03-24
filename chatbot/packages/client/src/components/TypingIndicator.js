import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

const TypingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5, 2),
  marginBottom: theme.spacing(2),
}));

const TypingBubble = styled(Box)(({ theme }) => ({
  maxWidth: '70%',
  padding: theme.spacing(1.5, 2),
  borderRadius: '20px 20px 20px 5px',
  backgroundColor: theme.palette.grey[100],
  border: `1px solid ${theme.palette.grey[300]}`,
  margin: theme.spacing(0, 1),
}));

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

const TypingIndicator = () => {
  return (
    <TypingContainer>
      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
        🤗
      </Avatar>
      <TypingBubble>
        <Typography variant="body2" color="text.secondary">
          <Dot />
          <Dot />
          <Dot />
        </Typography>
      </TypingBubble>
    </TypingContainer>
  );
};

export default TypingIndicator;
