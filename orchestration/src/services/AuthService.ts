import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { PrismaClient } from '../generated/prisma';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  token: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private saltRounds: number;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.saltRounds = 10;

    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using default secret (UNSAFE for production)');
    }
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    // Generate token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  generateToken(user: any): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async createApiKey(userId: string, name: string, expiresInDays?: number): Promise<{ key: string; id: string }> {
    // Generate a secure random API key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = await bcrypt.hash(rawKey, this.saltRounds);

    const expiresAt = expiresInDays !== undefined
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        key: hashedKey,
        name,
        expiresAt
      }
    });

    // Return the raw key (only shown once)
    return {
      key: rawKey,
      id: apiKey.id
    };
  }

  async verifyApiKey(rawKey: string): Promise<TokenPayload | null> {
    // Find all API keys and check against them
    // This is inefficient but necessary since we're hashing the keys
    // In production, consider using a different approach
    const apiKeys = await this.prisma.apiKey.findMany({
      include: { user: true }
    });

    for (const apiKey of apiKeys) {
      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        continue;
      }

      // Verify the key
      const isValid = await bcrypt.compare(rawKey, apiKey.key);
      
      if (isValid) {
        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() }
        });

        return {
          userId: apiKey.user.id,
          email: apiKey.user.email,
          role: apiKey.user.role
        };
      }
    }

    return null;
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    await this.prisma.apiKey.delete({
      where: {
        id: keyId,
        userId // Ensure user can only revoke their own keys
      }
    });
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true
      }
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password);
    
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
  }
}