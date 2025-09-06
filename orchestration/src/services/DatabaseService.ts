import { PrismaClient } from '../generated/prisma';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async createProject(data: {
    name: string;
    description?: string;
    flow: any;
    userId?: string;
  }) {
    return await this.prisma.project.create({
      data: {
        ...data,
        status: 'created',
      },
    });
  }

  async getProject(id: string) {
    return await this.prisma.project.findUnique({
      where: { id },
      include: {
        executions: {
          include: {
            nodes: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
  }

  async listProjects(userId?: string) {
    return await this.prisma.project.findMany({
      where: userId ? { userId } : undefined,
      include: {
        executions: {
          include: {
            nodes: true,
          },
          orderBy: { startedAt: 'desc' },
          take: 1, // Only latest execution
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateProject(id: string, data: {
    name?: string;
    description?: string;
    flow?: any;
    status?: string;
  }) {
    return await this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async deleteProject(id: string) {
    return await this.prisma.project.delete({
      where: { id },
    });
  }

  async createExecution(data: {
    projectId: string;
    status?: string;
    metadata?: any;
  }) {
    return await this.prisma.execution.create({
      data: {
        projectId: data.projectId,
        status: data.status || 'starting',
        metadata: data.metadata,
      },
    });
  }

  async getExecution(id: string) {
    return await this.prisma.execution.findUnique({
      where: { id },
      include: {
        project: true,
        nodes: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  async updateExecution(id: string, data: {
    status?: string;
    completedAt?: Date;
    errorMessage?: string;
    metadata?: any;
  }) {
    return await this.prisma.execution.update({
      where: { id },
      data,
    });
  }

  async createNodeExecution(data: {
    executionId: string;
    nodeId: string;
    agentType: string;
    status?: string;
  }) {
    return await this.prisma.nodeExecution.create({
      data: {
        executionId: data.executionId,
        nodeId: data.nodeId,
        agentType: data.agentType,
        status: data.status || 'pending',
      },
    });
  }

  async createManyNodeExecutions(data: Array<{
    executionId: string;
    nodeId: string;
    agentType: string;
    status?: string;
  }>) {
    return await this.prisma.nodeExecution.createMany({
      data: data.map(item => ({
        ...item,
        status: item.status || 'pending',
      })),
    });
  }

  async updateNodeExecution(id: string, data: {
    status?: string;
    output?: any;
    errorMessage?: string;
    retryCount?: number;
    completedAt?: Date;
  }) {
    return await this.prisma.nodeExecution.update({
      where: { id },
      data,
    });
  }

  async findNodeExecution(executionId: string, nodeId: string) {
    return await this.prisma.nodeExecution.findFirst({
      where: {
        executionId,
        nodeId,
      },
    });
  }

  async getExecutionNodes(executionId: string) {
    return await this.prisma.nodeExecution.findMany({
      where: { executionId },
      orderBy: { startedAt: 'asc' },
    });
  }

  async getActiveExecutions() {
    return await this.prisma.execution.findMany({
      where: {
        status: {
          in: ['starting', 'running', 'paused'],
        },
      },
      include: {
        project: true,
        nodes: true,
      },
    });
  }

  async getNodeExecutionMetrics(executionId: string) {
    const nodes = await this.prisma.nodeExecution.findMany({
      where: { executionId },
    });

    const total = nodes.length;
    const completed = nodes.filter(n => n.status === 'completed').length;
    const failed = nodes.filter(n => n.status === 'failed').length;
    const running = nodes.filter(n => n.status === 'running').length;
    const pending = nodes.filter(n => n.status === 'pending').length;

    return {
      total,
      completed,
      failed,
      running,
      pending,
      progress: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }

  // Get underlying Prisma client for advanced queries
  getPrisma() {
    return this.prisma;
  }
}

export default DatabaseService;