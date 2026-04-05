// This file is disabled as Sentry has been removed.
/*
import * as Sentry from "@sentry/react-native";

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

    // Performance tracing - 100% in dev, 30% in production
    tracesSampleRate: __DEV__ ? 1.0 : 0.3,

    // Auto-track navigation, HTTP requests, etc.
    enableAutoPerformanceTracing: true,

    // Session tracking for crash-free rate
    enableAutoSessionTracking: true,

    // Debug mode in development
    debug: __DEV__,

    // Limit offline caching to prevent SQLITE_FULL database errors
    maxCacheItems: 30,
  });
}

export { Sentry };
*/
export function initSentry() {}
export const Sentry = { wrap: (C: any) => C };
