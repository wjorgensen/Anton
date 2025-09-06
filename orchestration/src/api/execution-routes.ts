import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get Execution History
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { 
      status, 
      projectId, 
      limit = 20, 
      offset = 0,
      sortBy = 'startedAt',
      order = 'desc' 
    } = req.query;
    
    // Build where clause
    const where: any = {};
    
    // Filter by user's projects
    if (userId) {
      where.project = { userId };
    }
    
    if (status) {
      where.status = status as string;
    }
    
    if (projectId) {
      where.projectId = projectId as string;
    }
    
    // Fetch executions
    const executions = await prisma.execution.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        nodes: {
          select: {
            id: true,
            nodeId: true,
            status: true,
            agentType: true
          }
        }
      },
      orderBy: { [sortBy as string]: order },
      take: Number(limit),
      skip: Number(offset)
    });
    
    // Get total count
    const total = await prisma.execution.count({ where });
    
    // Calculate statistics
    const stats = await prisma.execution.groupBy({
      by: ['status'],
      where,
      _count: true
    });
    
    res.json({
      executions,
      total,
      limit: Number(limit),
      offset: Number(offset),
      statistics: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error('Failed to fetch execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

// Get Single Execution Details
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const executionId = req.params.id;
    const userId = (req as any).user.userId;
    
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        project: true,
        nodes: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    // Verify user has access to this execution
    if (execution.project.userId && execution.project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Calculate execution metrics
    const duration = execution.completedAt && execution.startedAt
      ? new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
      : null;
    
    const nodeStats = {
      total: execution.nodes.length,
      completed: execution.nodes.filter(n => n.status === 'completed').length,
      failed: execution.nodes.filter(n => n.status === 'failed').length,
      running: execution.nodes.filter(n => n.status === 'running').length,
      pending: execution.nodes.filter(n => n.status === 'pending').length
    };
    
    res.json({
      ...execution,
      metrics: {
        duration,
        nodeStats
      }
    });
  } catch (error) {
    console.error('Failed to fetch execution:', error);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// Get Node Execution Logs
router.get('/:executionId/nodes/:nodeId/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { executionId, nodeId } = req.params;
    const userId = (req as any).user.userId;
    
    // Verify access
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { project: true }
    });
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    if (execution.project.userId && execution.project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get node execution
    const nodeExecution = await prisma.nodeExecution.findFirst({
      where: {
        executionId,
        nodeId
      }
    });
    
    if (!nodeExecution) {
      return res.status(404).json({ error: 'Node execution not found' });
    }
    
    res.json({
      nodeId,
      executionId,
      status: nodeExecution.status,
      startedAt: nodeExecution.startedAt,
      completedAt: nodeExecution.completedAt,
      output: nodeExecution.output,
      errorMessage: nodeExecution.errorMessage,
      retryCount: nodeExecution.retryCount
    });
  } catch (error) {
    console.error('Failed to fetch node logs:', error);
    res.status(500).json({ error: 'Failed to fetch node logs' });
  }
});

// Stop Execution
router.post('/:id/stop', authenticateToken, async (req: Request, res: Response) => {
  try {
    const executionId = req.params.id;
    const userId = (req as any).user.userId;
    
    // Verify ownership
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { project: true }
    });
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    if (execution.project.userId && execution.project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!['pending', 'running'].includes(execution.status)) {
      return res.status(400).json({ error: 'Execution is not running' });
    }
    
    // Update execution status
    const updatedExecution = await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        metadata: {
          ...(execution.metadata as any || {}),
          stoppedBy: userId,
          stoppedAt: new Date()
        }
      }
    });
    
    // Update any running nodes
    await prisma.nodeExecution.updateMany({
      where: {
        executionId,
        status: { in: ['pending', 'running'] }
      },
      data: {
        status: 'cancelled',
        completedAt: new Date()
      }
    });
    
    res.json({ message: 'Execution stopped', execution: updatedExecution });
  } catch (error) {
    console.error('Failed to stop execution:', error);
    res.status(500).json({ error: 'Failed to stop execution' });
  }
});

// Retry Failed Execution
router.post('/:id/retry', authenticateToken, async (req: Request, res: Response) => {
  try {
    const executionId = req.params.id;
    const userId = (req as any).user.userId;
    
    // Verify ownership and status
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { 
        project: true,
        nodes: true
      }
    });
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    if (execution.project.userId && execution.project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (execution.status !== 'failed') {
      return res.status(400).json({ error: 'Can only retry failed executions' });
    }
    
    // Create new execution
    const newExecution = await prisma.execution.create({
      data: {
        projectId: execution.projectId,
        status: 'pending',
        metadata: {
          ...(execution.metadata as any || {}),
          retriedFrom: executionId,
          retriedBy: userId,
          retriedAt: new Date()
        }
      }
    });
    
    res.status(201).json({
      message: 'Execution retry created',
      execution: newExecution
    });
  } catch (error) {
    console.error('Failed to retry execution:', error);
    res.status(500).json({ error: 'Failed to retry execution' });
  }
});

// Get Execution Statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    // Get execution counts by status
    const statusCounts = await prisma.execution.groupBy({
      by: ['status'],
      where: {
        project: { userId },
        startedAt: { gte: startDate }
      },
      _count: true
    });
    
    // Get daily execution counts
    const executions = await prisma.execution.findMany({
      where: {
        project: { userId },
        startedAt: { gte: startDate }
      },
      select: {
        startedAt: true,
        status: true
      }
    });
    
    // Group by day
    const dailyStats: Record<string, any> = {};
    executions.forEach(exec => {
      const day = new Date(exec.startedAt).toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { total: 0, completed: 0, failed: 0 };
      }
      dailyStats[day].total++;
      if (exec.status === 'completed') dailyStats[day].completed++;
      if (exec.status === 'failed') dailyStats[day].failed++;
    });
    
    // Get average execution time
    const completedExecutions = await prisma.execution.findMany({
      where: {
        project: { userId },
        status: 'completed',
        startedAt: { gte: startDate },
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    });
    
    const executionTimes = completedExecutions.map(exec => {
      return new Date(exec.completedAt!).getTime() - new Date(exec.startedAt).getTime();
    });
    
    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;
    
    res.json({
      statusCounts: statusCounts.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats
      })),
      metrics: {
        totalExecutions: executions.length,
        avgExecutionTime,
        successRate: executions.length > 0
          ? (executions.filter(e => e.status === 'completed').length / executions.length) * 100
          : 0
      }
    });
  } catch (error) {
    console.error('Failed to fetch statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;