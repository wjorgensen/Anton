import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

export class WebhookManager extends EventEmitter {
  private db: DatabaseService;
  private eventSubscriptions: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.loadWebhooks();
  }

  async register(config: {
    url: string;
    events: string[];
    secret?: string;
    active?: boolean;
  }): Promise<Webhook> {
    const webhook = await this.db.saveWebhook({
      url: config.url,
      events: config.events,
      secret: config.secret,
      active: config.active !== false
    });
    
    // Subscribe to events
    for (const event of webhook.events) {
      if (!this.eventSubscriptions.has(event)) {
        this.eventSubscriptions.set(event, new Set());
      }
      this.eventSubscriptions.get(event)!.add(webhook.id);
    }

    logger.info(`Webhook registered: ${webhook.id} for events: ${webhook.events.join(', ')}`);
    
    return webhook;
  }

  async update(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = await this.db.updateWebhook(id, updates);
    if (!webhook) {
      return null;
    }

    // Update event subscriptions if events changed
    if (updates.events) {
      // Remove old subscriptions
      for (const [event, webhookIds] of this.eventSubscriptions) {
        webhookIds.delete(id);
      }
      
      // Add new subscriptions
      for (const event of updates.events) {
        if (!this.eventSubscriptions.has(event)) {
          this.eventSubscriptions.set(event, new Set());
        }
        this.eventSubscriptions.get(event)!.add(id);
      }
    }

    return webhook;
  }

  async delete(id: string): Promise<boolean> {
    const webhook = await this.db.deleteWebhook(id);
    if (!webhook) {
      return false;
    }

    // Remove from event subscriptions
    for (const [event, webhookIds] of this.eventSubscriptions) {
      webhookIds.delete(id);
    }
    
    logger.info(`Webhook deleted: ${id}`);
    return true;
  }

  async list(): Promise<Webhook[]> {
    return await this.db.getWebhooks();
  }

  async get(id: string): Promise<Webhook | null> {
    const webhooks = await this.db.getWebhooks();
    return webhooks.find(w => w.id === id) || null;
  }

  async trigger(event: string, data: any) {
    const webhookIds = this.eventSubscriptions.get(event);
    if (!webhookIds || webhookIds.size === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    const webhooks = await this.db.getWebhooks(true); // Get only active webhooks
    
    for (const webhookId of webhookIds) {
      const webhook = webhooks.find(w => w.id === webhookId);
      if (webhook && webhook.active) {
        this.sendWebhook(webhook, payload).catch(async error => {
          logger.error(`Failed to send webhook ${webhookId}:`, error);
          webhook.failureCount++;
          
          // Disable webhook after too many failures
          if (webhook.failureCount > 5) {
            await this.db.updateWebhook(webhookId, { active: false });
            logger.warn(`Webhook ${webhookId} disabled after ${webhook.failureCount} failures`);
          }
        });
      }
    }
  }

  private async sendWebhook(webhook: Webhook, payload: WebhookPayload) {
    const body = JSON.stringify(payload);
    
    const headers: any = {
      'Content-Type': 'application/json',
      'X-Anton-Event': payload.event,
      'X-Anton-Timestamp': payload.timestamp
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = this.generateSignature(body, webhook.secret);
      headers['X-Anton-Signature'] = signature;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }

    webhook.lastTriggered = new Date();
    webhook.failureCount = 0; // Reset on success
    
    logger.debug(`Webhook sent successfully: ${webhook.id} for event ${payload.event}`);
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  async test(id: string): Promise<{
    success: boolean;
    statusCode?: number;
    response?: string;
    error?: string;
  }> {
    const webhook = await this.get(id);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testPayload: WebhookPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Anton',
        webhookId: id
      }
    };

    try {
      await this.sendWebhook(webhook, testPayload);
      return { success: true, statusCode: 200 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async loadWebhooks() {
    try {
      const webhooks = await this.db.getWebhooks();
      
      // Rebuild event subscriptions
      for (const webhook of webhooks) {
        for (const event of webhook.events) {
          if (!this.eventSubscriptions.has(event)) {
            this.eventSubscriptions.set(event, new Set());
          }
          this.eventSubscriptions.get(event)!.add(webhook.id);
        }
      }
      
      logger.info(`WebhookManager initialized with ${webhooks.length} webhooks`);
    } catch (error) {
      logger.warn('Failed to load webhooks from database:', error);
    }
  }

  // Setup event forwarding from other services
  setupEventForwarding(planningService: any, executionService: any) {
    // Forward planning events
    planningService.on('planning-started', (data: any) => {
      this.trigger('plan.started', data);
    });
    
    planningService.on('planning-step', (data: any) => {
      this.trigger('plan.step', data);
    });
    
    planningService.on('planning-completed', (data: any) => {
      this.trigger('plan.completed', data);
    });
    
    planningService.on('planning-failed', (data: any) => {
      this.trigger('plan.failed', data);
    });

    // Forward execution events
    executionService.on('execution-started', (data: any) => {
      this.trigger('execution.started', data);
    });
    
    executionService.on('execution-complete', (data: any) => {
      this.trigger('execution.completed', data);
    });
    
    executionService.on('node-started', (data: any) => {
      this.trigger('node.started', data);
    });
    
    executionService.on('node-completed', (data: any) => {
      this.trigger('node.completed', data);
    });
    
    executionService.on('node-failed', (data: any) => {
      this.trigger('node.failed', data);
    });
  }
}