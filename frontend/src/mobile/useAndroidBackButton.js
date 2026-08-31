import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

// Screens where "back" should exit the app rather than navigate.
const EXIT_PATHS = new Set(['/', '/login']);

/**
 * Wires the Android hardware / gesture "back" action into react-router:
 *  - an open modal overlay closes first (mirrors the web Esc behaviour)
 *  - otherwise navigate back one entry
 *  - on a root screen with nothing to go back to, the app exits
 *
 * No-op on web and iOS. Call once, high in the tree, inside <BrowserRouter>.
 */
export default function useAndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let remove = () => {};
    const listener = import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('backButton', ({ canGoBack }) => {
        const openOverlay = document.querySelector(
          '.modal-overlay, .lightbox-overlay, .ai-assistant-panel.open',
        );
        if (openOverlay) {
          const closeBtn = openOverlay.querySelector(
            '.modal-close, .modal-close-btn, .lightbox-close, .wizard-close-btn',
          );
          if (closeBtn) closeBtn.click();
          return;
        }

        if (canGoBack && !EXIT_PATHS.has(window.location.pathname)) {
          navigate(-1);
        } else {
          App.exitApp();
        }
      });
      return handle;
    });
    listener.then((handle) => { remove = () => handle.remove(); });

    return () => remove();
  }, [navigate]);
}
