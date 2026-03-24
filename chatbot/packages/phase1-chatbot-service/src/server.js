const app = require('./app');

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`Phase 1 Chatbot Service running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Chat endpoint: http://localhost:${PORT}/api/chat/message`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

startServer();
