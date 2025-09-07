import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ExecutionService } from '../services/ExecutionService';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

const router = Router();
const executionService = new ExecutionService();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Validation schema for execution
const executeSchema = z.object({
  planPath: z.string().optional(),
  plan: z.any().optional(),
  mode: z.enum(['full', 'selective']).default('full'),
  selectedNodes: z.array(z.string()).optional(),
  config: z.object({
    failFast: z.boolean().optional(),
    parallel: z.boolean().optional(),
    maxConcurrency: z.number().min(1).max(10).optional()
  }).optional()
});

/**
 * POST /api/execution/execute
 * Execute a plan (either uploaded or provided inline)
 */
router.post('/execute', upload.single('planFile'), async (req: Request, res: Response) => {
  try {
    let executionData = req.body;
    
    // If a file was uploaded, use its path
    if (req.file) {
      executionData.planPath = req.file.path;
    }
    
    // Validate request
    const validatedData = executeSchema.parse(executionData);
    
    if (!validatedData.planPath && !validatedData.plan) {
      return res.status(400).json({
        success: false,
        error: 'Either planPath or plan must be provided'
      });
    }
    
    logger.info('Starting plan execution', { mode: validatedData.mode });
    
    // Start execution
    const result = await executionService.executePlan(validatedData);
    
    res.json({
      success: true,
      executionId: result.executionId,
      status: result.status,
      completedNodes: result.completedNodes.length,
      duration: result.duration
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    logger.error('Execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute plan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/execution/status/:executionId
 * Get the status of an execution
 */
router.get('/status/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;
  
  // Implementation would track execution status
  res.json({
    executionId,
    status: 'running', // or 'completed', 'failed', 'paused'
    activeNodes: [],
    completedNodes: [],
    progress: 0.5
  });
});

/**
 * POST /api/execution/pause/:executionId
 * Pause an active execution
 */
router.post('/pause/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;
  
  const paused = executionService.pauseExecution(executionId);
  
  res.json({
    success: paused,
    executionId,
    message: paused ? 'Execution paused' : 'Execution not found'
  });
});

/**
 * POST /api/execution/resume/:executionId
 * Resume a paused execution
 */
router.post('/resume/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;
  
  const resumed = executionService.resumeExecution(executionId);
  
  res.json({
    success: resumed,
    executionId,
    message: resumed ? 'Execution resumed' : 'Execution not found or not paused'
  });
});

/**
 * POST /api/execution/cancel/:executionId
 * Cancel an active execution
 */
router.post('/cancel/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;
  
  const cancelled = executionService.cancelExecution(executionId);
  
  res.json({
    success: cancelled,
    executionId,
    message: cancelled ? 'Execution cancelled' : 'Execution not found'
  });
});

/**
 * GET /api/execution/nodes/:executionId
 * Get detailed node execution information
 */
router.get('/nodes/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;
  
  // Implementation would return detailed node execution data
  res.json({
    executionId,
    nodes: [],
    totalNodes: 0,
    completedNodes: 0,
    failedNodes: 0
  });
});

/**
 * GET /api/execution/logs/:executionId/:nodeId
 * Get logs/messages for a specific node execution
 */
router.get('/logs/:executionId/:nodeId', async (req: Request, res: Response) => {
  const { executionId, nodeId } = req.params;
  
  // Implementation would return Claude messages for the node
  res.json({
    executionId,
    nodeId,
    messages: [],
    status: 'completed'
  });
});

// Setup event listeners for real-time updates
executionService.on('node-started', (data) => {
  logger.info('Node started:', data.nodeId);
  // Forward to WebSocket clients
});

executionService.on('node-completed', (data) => {
  logger.info('Node completed:', data.nodeId);
  // Forward to WebSocket clients
});

executionService.on('node-failed', (data) => {
  logger.error('Node failed:', data.nodeId, data.error);
  // Forward to WebSocket clients
});

executionService.on('node-message', (data) => {
  // Forward Claude messages to WebSocket clients
  logger.debug('Node message:', data.nodeId);
});

executionService.on('execution-complete', (data) => {
  logger.info('Execution complete:', data.executionId);
  // Forward to WebSocket clients
});

export { router as executionRouter };