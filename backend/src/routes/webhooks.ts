import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { WebhookManager } from '../services/WebhookManager';

const router = Router();
const webhookManager = new WebhookManager();

// Validation schemas
const registerWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
  active: z.boolean().default(true)
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  active: z.boolean().optional()
});

/**
 * POST /api/webhooks/register
 * Register a new webhook endpoint
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerWebhookSchema.parse(req.body);
    
    const webhook = await webhookManager.register(validatedData);
    
    res.json({
      success: true,
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.events
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    logger.error('Webhook registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register webhook'
    });
  }
});

/**
 * GET /api/webhooks
 * List all registered webhooks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookManager.list();
    
    res.json({
      success: true,
      webhooks,
      count: webhooks.length
    });
    
  } catch (error) {
    logger.error('Failed to list webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list webhooks'
    });
  }
});

/**
 * GET /api/webhooks/:webhookId
 * Get details of a specific webhook
 */
router.get('/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const webhook = await webhookManager.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    res.json({
      success: true,
      webhook
    });
    
  } catch (error) {
    logger.error('Failed to get webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook'
    });
  }
});

/**
 * PUT /api/webhooks/:webhookId
 * Update a webhook configuration
 */
router.put('/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const validatedData = updateWebhookSchema.parse(req.body);
    
    const webhook = await webhookManager.update(webhookId, validatedData);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    res.json({
      success: true,
      webhook
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    logger.error('Webhook update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update webhook'
    });
  }
});

/**
 * DELETE /api/webhooks/:webhookId
 * Delete a webhook
 */
router.delete('/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const deleted = await webhookManager.delete(webhookId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
    
  } catch (error) {
    logger.error('Webhook deletion failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete webhook'
    });
  }
});

/**
 * POST /api/webhooks/test/:webhookId
 * Test a webhook by sending a test payload
 */
router.post('/test/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    
    const result = await webhookManager.test(webhookId);
    
    res.json({
      success: result.success,
      statusCode: result.statusCode,
      response: result.response,
      error: result.error
    });
    
  } catch (error) {
    logger.error('Webhook test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test webhook'
    });
  }
});

/**
 * GET /api/webhooks/events
 * Get list of available webhook events
 */
router.get('/events/list', async (req: Request, res: Response) => {
  res.json({
    success: true,
    events: [
      'plan.started',
      'plan.completed',
      'plan.failed',
      'execution.started',
      'execution.completed',
      'execution.failed',
      'execution.paused',
      'execution.resumed',
      'node.started',
      'node.completed',
      'node.failed',
      'node.message',
      'test.started',
      'test.completed',
      'test.failed'
    ]
  });
});

export { router as webhookRouter };