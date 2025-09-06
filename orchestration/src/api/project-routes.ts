import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Project Templates
const projectTemplates = [
  {
    id: 'nextjs-ecommerce',
    name: 'Next.js E-commerce Platform',
    description: 'Full-stack e-commerce platform with payment integration',
    category: 'web',
    framework: 'nextjs',
    difficulty: 'advanced',
    estimatedTime: '2-3 hours',
    flow: {
      id: 'ecommerce-template',
      version: 1,
      name: 'E-commerce Setup',
      nodes: [
        {
          id: 'setup',
          agentId: 'nextjs-setup',
          label: 'Setup Next.js',
          instructions: 'Initialize Next.js with TypeScript and Tailwind'
        },
        {
          id: 'database',
          agentId: 'postgres-setup',
          label: 'Setup Database',
          instructions: 'Configure PostgreSQL with Prisma ORM'
        },
        {
          id: 'frontend',
          agentId: 'react-developer',
          label: 'Build Frontend',
          instructions: 'Create product catalog and shopping cart'
        },
        {
          id: 'api',
          agentId: 'api-developer',
          label: 'Build API',
          instructions: 'Implement REST API for products and orders'
        },
        {
          id: 'test',
          agentId: 'playwright-e2e',
          label: 'E2E Testing',
          instructions: 'Write and run end-to-end tests'
        }
      ],
      edges: [
        { source: 'setup', target: 'database' },
        { source: 'database', target: 'frontend' },
        { source: 'database', target: 'api' },
        { source: 'frontend', target: 'test' },
        { source: 'api', target: 'test' }
      ]
    }
  },
  {
    id: 'python-api',
    name: 'Python Microservices API',
    description: 'FastAPI microservices with Docker deployment',
    category: 'backend',
    framework: 'fastapi',
    difficulty: 'intermediate',
    estimatedTime: '1-2 hours',
    flow: {
      id: 'python-api-template',
      version: 1,
      name: 'API Development',
      nodes: [
        {
          id: 'setup',
          agentId: 'fastapi-setup',
          label: 'Setup FastAPI',
          instructions: 'Initialize FastAPI project'
        },
        {
          id: 'develop',
          agentId: 'python-developer',
          label: 'Develop Services',
          instructions: 'Create microservices'
        },
        {
          id: 'docker',
          agentId: 'docker-builder',
          label: 'Dockerize',
          instructions: 'Create Docker configuration'
        },
        {
          id: 'test',
          agentId: 'pytest-runner',
          label: 'Run Tests',
          instructions: 'Write and run unit tests'
        }
      ],
      edges: [
        { source: 'setup', target: 'develop' },
        { source: 'develop', target: 'docker' },
        { source: 'docker', target: 'test' }
      ]
    }
  },
  {
    id: 'mobile-flutter',
    name: 'Flutter Mobile App',
    description: 'Cross-platform mobile application',
    category: 'mobile',
    framework: 'flutter',
    difficulty: 'intermediate',
    estimatedTime: '1-2 hours',
    flow: {
      id: 'flutter-template',
      version: 1,
      name: 'Mobile Development',
      nodes: [
        {
          id: 'setup',
          agentId: 'flutter-setup',
          label: 'Setup Flutter',
          instructions: 'Initialize Flutter project'
        },
        {
          id: 'develop',
          agentId: 'mobile-developer',
          label: 'Build App',
          instructions: 'Create screens and navigation'
        },
        {
          id: 'review',
          agentId: 'code-review',
          label: 'Code Review',
          instructions: 'Review code quality'
        }
      ],
      edges: [
        { source: 'setup', target: 'develop' },
        { source: 'develop', target: 'review' }
      ]
    }
  },
  {
    id: 'react-dashboard',
    name: 'React Admin Dashboard',
    description: 'Modern admin dashboard with charts and data visualization',
    category: 'web',
    framework: 'react',
    difficulty: 'intermediate',
    estimatedTime: '1-2 hours',
    flow: {
      id: 'dashboard-template',
      version: 1,
      name: 'Dashboard Development',
      nodes: [
        {
          id: 'setup',
          agentId: 'vite-react-setup',
          label: 'Setup React',
          instructions: 'Create Vite React project with TypeScript'
        },
        {
          id: 'develop',
          agentId: 'react-developer',
          label: 'Build Dashboard',
          instructions: 'Create dashboard components and charts'
        },
        {
          id: 'test',
          agentId: 'vitest-runner',
          label: 'Run Tests',
          instructions: 'Write and run component tests'
        }
      ],
      edges: [
        { source: 'setup', target: 'develop' },
        { source: 'develop', target: 'test' }
      ]
    }
  }
];

// Get Project Templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category, framework } = req.query;
    
    let filtered = projectTemplates;
    
    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }
    
    if (framework) {
      filtered = filtered.filter(t => t.framework === framework);
    }
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get Single Template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = projectTemplates.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create Project from Template
router.post('/templates/:id/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const template = projectTemplates.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const { name, description } = req.body;
    const userId = (req as any).user?.userId;
    
    const project = await prisma.project.create({
      data: {
        name: name || template.name,
        description: description || template.description,
        flow: template.flow,
        status: 'created',
        userId: userId || undefined,
        metadata: {
          templateId: template.id,
          createdFrom: 'template'
        }
      }
    });
    
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project from template' });
  }
});

// Get User's Projects
router.get('/my-projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { status, limit = 10, offset = 0 } = req.query;
    
    const where: any = { userId };
    
    if (status) {
      where.status = status as string;
    }
    
    const projects = await prisma.project.findMany({
      where,
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: Number(offset)
    });
    
    const total = await prisma.project.count({ where });
    
    res.json({
      projects,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Delete Project
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const projectId = req.params.id;
    
    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete project and all related data (cascading delete)
    await prisma.project.delete({
      where: { id: projectId }
    });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Update Project
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const projectId = req.params.id;
    const { name, description, flow } = req.body;
    
    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: name || undefined,
        description: description || undefined,
        flow: flow || undefined,
        updatedAt: new Date()
      }
    });
    
    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Clone Project
router.post('/:id/clone', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const projectId = req.params.id;
    
    const originalProject = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!originalProject) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const clonedProject = await prisma.project.create({
      data: {
        name: `${originalProject.name} (Copy)`,
        description: originalProject.description,
        flow: originalProject.flow,
        status: 'created',
        userId,
        metadata: {
          clonedFrom: originalProject.id,
          clonedAt: new Date()
        }
      }
    });
    
    res.status(201).json(clonedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to clone project' });
  }
});

export default router;