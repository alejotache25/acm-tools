/**
 * Input sanitization utilities.
 * Strips HTML tags, normalizes whitespace, and validates common field formats.
 */

/** Strip HTML tags and trim whitespace */
export function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/** Normalize name: no HTML, trimmed, max 255 chars */
export function sanitizeName(value: string): string {
  return sanitizeText(value).slice(0, 255);
}

/** Normalize email: trim + lowercase */
export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 255);
}

/** Allow only digits for phone, max 9 chars */
export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 9);
}

/** Allow only digits for PIN, max 4 chars */
export function sanitizePin(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

/** Validate email format */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Validate PIN: exactly 4 digits */
export function isValidPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}

/** Sanitize a schedule string (e.g. "09:00 - 18:00"), no HTML */
export function sanitizeSchedule(value: string): string {
  return sanitizeText(value).slice(0, 50);
}
