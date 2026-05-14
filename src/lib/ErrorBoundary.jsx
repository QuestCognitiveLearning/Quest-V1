import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('React crash:', error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      const stack = this.state.error?.stack || String(this.state.error);
      return (
        <div style={{ padding: 24, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fef2f2', color: '#7f1d1d', minHeight: '100vh' }}>
          <h2 style={{ marginTop: 0 }}>App crashed</h2>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{stack}</div>
          {this.state.info?.componentStack && (
            <details style={{ marginTop: 16 }}>
              <summary>component stack</summary>
              <div style={{ fontSize: 11, marginTop: 8 }}>{this.state.info.componentStack}</div>
            </details>
          )}
          <button
            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.replace('/'); }}
            style={{ marginTop: 16, padding: '8px 14px', background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Clear storage and reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
