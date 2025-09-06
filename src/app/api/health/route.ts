import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

const statAsync = promisify(fs.stat);

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    return {
      service: 'database',
      status: responseTime < 100 ? 'healthy' : 'degraded',
      responseTime,
      message: responseTime < 100 ? 'Database responding normally' : 'Database responding slowly'
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      message: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    await redis.ping();
    const responseTime = Date.now() - start;
    
    return {
      service: 'redis',
      status: responseTime < 50 ? 'healthy' : 'degraded',
      responseTime,
      message: responseTime < 50 ? 'Redis responding normally' : 'Redis responding slowly'
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      message: 'Redis connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkFileSystem(): Promise<HealthCheck> {
  try {
    const tempDir = os.tmpdir();
    const stats = await statAsync(tempDir);
    
    const freeSpace = os.freemem();
    const totalSpace = os.totalmem();
    const usedPercentage = ((totalSpace - freeSpace) / totalSpace) * 100;
    
    return {
      service: 'filesystem',
      status: usedPercentage < 90 ? 'healthy' : 'degraded',
      message: `Disk usage: ${usedPercentage.toFixed(1)}%`,
      details: {
        freeSpace: Math.round(freeSpace / 1024 / 1024), // MB
        totalSpace: Math.round(totalSpace / 1024 / 1024), // MB
        usedPercentage: usedPercentage.toFixed(1)
      }
    };
  } catch (error) {
    return {
      service: 'filesystem',
      status: 'unhealthy',
      message: 'Filesystem check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const used = process.memoryUsage();
  const heapUsed = used.heapUsed / 1024 / 1024; // MB
  const heapTotal = used.heapTotal / 1024 / 1024; // MB
  const rss = used.rss / 1024 / 1024; // MB
  const external = used.external / 1024 / 1024; // MB
  
  const status = heapUsed < 500 ? 'healthy' : heapUsed < 1000 ? 'degraded' : 'unhealthy';
  
  return {
    service: 'memory',
    status,
    message: `Heap: ${heapUsed.toFixed(1)}MB / ${heapTotal.toFixed(1)}MB`,
    details: {
      heapUsed: heapUsed.toFixed(1),
      heapTotal: heapTotal.toFixed(1),
      rss: rss.toFixed(1),
      external: external.toFixed(1)
    }
  };
}

async function checkCpu(): Promise<HealthCheck> {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  
  // Calculate CPU usage
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);
  
  const status = usage < 70 ? 'healthy' : usage < 90 ? 'degraded' : 'unhealthy';
  
  return {
    service: 'cpu',
    status,
    message: `CPU usage: ${usage}%`,
    details: {
      cores: cpus.length,
      usage: `${usage}%`,
      loadAverage: loadAvg.map(l => l.toFixed(2))
    }
  };
}

async function checkUptime(): Promise<HealthCheck> {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  return {
    service: 'uptime',
    status: 'healthy',
    message: `Uptime: ${days}d ${hours}h ${minutes}m`,
    details: {
      seconds: Math.floor(uptime),
      formatted: `${days}d ${hours}h ${minutes}m`
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const verbose = searchParams.get('verbose') === 'true';
    
    // Run all health checks in parallel
    const checks = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkFileSystem(),
      checkMemory(),
      checkCpu(),
      checkUptime()
    ]);
    
    // Determine overall status
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');
    
    const overallStatus = hasUnhealthy ? 'unhealthy' : 
                          hasDegraded ? 'degraded' : 'healthy';
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: verbose ? checks : checks.map(({ service, status, message }) => ({
        service,
        status,
        message
      })),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 
                       overallStatus === 'degraded' ? 200 : 200;
    
    return NextResponse.json(response, { status: httpStatus });
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

// Liveness check - minimal check to verify service is running
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}