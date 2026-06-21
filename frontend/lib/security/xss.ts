// XSS Protection utilities

// HTML entities map for escaping
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
  "=": "&#x3D;",
};

// Regex pattern for matching HTML special characters
const HTML_SPECIAL_CHARS = /[&<>"'`=/]/g;

/**
 * Escape HTML special characters to prevent XSS attacks
 */
export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(HTML_SPECIAL_CHARS, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string by removing potential XSS vectors
 */
export function sanitizeInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string") return String(input);

  // Remove script tags and their contents
  let sanitized = input.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  // Remove data: URLs that could contain scripts
  sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, "");

  // Remove vbscript: URLs (for older IE)
  sanitized = sanitized.replace(/vbscript\s*:/gi, "");

  // Escape remaining HTML special characters
  return escapeHtml(sanitized);
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeInput(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Create a safe HTML string for dangerouslySetInnerHTML
 * Only use this when you absolutely need to render HTML
 */
export function createSafeHtml(html: string): { __html: string } {
  // Use a more aggressive sanitization for innerHTML
  let safe = html;

  // Remove all script-related content
  safe = safe.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  safe = safe.replace(/<\/script>/gi, "");
  safe = safe.replace(/<script/gi, "");

  // Remove style tags (can be used for CSS injection attacks)
  safe = safe.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove event handlers
  safe = safe.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  safe = safe.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove dangerous attributes
  safe = safe.replace(
    /\s*(href|src|action|formaction)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi,
    "",
  );
  safe = safe.replace(
    /\s*(href|src|action|formaction)\s*=\s*["']?\s*vbscript:[^"'>\s]*/gi,
    "",
  );
  safe = safe.replace(
    /\s*(href|src|action|formaction)\s*=\s*["']?\s*data:text\/html[^"'>\s]*/gi,
    "",
  );

  // Remove iframe, object, embed tags (potential XSS vectors)
  safe = safe.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");
  safe = safe.replace(/<object[^>]*>.*?<\/object>/gi, "");
  safe = safe.replace(/<embed[^>]*>/gi, "");

  // Remove base tag (can hijack relative URLs)
  safe = safe.replace(/<base[^>]*>/gi, "");

  // Remove form elements that could be used for phishing
  safe = safe.replace(/<form[^>]*>.*?<\/form>/gi, "");

  return { __html: safe };
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "";

  const trimmed = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "vbscript:", "data:text/html"];
  const lowerUrl = trimmed.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return "";
    }
  }

  // Allow relative URLs, http, https, mailto, tel
  const allowedProtocols = [
    "http://",
    "https://",
    "mailto:",
    "tel:",
    "//",
    "/",
  ];
  const isAllowed =
    allowedProtocols.some((p) => lowerUrl.startsWith(p)) ||
    !trimmed.includes(":"); // Relative URLs

  return isAllowed ? trimmed : "";
}

/**
 * Sanitize CSS value to prevent CSS injection
 */
export function sanitizeCssValue(value: string): string {
  if (typeof value !== "string") return "";

  // Remove expressions (IE-specific CSS exploit)
  let sanitized = value.replace(/expression\s*\(/gi, "");

  // Remove url() with javascript/vbscript
  sanitized = sanitized.replace(
    /url\s*\(\s*["']?\s*(javascript|vbscript):/gi,
    "url(",
  );

  // Remove behavior (IE-specific)
  sanitized = sanitized.replace(/behavior\s*:/gi, "");

  // Remove -moz-binding (Firefox-specific)
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, "");

  return sanitized;
}
