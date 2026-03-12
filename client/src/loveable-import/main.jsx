import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/theme.css';
import './styles/hud.css';
import './styles/app-background.css';
import { ProjectProvider } from './state/projectStore';
import App from './App';

class TopErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(err) { return { hasError: true, error: err }; }
  componentDidCatch(err) { console.error('[App] Render error:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#1a0000', color: '#fca5a5', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <pre style={{ fontSize: 12, overflow: 'auto' }}>{this.state.error?.message}</pre>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
ReactDOM.createRoot(root).render(
  <TopErrorBoundary>
    <BrowserRouter>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </BrowserRouter>
  </TopErrorBoundary>
);
