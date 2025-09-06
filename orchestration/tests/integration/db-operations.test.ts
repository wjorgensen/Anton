import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '../../src/generated/prisma';
import { AuthService } from '../../src/services/AuthService';
import { DatabaseService } from '../../src/services/DatabaseService';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const authService = new AuthService(prisma);
const dbService = new DatabaseService(prisma);

describe('Database Operations Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.nodeExecution.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.project.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const result = await authService.register(
        'test@example.com',
        'password123',
        'Test User'
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.token).toBeTruthy();

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });
      expect(user).toBeTruthy();
      expect(user?.isActive).toBe(true);
    });

    test('should authenticate user with correct credentials', async () => {
      // Create user first
      await authService.register('test@example.com', 'password123');

      // Try to login
      const result = await authService.login('test@example.com', 'password123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeTruthy();

      // Verify last login was updated
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });
      expect(user?.lastLoginAt).toBeTruthy();
    });

    test('should reject login with incorrect password', async () => {
      await authService.register('test@example.com', 'password123');

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should change user password', async () => {
      const { user } = await authService.register('test@example.com', 'oldpassword');
      
      await authService.changePassword(user.id, 'oldpassword', 'newpassword');
      
      // Should login with new password
      await expect(
        authService.login('test@example.com', 'newpassword')
      ).resolves.toBeTruthy();
      
      // Should not login with old password
      await expect(
        authService.login('test@example.com', 'oldpassword')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('API Key Operations', () => {
    test('should create and verify API key', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const apiKey = await authService.createApiKey(user.id, 'Test API Key', 30);
      expect(apiKey.key).toBeTruthy();
      expect(apiKey.id).toBeTruthy();

      // Verify API key
      const verified = await authService.verifyApiKey(apiKey.key);
      expect(verified).toBeTruthy();
      expect(verified?.userId).toBe(user.id);
    });

    test('should expire API key', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      // Create key that expires in the past (negative days)
      const apiKey = await authService.createApiKey(user.id, 'Expired Key', -1);
      
      // Should not verify expired key
      const verified = await authService.verifyApiKey(apiKey.key);
      expect(verified).toBeNull();
    });

    test('should list user API keys', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      await authService.createApiKey(user.id, 'Key 1', 30);
      await authService.createApiKey(user.id, 'Key 2', 60);
      
      const keys = await authService.listApiKeys(user.id);
      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBeTruthy();
      expect(keys[1].name).toBeTruthy();
    });
  });

  describe('Project Operations', () => {
    test('should create a project', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        description: 'Test description',
        flow: {
          id: 'test-flow',
          version: 1,
          nodes: [],
          edges: []
        },
        userId: user.id
      });

      expect(project.id).toBeTruthy();
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('created');
      expect(project.userId).toBe(user.id);
    });

    test('should list user projects', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      await dbService.createProject({
        name: 'Project 1',
        flow: { id: 'flow1', version: 1, nodes: [], edges: [] },
        userId: user.id
      });
      
      await dbService.createProject({
        name: 'Project 2',
        flow: { id: 'flow2', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const projects = await prisma.project.findMany({
        where: { userId: user.id }
      });
      
      expect(projects).toHaveLength(2);
    });

    test('should update project', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Original Name',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const updated = await dbService.updateProject(project.id, {
        name: 'Updated Name',
        description: 'Updated description'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
    });

    test('should delete project and cascade to executions', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'To Delete',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      // Create an execution
      await dbService.createExecution({
        projectId: project.id,
        status: 'pending'
      });

      // Delete project
      await prisma.project.delete({ where: { id: project.id } });

      // Verify project and execution are deleted
      const deletedProject = await prisma.project.findUnique({
        where: { id: project.id }
      });
      const executions = await prisma.execution.findMany({
        where: { projectId: project.id }
      });

      expect(deletedProject).toBeNull();
      expect(executions).toHaveLength(0);
    });
  });

  describe('Execution Operations', () => {
    test('should create and start execution', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: {
          id: 'flow',
          version: 1,
          nodes: [
            {
              id: 'node1',
              agentId: 'test-agent',
              label: 'Test Node',
              instructions: 'Test',
              status: 'pending'
            }
          ],
          edges: []
        },
        userId: user.id
      });

      const execution = await dbService.createExecution({
        projectId: project.id,
        status: 'starting'
      });

      expect(execution.id).toBeTruthy();
      expect(execution.projectId).toBe(project.id);
      expect(execution.status).toBe('starting');

      // Update to running
      const updated = await dbService.updateExecution(execution.id, {
        status: 'running'
      });
      expect(updated.status).toBe('running');
    });

    test('should create node executions', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const execution = await dbService.createExecution({
        projectId: project.id,
        status: 'running'
      });

      const nodeExec = await dbService.createNodeExecution({
        executionId: execution.id,
        nodeId: 'test-node',
        agentType: 'test-agent',
        status: 'running'
      });

      expect(nodeExec.id).toBeTruthy();
      expect(nodeExec.executionId).toBe(execution.id);
      expect(nodeExec.status).toBe('running');
    });

    test('should update node execution with output', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const execution = await dbService.createExecution({
        projectId: project.id,
        status: 'running'
      });

      const nodeExec = await dbService.createNodeExecution({
        executionId: execution.id,
        nodeId: 'test-node',
        agentType: 'test-agent',
        status: 'running'
      });

      const updated = await dbService.updateNodeExecution(nodeExec.id, {
        status: 'completed',
        output: {
          success: true,
          message: 'Test completed',
          data: { result: 'success' }
        },
        completedAt: new Date()
      });

      expect(updated.status).toBe('completed');
      expect(updated.output).toEqual({
        success: true,
        message: 'Test completed',
        data: { result: 'success' }
      });
      expect(updated.completedAt).toBeTruthy();
    });

    test('should get execution with nodes', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const execution = await dbService.createExecution({
        projectId: project.id,
        status: 'running'
      });

      await dbService.createNodeExecution({
        executionId: execution.id,
        nodeId: 'node1',
        agentType: 'agent1',
        status: 'completed'
      });

      await dbService.createNodeExecution({
        executionId: execution.id,
        nodeId: 'node2',
        agentType: 'agent2',
        status: 'running'
      });

      const fullExecution = await dbService.getExecution(execution.id);
      expect(fullExecution).toBeTruthy();
      expect(fullExecution?.nodes).toHaveLength(2);
      expect(fullExecution?.project.name).toBe('Test Project');
    });

    test('should handle failed execution', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      const execution = await dbService.createExecution({
        projectId: project.id,
        status: 'running'
      });

      const failed = await dbService.updateExecution(execution.id, {
        status: 'failed',
        errorMessage: 'Test error occurred',
        completedAt: new Date()
      });

      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('Test error occurred');
      expect(failed.completedAt).toBeTruthy();
    });
  });

  describe('Execution History and Statistics', () => {
    test('should get execution history with filters', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      // Create multiple executions
      await dbService.createExecution({
        projectId: project.id,
        status: 'completed'
      });

      await dbService.createExecution({
        projectId: project.id,
        status: 'failed'
      });

      await dbService.createExecution({
        projectId: project.id,
        status: 'running'
      });

      // Get all executions
      const allExecutions = await prisma.execution.findMany({
        where: { projectId: project.id }
      });
      expect(allExecutions).toHaveLength(3);

      // Filter by status
      const failedExecutions = await prisma.execution.findMany({
        where: { projectId: project.id, status: 'failed' }
      });
      expect(failedExecutions).toHaveLength(1);
    });

    test('should calculate execution statistics', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      const project = await dbService.createProject({
        name: 'Test Project',
        flow: { id: 'flow', version: 1, nodes: [], edges: [] },
        userId: user.id
      });

      // Create executions with different statuses
      await dbService.createExecution({ projectId: project.id, status: 'completed' });
      await dbService.createExecution({ projectId: project.id, status: 'completed' });
      await dbService.createExecution({ projectId: project.id, status: 'failed' });
      await dbService.createExecution({ projectId: project.id, status: 'running' });
      await dbService.createExecution({ projectId: project.id, status: 'pending' });

      const stats = await prisma.execution.groupBy({
        by: ['status'],
        where: { projectId: project.id },
        _count: true
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      expect(statusCounts['completed']).toBe(2);
      expect(statusCounts['failed']).toBe(1);
      expect(statusCounts['running']).toBe(1);
      expect(statusCounts['pending']).toBe(1);
    });
  });

  describe('Transaction and Concurrency', () => {
    test('should handle concurrent project creation', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      // Create multiple projects concurrently
      const promises = Array.from({ length: 5 }, (_, i) => 
        dbService.createProject({
          name: `Concurrent Project ${i}`,
          flow: { id: `flow${i}`, version: 1, nodes: [], edges: [] },
          userId: user.id
        })
      );

      const projects = await Promise.all(promises);
      expect(projects).toHaveLength(5);
      
      // Verify all projects were created
      const allProjects = await prisma.project.findMany({
        where: { userId: user.id }
      });
      expect(allProjects).toHaveLength(5);
    });

    test('should handle transaction rollback on error', async () => {
      const { user } = await authService.register('test@example.com', 'password123');
      
      try {
        await prisma.$transaction(async (tx) => {
          // Create a project
          await tx.project.create({
            data: {
              name: 'Transaction Test',
              flow: { id: 'flow', version: 1, nodes: [], edges: [] },
              status: 'created',
              userId: user.id
            }
          });

          // Force an error
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected error
      }

      // Verify project was not created due to rollback
      const projects = await prisma.project.findMany({
        where: { userId: user.id }
      });
      expect(projects).toHaveLength(0);
    });
  });
});

describe('Database Seeding Verification', () => {
  test('should verify seed data exists', async () => {
    // Don't delete data - just verify it exists from the seed that ran
    
    // Verify admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@anton.app' }
    });
    expect(adminUser).toBeTruthy();
    expect(adminUser?.role).toBe('admin');

    // Verify demo user
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@anton.app' }
    });
    expect(demoUser).toBeTruthy();
    expect(demoUser?.role).toBe('user');

    // Verify projects were created
    const projects = await prisma.project.findMany();
    expect(projects.length).toBeGreaterThan(0);

    // Verify executions were created
    const executions = await prisma.execution.findMany();
    expect(executions.length).toBeGreaterThan(0);

    // Verify different execution statuses
    const statuses = new Set(executions.map(e => e.status));
    expect(statuses.has('pending')).toBe(true);
    expect(statuses.has('running')).toBe(true);
    expect(statuses.has('completed')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
  });
});