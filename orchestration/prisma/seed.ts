import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@anton.app' },
    update: {},
    create: {
      email: 'admin@anton.app',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
      isActive: true
    }
  });

  console.log(`✅ Created/Updated admin user: ${adminUser.email}`);

  // Create demo users
  const demoPassword = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@anton.app' },
    update: {},
    create: {
      email: 'demo@anton.app',
      password: demoPassword,
      name: 'Demo User',
      role: 'user',
      isActive: true
    }
  });

  const testPassword = await bcrypt.hash('test123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@anton.app' },
    update: {},
    create: {
      email: 'test@anton.app',
      password: testPassword,
      name: 'Test User',
      role: 'user',
      isActive: true
    }
  });

  console.log(`✅ Created demo users`);

  // Create API keys for testing
  const apiKey = await prisma.apiKey.upsert({
    where: { key: 'test-api-key-123' },
    update: {},
    create: {
      key: 'test-api-key-123',
      name: 'Test API Key',
      userId: demoUser.id,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    }
  });

  console.log(`✅ Created API key: ${apiKey.name}`);

  // Sample Project 1: Next.js E-commerce Platform
  const ecommerceProject = await prisma.project.create({
    data: {
      name: 'E-commerce Platform',
      description: 'Full-stack Next.js e-commerce platform with Stripe integration',
      status: 'created',
      userId: demoUser.id,
      flow: {
        id: 'ecommerce-flow',
        version: 1,
        name: 'E-commerce Setup and Development',
        description: 'Complete e-commerce platform development flow',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        nodes: [
          {
            id: 'setup-nextjs',
            agentId: 'nextjs-setup',
            label: 'Setup Next.js',
            instructions: 'Create Next.js 14 project with TypeScript, Tailwind CSS, and Prisma',
            inputs: {},
            position: { x: 100, y: 100 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'setup-database',
            agentId: 'postgres-setup',
            label: 'Setup Database',
            instructions: 'Setup PostgreSQL with Prisma schema for products, orders, and users',
            inputs: {},
            position: { x: 300, y: 100 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'develop-frontend',
            agentId: 'react-developer',
            label: 'Frontend Development',
            instructions: 'Create product catalog, shopping cart, and checkout components',
            inputs: {},
            position: { x: 500, y: 100 },
            config: {
              retryOnFailure: true,
              maxRetries: 1,
              timeout: 600000,
              requiresReview: true
            },
            status: 'pending'
          },
          {
            id: 'develop-api',
            agentId: 'api-developer',
            label: 'API Development',
            instructions: 'Create REST API endpoints for products, orders, and payments',
            inputs: {},
            position: { x: 700, y: 100 },
            config: {
              retryOnFailure: true,
              maxRetries: 1,
              timeout: 600000,
              requiresReview: true
            },
            status: 'pending'
          },
          {
            id: 'review-security',
            agentId: 'security-review',
            label: 'Security Review',
            instructions: 'Review code for security vulnerabilities and best practices',
            inputs: {},
            position: { x: 900, y: 100 },
            config: {
              retryOnFailure: false,
              maxRetries: 0,
              timeout: 300000,
              requiresReview: true
            },
            status: 'pending'
          },
          {
            id: 'test-e2e',
            agentId: 'playwright-e2e',
            label: 'E2E Testing',
            instructions: 'Write and run E2E tests for critical user flows',
            inputs: {},
            position: { x: 1100, y: 100 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 600000,
              requiresReview: false
            },
            status: 'pending'
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'setup-nextjs',
            target: 'setup-database',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-2',
            source: 'setup-database',
            target: 'develop-frontend',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-3',
            source: 'setup-database',
            target: 'develop-api',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-4',
            source: 'develop-frontend',
            target: 'review-security',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-5',
            source: 'develop-api',
            target: 'review-security',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-6',
            source: 'review-security',
            target: 'test-e2e',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'approved' }
          }
        ],
        metadata: {
          framework: 'nextjs',
          language: 'typescript',
          database: 'postgresql',
          testing: 'playwright'
        }
      }
    }
  });

  console.log(`✅ Created E-commerce Project: ${ecommerceProject.id}`);

  // Sample Project 2: Python Microservices API
  const microservicesProject = await prisma.project.create({
    data: {
      name: 'Python Microservices API',
      description: 'FastAPI-based microservices with Redis caching and Docker deployment',
      status: 'created',
      userId: testUser.id,
      flow: {
        id: 'microservices-flow',
        version: 1,
        name: 'Microservices Development Flow',
        description: 'Build and deploy Python microservices',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        nodes: [
          {
            id: 'setup-fastapi',
            agentId: 'fastapi-setup',
            label: 'Setup FastAPI',
            instructions: 'Initialize FastAPI project with Docker and Redis support',
            inputs: {},
            position: { x: 100, y: 200 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'develop-services',
            agentId: 'python-developer',
            label: 'Develop Services',
            instructions: 'Create user, auth, and product microservices',
            inputs: {},
            position: { x: 300, y: 200 },
            config: {
              retryOnFailure: true,
              maxRetries: 1,
              timeout: 600000,
              requiresReview: true
            },
            status: 'pending'
          },
          {
            id: 'setup-redis',
            agentId: 'redis-setup',
            label: 'Setup Redis',
            instructions: 'Configure Redis for caching and session management',
            inputs: {},
            position: { x: 500, y: 200 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'docker-build',
            agentId: 'docker-builder',
            label: 'Docker Build',
            instructions: 'Create Dockerfiles and docker-compose configuration',
            inputs: {},
            position: { x: 700, y: 200 },
            config: {
              retryOnFailure: true,
              maxRetries: 1,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'test-pytest',
            agentId: 'pytest-runner',
            label: 'Run Tests',
            instructions: 'Write and run unit and integration tests with pytest',
            inputs: {},
            position: { x: 900, y: 200 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          }
        ],
        edges: [
          {
            id: 'edge-m1',
            source: 'setup-fastapi',
            target: 'develop-services',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-m2',
            source: 'develop-services',
            target: 'setup-redis',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-m3',
            source: 'setup-redis',
            target: 'docker-build',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-m4',
            source: 'docker-build',
            target: 'test-pytest',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          }
        ],
        metadata: {
          framework: 'fastapi',
          language: 'python',
          containerization: 'docker',
          caching: 'redis'
        }
      }
    }
  });

  console.log(`✅ Created Microservices Project: ${microservicesProject.id}`);

  // Sample Project 3: Mobile Flutter App
  const mobileProject = await prisma.project.create({
    data: {
      name: 'Mobile Flutter App',
      description: 'Cross-platform mobile app with Firebase backend',
      status: 'created',
      userId: adminUser.id,
      flow: {
        id: 'mobile-flow',
        version: 1,
        name: 'Flutter Mobile Development',
        description: 'Build cross-platform mobile application',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        nodes: [
          {
            id: 'setup-flutter',
            agentId: 'flutter-setup',
            label: 'Setup Flutter',
            instructions: 'Initialize Flutter project with Firebase integration',
            inputs: {},
            position: { x: 100, y: 300 },
            config: {
              retryOnFailure: true,
              maxRetries: 2,
              timeout: 300000,
              requiresReview: false
            },
            status: 'pending'
          },
          {
            id: 'develop-mobile',
            agentId: 'mobile-developer',
            label: 'Mobile Development',
            instructions: 'Create screens, navigation, and state management',
            inputs: {},
            position: { x: 300, y: 300 },
            config: {
              retryOnFailure: true,
              maxRetries: 1,
              timeout: 600000,
              requiresReview: true
            },
            status: 'pending'
          },
          {
            id: 'code-review',
            agentId: 'code-review',
            label: 'Code Review',
            instructions: 'Review code quality and best practices',
            inputs: {},
            position: { x: 500, y: 300 },
            config: {
              retryOnFailure: false,
              maxRetries: 0,
              timeout: 300000,
              requiresReview: true
            },
            status: 'pending'
          }
        ],
        edges: [
          {
            id: 'edge-f1',
            source: 'setup-flutter',
            target: 'develop-mobile',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          },
          {
            id: 'edge-f2',
            source: 'develop-mobile',
            target: 'code-review',
            sourceHandle: 'output',
            targetHandle: 'input',
            condition: { type: 'success' }
          }
        ],
        metadata: {
          framework: 'flutter',
          language: 'dart',
          backend: 'firebase'
        }
      }
    }
  });

  console.log(`✅ Created Mobile Project: ${mobileProject.id}`);

  // Create sample executions with different statuses
  const pendingExecution = await prisma.execution.create({
    data: {
      projectId: ecommerceProject.id,
      status: 'pending',
      metadata: {
        createdBy: 'seed',
        purpose: 'sample-pending'
      }
    }
  });

  const runningExecution = await prisma.execution.create({
    data: {
      projectId: microservicesProject.id,
      status: 'running',
      startedAt: new Date(),
      metadata: {
        createdBy: 'seed',
        purpose: 'sample-running'
      }
    }
  });

  // Create node executions for the running execution
  await prisma.nodeExecution.create({
    data: {
      executionId: runningExecution.id,
      nodeId: 'setup-fastapi',
      agentType: 'fastapi-setup',
      status: 'completed',
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
      output: {
        success: true,
        message: 'FastAPI project initialized successfully',
        files: ['main.py', 'requirements.txt', 'Dockerfile']
      }
    }
  });

  await prisma.nodeExecution.create({
    data: {
      executionId: runningExecution.id,
      nodeId: 'develop-services',
      agentType: 'python-developer',
      status: 'running',
      startedAt: new Date(Date.now() - 4 * 60 * 1000),
      output: {}
    }
  });

  const completedExecution = await prisma.execution.create({
    data: {
      projectId: mobileProject.id,
      status: 'completed',
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: {
        createdBy: 'seed',
        purpose: 'sample-completed',
        duration: 30 * 60 * 1000
      }
    }
  });

  // Create node executions for the completed execution
  await prisma.nodeExecution.createMany({
    data: [
      {
        executionId: completedExecution.id,
        nodeId: 'setup-flutter',
        agentType: 'flutter-setup',
        status: 'completed',
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 50 * 60 * 1000),
        output: { success: true, message: 'Flutter project created' }
      },
      {
        executionId: completedExecution.id,
        nodeId: 'develop-mobile',
        agentType: 'mobile-developer',
        status: 'completed',
        startedAt: new Date(Date.now() - 49 * 60 * 1000),
        completedAt: new Date(Date.now() - 35 * 60 * 1000),
        output: { success: true, message: 'Mobile app developed' }
      },
      {
        executionId: completedExecution.id,
        nodeId: 'code-review',
        agentType: 'code-review',
        status: 'completed',
        startedAt: new Date(Date.now() - 34 * 60 * 1000),
        completedAt: new Date(Date.now() - 30 * 60 * 1000),
        output: { success: true, approved: true, message: 'Code review passed' }
      }
    ]
  });

  const failedExecution = await prisma.execution.create({
    data: {
      projectId: ecommerceProject.id,
      status: 'failed',
      startedAt: new Date(Date.now() - 90 * 60 * 1000),
      completedAt: new Date(Date.now() - 75 * 60 * 1000),
      errorMessage: 'Database connection failed during setup',
      metadata: {
        createdBy: 'seed',
        purpose: 'sample-failed'
      }
    }
  });

  console.log(`✅ Created sample executions:`);
  console.log(`   - Pending: ${pendingExecution.id}`);
  console.log(`   - Running: ${runningExecution.id}`);
  console.log(`   - Completed: ${completedExecution.id}`);
  console.log(`   - Failed: ${failedExecution.id}`);

  console.log('\n🌱 Database seeded successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Users: 3 (admin@anton.app, demo@anton.app, test@anton.app)`);
  console.log(`   - Projects: 3 (E-commerce, Microservices, Mobile)`);
  console.log(`   - Executions: 4 (1 pending, 1 running, 1 completed, 1 failed)`);
  console.log(`   - Node Executions: 5`);
  console.log(`   - API Keys: 1`);
  console.log('\n🚀 Default passwords:');
  console.log('   - admin@anton.app: admin123');
  console.log('   - demo@anton.app: demo123');
  console.log('   - test@anton.app: test123');
  console.log('\n⚠️  Please change these passwords in production!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });