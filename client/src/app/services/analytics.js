// Google Analytics (GA4) helpers.
//
// gtag is bootstrapped in public/index.html ONLY when a real GA4 Measurement ID
// (G-XXXXXXXXXX) is injected at build time via REACT_APP_GTAG. That value comes from
// SSM (/analysistools/<tier>/forge2-tf/gtag) and is only set for prod, so analytics is
// inert in dev/qa/stage and during local development. Every helper here is a no-op
// unless that bootstrap ran, so call sites never need to know the environment.
//
// PII policy: never pass user-identifying values, free-text input, or query strings to
// these functions. Stick to controlled enum values (array/sample names, numeric knobs)
// and hash route paths.

export function isAnalyticsEnabled() {
  return (
    typeof window !== "undefined" &&
    typeof window.gtag === "function" &&
    Boolean(window.GA_MEASUREMENT_ID)
  );
}

// Send a GA4 page_view for SPA (HashRouter) route changes. We pass only the hash route
// path — never the query string — so no PII reaches GA4.
export function trackPageView(path) {
  if (!isAnalyticsEnabled()) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location:
      window.location.origin + window.location.pathname + "#" + path,
    page_title: document.title,
  });
}

// Track a key interaction. `params` must contain no PII.
export function trackEvent(action, params = {}) {
  if (!isAnalyticsEnabled()) return;
  window.gtag("event", action, params);
}
