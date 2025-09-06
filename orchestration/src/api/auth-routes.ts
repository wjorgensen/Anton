import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService';
import { PrismaClient } from '../generated/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const authService = new AuthService(prisma);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6)
});

const createApiKeySchema = z.object({
  name: z.string(),
  expiresInDays: z.number().optional()
});

// User Registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.register(
      validated.email,
      validated.password,
      validated.name
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else if (error instanceof Error) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// User Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated.email, validated.password);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update User Profile
router.patch('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = (req as any).user.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = changePasswordSchema.parse(req.body);
    const userId = (req as any).user.userId;

    await authService.changePassword(userId, validated.currentPassword, validated.newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
});

// Create API Key
router.post('/api-keys', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = createApiKeySchema.parse(req.body);
    const userId = (req as any).user.userId;

    const apiKey = await authService.createApiKey(
      userId,
      validated.name,
      validated.expiresInDays
    );

    res.status(201).json(apiKey);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
});

// List API Keys
router.get('/api-keys', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(apiKeys);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Revoke API Key
router.delete('/api-keys/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Logout (client-side token removal, but we can use this for audit)
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    // You could implement token blacklisting here if needed
    // For now, just acknowledge the logout
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;