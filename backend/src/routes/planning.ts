import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PlanningService } from '../services/PlanningService';
import { logger } from '../utils/logger';

const router = Router();
const planningService = new PlanningService();

// Validation schema for plan generation
const generatePlanSchema = z.object({
  prompt: z.string().min(1).max(10000),
  runFixer: z.boolean().optional().default(true),
  config: z.object({
    maxParallelization: z.boolean().optional(),
    includeTests: z.boolean().optional(),
    includeDocs: z.boolean().optional()
  }).optional()
});

/**
 * POST /api/planning/generate-plan
 * Generate a new execution plan based on the provided prompt
 */
router.post('/generate-plan', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = generatePlanSchema.parse(req.body);
    
    logger.info('Generating plan', { prompt: validatedData.prompt.substring(0, 100) });
    
    // Generate plan
    const result = await planningService.generatePlan(validatedData);
    
    res.json({
      success: true,
      sessionId: result.sessionId,
      plan: result.plan,
      outputDir: result.outputDir,
      messageCount: result.messages.length,
      projectName: result.projectName
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    logger.error('Plan generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate plan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/planning/status/:sessionId
 * Get the status of a plan generation session
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  // Implementation would track active planning sessions
  res.json({
    sessionId,
    status: 'completed', // or 'running', 'failed'
    message: 'Plan generation status'
  });
});

/**
 * POST /api/planning/cancel/:sessionId
 * Cancel an active plan generation session
 */
router.post('/cancel/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const cancelled = planningService.cancelPlan(sessionId);
  
  res.json({
    success: cancelled,
    sessionId,
    message: cancelled ? 'Plan generation cancelled' : 'Session not found'
  });
});

/**
 * POST /api/planning/validate
 * Validate a plan structure without generating
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    
    // Basic plan structure validation
    if (!plan || !plan.nodes || !plan.executionFlow) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan structure'
      });
    }
    
    // Check for duplicate nodes, invalid dependencies, etc.
    const nodeIds = new Set(plan.nodes.map((n: any) => n.id));
    const issues = [];
    
    // Check for duplicate node IDs
    if (nodeIds.size !== plan.nodes.length) {
      issues.push('Duplicate node IDs found');
    }
    
    // Check dependencies reference valid nodes
    for (const node of plan.nodes) {
      for (const dep of node.dependencies || []) {
        if (!nodeIds.has(dep)) {
          issues.push(`Invalid dependency ${dep} in node ${node.id}`);
        }
      }
    }
    
    res.json({
      success: issues.length === 0,
      issues,
      nodeCount: plan.nodes.length
    });
    
  } catch (error) {
    logger.error('Plan validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate plan'
    });
  }
});

// Setup event listeners for real-time updates
planningService.on('planning-message', (data) => {
  // Forward to WebSocket clients
  logger.debug('Planning message:', data);
});

planningService.on('fixer-message', (data) => {
  // Forward to WebSocket clients
  logger.debug('Fixer message:', data);
});

export { router as planningRouter };