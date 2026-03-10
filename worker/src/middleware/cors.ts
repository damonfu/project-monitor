import { cors } from 'hono/cors';
import type { Context } from 'hono';

/**
 * CORS middleware configuration
 * Allows requests from configured origins
 */
export function createCorsMiddleware(allowedOrigins: string[]) {
  return cors({
    origin: (origin: string, c: Context) => {
      // In development, allow all origins if no specific origins configured
      if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        return origin;
      }
      
      // Check if the origin is allowed
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      
      // Return first allowed origin as default
      return allowedOrigins[0] || '';
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  });
}

/**
 * Get allowed origins from environment
 */
export function getAllowedOrigins(env: { ALLOWED_ORIGINS?: string }): string[] {
  if (!env.ALLOWED_ORIGINS) {
    // Default origins for development
    return [
      'http://localhost:5173',  // Vite dev server
      'http://localhost:4173',  // Vite preview
      'http://localhost:8787',  // Wrangler dev
      'https://pages.dev',      // Cloudflare Pages (wildcard)
    ];
  }
  
  return env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}
