import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { PrismaClient } from '../generated/prisma';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

const authService = new AuthService(new PrismaClient());

// Authentication middleware - verifies JWT token or API key
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = authService.verifyToken(token);
        req.user = payload;
        return next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    }

    // Check for API key in X-API-Key header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey) {
      const payload = await authService.verifyApiKey(apiKey);
      
      if (payload) {
        req.user = payload;
        return next();
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }
    }

    // No authentication provided
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

// Optional authentication - sets user if authenticated, but doesn't require it
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = authService.verifyToken(token);
        req.user = payload;
      } catch (error) {
        // Invalid token, but continue without user
      }
    }

    // Check for API key in X-API-Key header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey && !req.user) {
      const payload = await authService.verifyApiKey(apiKey);
      
      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue even if there's an error
  }
}

// Authorization middleware - checks if user has required role
export function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

// Middleware to check if user owns the resource
export async function checkResourceOwnership(
  resourceType: 'project' | 'execution' | 'apiKey'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admins can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    const prisma = new PrismaClient();
    const resourceId = req.params.id;

    try {
      let hasAccess = false;

      switch (resourceType) {
        case 'project':
          const project = await prisma.project.findUnique({
            where: { id: resourceId }
          });
          hasAccess = project?.userId === req.user.userId;
          break;

        case 'execution':
          const execution = await prisma.execution.findUnique({
            where: { id: resourceId },
            include: { project: true }
          });
          hasAccess = execution?.project.userId === req.user.userId;
          break;

        case 'apiKey':
          const apiKey = await prisma.apiKey.findUnique({
            where: { id: resourceId }
          });
          hasAccess = apiKey?.userId === req.user.userId;
          break;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this resource'
        });
      }

      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking resource ownership'
      });
    } finally {
      await prisma.$disconnect();
    }
  };
}