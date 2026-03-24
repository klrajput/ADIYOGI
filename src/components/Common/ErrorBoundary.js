import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Mental Health Chan Error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // In production, you might want to log this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">
              💔
            </div>
            
            <h1>Something went wrong</h1>
            
            <div className="error-message">
              <p>
                We're sorry, but something unexpected happened. 
                This error has been logged and we'll work to fix it.
              </p>
              
              <div className="error-actions">
                <button 
                  onClick={this.handleReload}
                  className="error-button primary"
                >
                  🔄 Reload Page
                </button>
                
                <button 
                  onClick={this.handleGoHome}
                  className="error-button secondary"
                >
                  🏠 Go to Home
                </button>
              </div>
            </div>

            <div className="crisis-reminder">
              <h3>🚨 Need immediate help?</h3>
              <div className="crisis-contacts">
                <a href="tel:988" className="crisis-link">
                  📞 Call 988 (Crisis Lifeline)
                </a>
                <a href="sms:741741&body=HOME" className="crisis-link">
                  💬 Text HOME to 741741
                </a>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Technical Details (Development Mode)</summary>
                <div className="error-stack">
                  <h4>Error:</h4>
                  <pre>{this.state.error && this.state.error.toString()}</pre>
                  
                  <h4>Component Stack:</h4>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
