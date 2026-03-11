/**
 * Simple in-memory rate limiter for frontend use.
 * Tracks attempt timestamps per key (e.g. email address).
 */

const attemptLog = new Map<string, number[]>();

/**
 * Record an attempt and check if the action is allowed.
 * @param key - identifier, e.g. the email being used to log in
 * @param maxAttempts - max attempts allowed within the window
 * @param windowMs - sliding window duration in milliseconds
 * @returns true if the attempt is allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const prev = attemptLog.get(key) ?? [];
  const recent = prev.filter(t => now - t < windowMs);

  if (recent.length >= maxAttempts) {
    attemptLog.set(key, recent);
    return false;
  }

  recent.push(now);
  attemptLog.set(key, recent);
  return true;
}

/**
 * Seconds remaining until the oldest attempt in the window expires.
 * Returns 0 if not rate-limited.
 */
export function getRateLimitWait(key: string, windowMs = 60_000): number {
  const now = Date.now();
  const prev = attemptLog.get(key) ?? [];
  const recent = prev.filter(t => now - t < windowMs);
  if (recent.length === 0) return 0;
  const oldest = Math.min(...recent);
  const ms = windowMs - (now - oldest);
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Clear stored attempts for a key (e.g. on successful login) */
export function clearRateLimit(key: string): void {
  attemptLog.delete(key);
}
