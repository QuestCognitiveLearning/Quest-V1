/**
 * @file   main.jsx
 * @desc   Application entry point. Mounts <App /> inside an error boundary
 *         and loads global styles (design tokens, a11y baseline, Tailwind).
 * @author Quest Learning core team
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/lib/ErrorBoundary'
import '@/styles/tokens.css'  // design tokens (must load before Tailwind)
import '@/styles/a11y.css'    // focus rings, reduced-motion, sr-only
import '@/index.css'          // Tailwind + project-wide overrides

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
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



