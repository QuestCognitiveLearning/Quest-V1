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
    // `stale` distinguishes a just-deployed stale-chunk error (benign, auto
    // reloads) from a real crash, so we never flash the red screen for the
    // common stale-chunk case. `retryExhausted` is set if reloading didn't
    // help (broken deploy), so we show a soft refresh prompt instead.
    this.state = { error: null, info: null, stale: false, retryExhausted: false };
  }
  static getDerivedStateFromError(error) {
    return { error, stale: isStaleChunkError(error) };
  }
  componentDidCatch(error, info) {
    if (isStaleChunkError(error)) {
      // Try a single auto-reload to pick up the new HTML. Recursion guard via
      // sessionStorage keeps a broken deploy from looping. While reloading we
      // render the neutral "Updating…" screen, NOT the red crash page.
      const key = '__quest_chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        console.warn('[stale-chunk] auto-reloading for new deploy');
        window.location.reload();
        return;
      }
      // Reloaded recently and still failing — show a soft prompt, not the
      // scary red stack trace.
      this.setState({ retryExhausted: true, info });
      return;
    }
    console.error('React crash:', error, info);
    this.setState({ info });
  }
  render() {
    if (!this.state.error) return this.props.children;

    // Stale-chunk path: a reload is in flight (or a soft refresh prompt if the
    // reload didn't help). Neutral, never the red crash screen.
    if (this.state.stale) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: '#ffffff',
            color: '#475569',
            fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif',
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 32,
              height: 32,
              border: '4px solid #e2e8f0',
              borderTopColor: '#2563EB',
              borderRadius: '50%',
            }}
          />
          <div style={{ fontSize: 14 }}>
            {this.state.retryExhausted ? "Couldn't finish loading." : 'Updating to the latest version…'}
          </div>
          {this.state.retryExhausted && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Refresh
            </button>
          )}
        </div>
      );
    }

    // Genuine crash — show the diagnostic red screen.
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
}
