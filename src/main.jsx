/**
 * @file   main.jsx
 * @desc   Application entry point. Mounts <App /> inside an error boundary
 *         and loads global styles (design tokens, a11y baseline, Tailwind).
 * @author Quest Learning core team
 */

// @react-pdf/renderer (PDF generation) expects Node's Buffer global, which the
// browser doesn't provide — without this, downloads throw "Buffer is not
// defined". Polyfill it before anything else loads.
import { Buffer } from 'buffer'
if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from '@/App.jsx'
import ErrorBoundary from '@/lib/ErrorBoundary'
import '@/styles/tokens.css'  // design tokens (must load before Tailwind)
import '@/styles/a11y.css'    // focus rings, reduced-motion, sr-only
import '@/index.css'          // Tailwind + project-wide overrides

/**
 * Stale-chunk auto-recovery.
 *
 * Vite emits content-hashed chunks per build (e.g. ManageCurriculum-Cv3iOveL.js).
 * When we deploy a new build, the old hashes 404 because Vercel only keeps the
 * active deployment's assets. A user with a tab open since the previous deploy
 * will hit `Failed to fetch dynamically imported module` the moment they
 * lazy-load a route. The fix is to detect that exact error and reload — once.
 *
 * Recursion guard via sessionStorage prevents an infinite reload loop in the
 * rare case the reload doesn't resolve (e.g. broken deploy, network outage).
 */
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

function handleStaleChunk(err) {
  if (!isStaleChunkError(err)) return false;
  const key = '__quest_chunk_reload_at';
  const last = Number(sessionStorage.getItem(key) || 0);
  // If we reloaded for this reason within the last 30s, the reload isn't
  // helping — bail out and let the real error surface to the boundary.
  if (Date.now() - last < 30_000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  console.warn('[stale-chunk] auto-reloading for new deploy:', err?.message);
  window.location.reload();
  return true;
}

// Catch top-level unhandled errors and rejected promises (which is how
// dynamic-import failures usually surface from React.lazy + Suspense).
window.addEventListener('error', (e) => { handleStaleChunk(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { handleStaleChunk(e.reason); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
    {/* Vercel Web Analytics — pageviews + per-route insights. Only emits
        events in production; no-op in local dev. No cookies, no consent
        banner needed. Dashboard lives at vercel.com/.../analytics. */}
    <Analytics />
  </ErrorBoundary>
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



