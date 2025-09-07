import { Pool } from 'pg';
import { logger } from '../utils/logger';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      // Create tables if they don't exist
      await this.createTables();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables() {
    // Plans table
    await this.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) UNIQUE NOT NULL,
        prompt TEXT NOT NULL,
        plan_data JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        output_dir TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Executions table
    await this.query(`
      CREATE TABLE IF NOT EXISTS executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id VARCHAR(255) UNIQUE NOT NULL,
        plan_id UUID REFERENCES plans(id),
        status VARCHAR(50) DEFAULT 'running',
        mode VARCHAR(50),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        execution_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Node executions table
    await this.query(`
      CREATE TABLE IF NOT EXISTS node_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID REFERENCES executions(id),
        node_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        messages JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(execution_id, node_id)
      )
    `);

    // Webhooks table
    await this.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        events TEXT[] NOT NULL,
        secret VARCHAR(255),
        active BOOLEAN DEFAULT true,
        failure_count INTEGER DEFAULT 0,
        last_triggered TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.query(`CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id)`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_executions_execution_id ON executions(execution_id)`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_node_executions_execution_id ON node_executions(execution_id)`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active)`);
  }

  // Plan methods
  async savePlan(sessionId: string, prompt: string, planData: any, outputDir: string) {
    const result = await this.query(
      `INSERT INTO plans (session_id, prompt, plan_data, output_dir) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [sessionId, prompt, planData, outputDir]
    );
    return result.rows[0];
  }

  async getPlan(sessionId: string) {
    const result = await this.query(
      'SELECT * FROM plans WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0];
  }

  // Execution methods
  async saveExecution(executionId: string, planId: string, mode: string, executionData?: any) {
    const result = await this.query(
      `INSERT INTO executions (execution_id, plan_id, mode, execution_data) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [executionId, planId, mode, executionData]
    );
    return result.rows[0];
  }

  async updateExecutionStatus(executionId: string, status: string) {
    const result = await this.query(
      `UPDATE executions 
       SET status = $1, 
           completed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE execution_id = $2 
       RETURNING *`,
      [status, executionId]
    );
    return result.rows[0];
  }

  async getExecution(executionId: string) {
    const result = await this.query(
      'SELECT * FROM executions WHERE execution_id = $1',
      [executionId]
    );
    return result.rows[0];
  }

  // Node execution methods
  async saveNodeExecution(executionId: string, nodeId: string, status: string = 'pending') {
    const result = await this.query(
      `INSERT INTO node_executions (execution_id, node_id, status) 
       VALUES ((SELECT id FROM executions WHERE execution_id = $1), $2, $3) 
       ON CONFLICT (execution_id, node_id) 
       DO UPDATE SET status = $3
       RETURNING *`,
      [executionId, nodeId, status]
    );
    return result.rows[0];
  }

  async updateNodeExecution(executionId: string, nodeId: string, updates: any) {
    const { status, messages, error } = updates;
    const result = await this.query(
      `UPDATE node_executions 
       SET status = COALESCE($3, status),
           messages = COALESCE($4, messages),
           error = COALESCE($5, error),
           started_at = CASE WHEN $3 = 'running' THEN CURRENT_TIMESTAMP ELSE started_at END,
           completed_at = CASE WHEN $3 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE execution_id = (SELECT id FROM executions WHERE execution_id = $1) 
       AND node_id = $2
       RETURNING *`,
      [executionId, nodeId, status, messages, error]
    );
    return result.rows[0];
  }

  // Webhook methods
  async saveWebhook(webhook: any) {
    const { url, events, secret, active } = webhook;
    const result = await this.query(
      `INSERT INTO webhooks (url, events, secret, active) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [url, events, secret, active]
    );
    return result.rows[0];
  }

  async getWebhooks(activeOnly: boolean = false) {
    const query = activeOnly 
      ? 'SELECT * FROM webhooks WHERE active = true ORDER BY created_at DESC'
      : 'SELECT * FROM webhooks ORDER BY created_at DESC';
    const result = await this.query(query);
    return result.rows;
  }

  async updateWebhook(id: string, updates: any) {
    const { url, events, secret, active } = updates;
    const result = await this.query(
      `UPDATE webhooks 
       SET url = COALESCE($2, url),
           events = COALESCE($3, events),
           secret = COALESCE($4, secret),
           active = COALESCE($5, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, url, events, secret, active]
    );
    return result.rows[0];
  }

  async deleteWebhook(id: string) {
    const result = await this.query(
      'DELETE FROM webhooks WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  async cleanup() {
    await this.pool.end();
  }
}