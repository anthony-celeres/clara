export function scrubPII(input: string): string {
  if (!input) return "";
  let sanitized = input;

  // SSS/GSIS Number
  sanitized = sanitized.replace(/\b\d{2}-\d{7}-\d\b/g, "[SSS_NUMBER_REDACTED]");

  // TIN Number (either XXX-XXX-XXX-XXX or 9 digits)
  sanitized = sanitized.replace(/\b\d{3}-\d{3}-\d{3}-\d{3}\b/g, "[TIN_REDACTED]");
  sanitized = sanitized.replace(/\b\d{9}\b/g, "[TIN_REDACTED]");

  // PhilSys PCN
  sanitized = sanitized.replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, "[PHIL_ID_REDACTED]");

  // Date of Birth (MM/DD/YYYY or MM-DD-YYYY, supporting single/double digits)
  // Pattern: \b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{4})\b
  sanitized = sanitized.replace(/\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{4})\b/g, "[DOB_REDACTED]");

  // Phone (PH)
  sanitized = sanitized.replace(/\b(09|\+639)\d{9}\b/g, "[PHONE_REDACTED]");

  // Email
  sanitized = sanitized.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, "[EMAIL_REDACTED]");

  return sanitized;
}
