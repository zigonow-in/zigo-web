/**
 * Optional WebView GPS contract. Without this bridge the app uses browser geolocation.
 * The native app must request Android/iOS location permission and enable WebView geolocation.
 * Install this bridge only for the trusted HTTPS ZIGO assistant origin, not arbitrary pages/frames.
 * start/stop receive JSON {sessionId, highAccuracy?}. Never persist or reuse a stopped sessionId.
 * Inject fixes with window.ZigoAssistantGps.receive(sessionId, position), not postMessage.
 * timestamp is capture time in Unix milliseconds (not delivery time); accuracy is meters.
 * Report GPS errors with window.ZigoAssistantGps.error(sessionId, {code: 1|2|3}).
 * Background/locked-screen tracking requires native lifecycle and OS permissions; web JS alone
 * cannot guarantee it. Resume with a fresh fix. A suspended web runtime cannot upload bridge fixes.
 * For an iframe, the trusted parent also needs allow="geolocation" and a compatible Permissions-Policy.
 * Current frame-ancestors permits same-origin frames only. Cross-origin embedding needs an explicit
 * trusted-origin allowlist on the server and parent; do not relax it to wildcard origins.
 */
interface ZigoNativeGpsPosition {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy: number; speed?: number | null; heading?: number | null };
}
interface Window {
  ZigoNativeLocation?: { start(requestJson: string): void; stop(requestJson: string): void };
  ZigoAssistantGps?: {
    receive(sessionId: string, position: ZigoNativeGpsPosition): boolean;
    error(sessionId: string, error: { code: 1 | 2 | 3 }): boolean;
  };
}
