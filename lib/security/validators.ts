/**
 * Security Utilities for DashOrb/DashAI
 * 
 * Provides input validation, sanitization, and security checks
 */

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Validate SQL query for safety
 */
export function validateSQLQuery(query: string): { valid: boolean; error?: string } {
  const normalized = query.trim().toUpperCase();
  
  // Check if it's a SELECT query
  if (!normalized.startsWith('SELECT')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }
  
  // Block dangerous keywords
  const dangerousKeywords = [
    'DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE',
    'TRUNCATE', 'EXECUTE', 'EXEC', 'xp_', 'sp_'
  ];
  
  for (const keyword of dangerousKeywords) {
    if (normalized.includes(keyword)) {
      return { valid: false, error: `Dangerous keyword detected: ${keyword}` };
    }
  }
  
  // Check for comment injection
  if (query.includes('--') || query.includes('/*')) {
    return { valid: false, error: 'SQL comments are not allowed' };
  }
  
  // Limit query length
  if (query.length > 5000) {
    return { valid: false, error: 'Query too long (max 5000 characters)' };
  }
  
  return { valid: true };
}

/**
 * Validate command input
 */
export function validateCommand(command: string): { valid: boolean; error?: string } {
  if (!command || command.trim().length === 0) {
    return { valid: false, error: 'Command cannot be empty' };
  }
  
  if (command.length > 2000) {
    return { valid: false, error: 'Command too long (max 2000 characters)' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /exec\s*\(/i,
    /eval\s*\(/i,
    /require\s*\(/i,
    /import\s+/i,
    /<script/i,
    /javascript:/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, error: 'Suspicious pattern detected' };
    }
  }
  
  return { valid: true };
}

/**
 * Check for PII in text
 */
export function containsPII(text: string): boolean {
  // South African ID number pattern (13 digits)
  const saIdPattern = /\b\d{13}\b/;
  
  // Email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  
  // Phone number patterns (SA)
  const phonePattern = /(\+27|0)[6-8]\d{8}/;
  
  // Credit card pattern
  const ccPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
  
  return (
    saIdPattern.test(text) ||
    emailPattern.test(text) ||
    phonePattern.test(text) ||
    ccPattern.test(text)
  );
}

/**
 * Rate limiter for client-side throttling
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  /**
   * Check if action is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    
    return true;
  }
  
  /**
   * Get remaining requests in current window
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }
  
  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
  
  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}
