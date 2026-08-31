import { Capacitor } from '@capacitor/core';

/**
 * One-time native setup for the Capacitor shell. Completely inert on the web
 * build (returns immediately when not running inside a native WebView).
 * Call once from main.jsx before / around React mount.
 */
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  // Enables the `html.cap-native` scope used by src/mobile.css for safe areas.
  document.documentElement.classList.add('cap-native');

  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  try {
    // Draw the WebView under the status bar; mobile.css pads content back down
    // with env(safe-area-inset-top). Icon colour tracks the app's own theme.
    await StatusBar.setOverlaysWebView({ overlay: true });

    const syncStatusBarStyle = () => {
      const dark = document.body.classList.contains('dark-theme');
      // Style.Dark  => light icons (for a dark background)
      // Style.Light => dark icons  (for a light background)
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    };
    syncStatusBarStyle();
    new MutationObserver(syncStatusBarStyle).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  } catch {
    /* StatusBar plugin not present in this build — ignore */
  }

  // Hide the native splash only once the web app has actually painted, so
  // there is no white flash between the two.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => SplashScreen.hide().catch(() => {})),
  );
}
