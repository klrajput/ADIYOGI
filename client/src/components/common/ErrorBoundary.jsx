import { Component } from 'react';
import ErrorState from '../ui/ErrorState';

/**
 * Last-resort boundary so a rendering bug never leaves a blank page. Recovery
 * is explicit (reload) and there is no internal detail in the message.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-narrow py-16">
          <ErrorState
            title="This screen could not be displayed"
            description="Something unexpected happened while rendering this page. Your data has not been changed. Reloading is usually enough."
            onRetry={this.handleReload}
            retryLabel="Reload the page"
          />
        </div>
      );
    }
    return this.props.children;
  }
}
