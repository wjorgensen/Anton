import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// General API rate limiter - 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Stricter rate limiter for auth endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Rate limiter for execution endpoints - 10 executions per hour per user
export const executionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 executions per hour
  message: 'Execution limit reached. Please wait before starting new executions',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting for admin users
    return (req as any).user?.role === 'admin';
  }
});

// Rate limiter for project creation - 20 projects per day per user
export const projectCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // limit each user to 20 projects per day
  message: 'Project creation limit reached. Please try again tomorrow',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting for admin users
    return (req as any).user?.role === 'admin';
  }
});

// Rate limiter for API key creation - 10 keys per user total
export const apiKeyLimiter = rateLimit({
  windowMs: 365 * 24 * 60 * 60 * 1000, // 1 year (essentially permanent)
  max: 10, // limit each user to 10 API keys total
  message: 'API key limit reached. Please revoke unused keys before creating new ones',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID
    return (req as any).user?.userId || 'unknown';
  }
});

// WebSocket connection rate limiter - prevent connection spam
export const websocketLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 WebSocket connections per minute
  message: 'Too many WebSocket connection attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});