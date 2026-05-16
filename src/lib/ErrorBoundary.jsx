import React from 'react';

// Recognize the "your bundle is stale because we just deployed" family of
// errors. When the user's tab was loaded before a deploy, lazy-loaded chunks
// 404 because Vite generates new content-hashed filenames per build.
function isStaleChunkError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Stale-chunk path: try a single auto-reload to pick up the new HTML.
    // Recursion guard via sessionStorage keeps a broken deploy from looping.
    if (isStaleChunkError(error)) {
      const key = '__quest_chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        console.warn('[stale-chunk] auto-reloading for new deploy');
        window.location.reload();
        return; // bail out before the error UI flashes
      }
    }
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
