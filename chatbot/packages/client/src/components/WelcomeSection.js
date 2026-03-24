import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

const WelcomeCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
  color: 'white',
  marginBottom: theme.spacing(3),
  borderRadius: 20,
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: 15,
  border: `2px solid ${theme.palette.primary.light}`,
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[8],
  },
}));

const WelcomeSection = () => {
  const features = [
    {
      emoji: '🤖',
      title: 'AI-Powered Support',
      description: 'Get intelligent, empathetic responses powered by advanced AI technology'
    },
    {
      emoji: '🔒',
      title: 'Anonymous & Secure',
      description: 'Your conversations are completely private and anonymous'
    },
    {
      emoji: '🆘',
      title: 'Crisis Detection',
      description: 'Immediate help and resources when you need them most'
    },
    {
      emoji: '💙',
      title: 'Student-Focused',
      description: 'Designed specifically for college student mental health needs'
    }
  ];

  return (
    <Box sx={{ mb: 4 }}>
      <WelcomeCard>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">
            🤗 Mental Health Support Chat
          </Typography>
          <Typography variant="h6" align="center" sx={{ opacity: 0.9, mb: 2 }}>
            A safe, anonymous space for mental health support
          </Typography>
          <Box display="flex" justifyContent="center" gap={1} flexWrap="wrap">
            <Chip label="24/7 Available" color="secondary" />
            <Chip label="Crisis Support" color="secondary" />
            <Chip label="Student-Focused" color="secondary" />
          </Box>
        </CardContent>
      </WelcomeCard>

      <Grid container spacing={3}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <FeatureCard>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography variant="h3" sx={{ mb: 2 }}>
                  {feature.emoji}
                </Typography>
                <Typography variant="h6" gutterBottom color="primary">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </FeatureCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default WelcomeSection;
