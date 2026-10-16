'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Registration is deliberately deferred until after `load`, and skipped entirely
 * in development. A service worker in front of a hot-reloading dev server serves
 * stale modules and produces debugging sessions that make no sense — the
 * confusion is worse than the missing offline support while developing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Failing to register costs offline support and nothing else. It is not
        // surfaced to a resident: it is invisible to them and unfixable by
        // them, so an error banner would be noise.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}