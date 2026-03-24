import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Container, Box } from '@mui/material';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { theme } from './styles/theme';
import WelcomeSection from './components/WelcomeSection';
import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <WelcomeSection />
          <ChatInterface />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
