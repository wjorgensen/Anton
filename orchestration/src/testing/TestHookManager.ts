import { EventEmitter } from 'events';
import { TestResult, TestFailure, TestSuite, IndividualTest } from './TestParser';
import { ErrorAnalysis } from './ErrorAnalyzer';
import { RetryContext } from './SmartRetryManager';
import * as WebSocket from 'ws';

export interface TestHookEvent {
  type: TestEventType;
  timestamp: Date;
  nodeId: string;
  flowId: string;
  data: any;
}

export enum TestEventType {
  // Test lifecycle events
  TEST_START = 'test:start',
  TEST_COMPLETE = 'test:complete',
  TEST_FAILED = 'test:failed',
  TEST_RETRY = 'test:retry',
  TEST_SKIP = 'test:skip',
  
  // Suite events
  SUITE_START = 'suite:start',
  SUITE_COMPLETE = 'suite:complete',
  SUITE_FAILED = 'suite:failed',
  
  // Individual test events
  CASE_START = 'case:start',
  CASE_PASS = 'case:pass',
  CASE_FAIL = 'case:fail',
  CASE_SKIP = 'case:skip',
  
  // Analysis events
  ERROR_ANALYZED = 'error:analyzed',
  SUGGESTION_GENERATED = 'suggestion:generated',
  PATTERN_DETECTED = 'pattern:detected',
  
  // Retry events
  RETRY_SCHEDULED = 'retry:scheduled',
  RETRY_STARTED = 'retry:started',
  RETRY_SUCCESS = 'retry:success',
  RETRY_FAILED = 'retry:failed',
  RETRY_EXHAUSTED = 'retry:exhausted',
  
  // Progress events
  PROGRESS_UPDATE = 'progress:update',
  COVERAGE_UPDATE = 'coverage:update',
  PERFORMANCE_WARNING = 'performance:warning'
}

export interface TestProgressData {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  skipped: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentTest?: string;
  currentSuite?: string;
}

export interface TestHookHandler {
  event: TestEventType | TestEventType[];
  handler: (event: TestHookEvent) => void | Promise<void>;
  filter?: (event: TestHookEvent) => boolean;
  priority?: number;
}

export class TestHookManager extends EventEmitter {
  private handlers: Map<TestEventType, TestHookHandler[]> = new Map();
  private eventHistory: TestHookEvent[] = [];
  private maxHistorySize: number = 1000;
  private subscribers: Map<string, TestSubscriber> = new Map();
  private websockets: Set<WebSocket> = new Set();
  private testStartTimes: Map<string, Date> = new Map();
  private progressTrackers: Map<string, TestProgressData> = new Map();

  constructor() {
    super();
    this.setupInternalHandlers();
  }

  private setupInternalHandlers(): void {
    // Track test timing
    this.registerHandler({
      event: TestEventType.TEST_START,
      handler: (event) => {
        this.testStartTimes.set(event.nodeId, event.timestamp);
        this.initializeProgress(event.nodeId, event.data);
      },
      priority: 100
    });

    // Update progress on test completion
    this.registerHandler({
      event: [TestEventType.CASE_PASS, TestEventType.CASE_FAIL, TestEventType.CASE_SKIP],
      handler: (event) => {
        this.updateProgress(event.nodeId, event.type);
      },
      priority: 100
    });

    // Clean up on test completion
    this.registerHandler({
      event: TestEventType.TEST_COMPLETE,
      handler: (event) => {
        this.testStartTimes.delete(event.nodeId);
        this.finalizeProgress(event.nodeId, event.data);
      },
      priority: 100
    });
  }

  // Handler Registration
  registerHandler(handler: TestHookHandler): void {
    const events = Array.isArray(handler.event) ? handler.event : [handler.event];
    
    for (const event of events) {
      const handlers = this.handlers.get(event) || [];
      handlers.push(handler);
      
      // Sort by priority (higher priority first)
      handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      this.handlers.set(event, handlers);
    }
  }

  unregisterHandler(event: TestEventType, handler: (event: TestHookEvent) => void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  // Event Emission
  async emitTestEvent(
    type: TestEventType,
    nodeId: string,
    flowId: string,
    data: any
  ): Promise<void> {
    const event: TestHookEvent = {
      type,
      timestamp: new Date(),
      nodeId,
      flowId,
      data
    };

    // Store in history
    this.addToHistory(event);

    // Emit to internal EventEmitter
    this.emit(type, event);

    // Process registered handlers
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      if (!handler.filter || handler.filter(event)) {
        try {
          await handler.handler(event);
        } catch (error) {
          console.error(`Error in test hook handler for ${type}:`, error);
        }
      }
    }

    // Notify subscribers
    this.notifySubscribers(event);

    // Broadcast to WebSockets
    this.broadcastToWebSockets(event);
  }

  // Real-time Streaming
  streamTestOutput(
    nodeId: string,
    flowId: string,
    output: string,
    isError: boolean = false
  ): void {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Parse for test results in real-time
      const testResult = this.parseTestLine(line);
      
      if (testResult) {
        this.emitTestEvent(
          testResult.passed ? TestEventType.CASE_PASS : TestEventType.CASE_FAIL,
          nodeId,
          flowId,
          testResult
        );
      }

      // Stream raw output to WebSockets
      this.broadcastToWebSockets({
        type: TestEventType.PROGRESS_UPDATE,
        timestamp: new Date(),
        nodeId,
        flowId,
        data: {
          output: line,
          isError
        }
      });
    }
  }

  private parseTestLine(line: string): { name: string; passed: boolean; duration?: number } | null {
    // Common test output patterns
    const patterns = [
      // Jest/Vitest
      /^[\s]*✓\s+(.+)\s+\((\d+)\s*ms\)/,
      /^[\s]*✗\s+(.+)\s+\((\d+)\s*ms\)/,
      // Mocha
      /^[\s]*√\s+(.+)\s+\((\d+)ms\)/,
      /^[\s]*\d+\)\s+(.+)/,
      // Go test
      /^---\s+(PASS|FAIL):\s+(\S+)\s+\(([^)]+)\)/,
      // Python pytest
      /^(PASSED|FAILED)\s+(.+)/,
      // Generic
      /^(PASS|FAIL|PASSED|FAILED):\s+(.+)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const isPassed = line.includes('✓') || line.includes('√') || 
                        line.includes('PASS') || line.includes('PASSED');
        
        return {
          name: match[1] || match[2],
          passed: isPassed,
          duration: match[3] ? parseFloat(match[3]) : undefined
        };
      }
    }

    return null;
  }

  // Progress Tracking
  private initializeProgress(nodeId: string, data: any): void {
    const progress: TestProgressData = {
      total: data.totalTests || 0,
      completed: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
      currentTest: undefined,
      currentSuite: undefined
    };

    this.progressTrackers.set(nodeId, progress);
  }

  private updateProgress(nodeId: string, eventType: TestEventType): void {
    const progress = this.progressTrackers.get(nodeId);
    if (!progress) return;

    progress.completed++;

    switch (eventType) {
      case TestEventType.CASE_PASS:
        progress.passed++;
        break;
      case TestEventType.CASE_FAIL:
        progress.failed++;
        break;
      case TestEventType.CASE_SKIP:
        progress.skipped++;
        break;
    }

    if (progress.total > 0) {
      progress.percentage = (progress.completed / progress.total) * 100;
    }

    // Estimate time remaining
    const startTime = this.testStartTimes.get(nodeId);
    if (startTime && progress.completed > 0) {
      const elapsedMs = Date.now() - startTime.getTime();
      const avgTimePerTest = elapsedMs / progress.completed;
      const remainingTests = progress.total - progress.completed;
      progress.estimatedTimeRemaining = avgTimePerTest * remainingTests;
    }

    // Emit progress update
    this.emitTestEvent(
      TestEventType.PROGRESS_UPDATE,
      nodeId,
      '', // flowId would need to be tracked separately
      progress
    );
  }

  private finalizeProgress(nodeId: string, result: TestResult): void {
    const progress = this.progressTrackers.get(nodeId);
    if (!progress) return;

    progress.completed = progress.total;
    progress.percentage = 100;
    progress.estimatedTimeRemaining = 0;

    // Clean up
    this.progressTrackers.delete(nodeId);
  }

  // Hook Chaining
  createHookChain(nodeId: string, flowId: string): TestHookChain {
    return new TestHookChain(this, nodeId, flowId);
  }

  // Analysis Integration
  async emitErrorAnalysis(
    nodeId: string,
    flowId: string,
    failure: TestFailure,
    analysis: ErrorAnalysis
  ): Promise<void> {
    await this.emitTestEvent(
      TestEventType.ERROR_ANALYZED,
      nodeId,
      flowId,
      { failure, analysis }
    );

    // Emit specific events for suggestions
    if (analysis.suggestions.length > 0) {
      await this.emitTestEvent(
        TestEventType.SUGGESTION_GENERATED,
        nodeId,
        flowId,
        { suggestions: analysis.suggestions }
      );
    }

    // Emit pattern detection
    if (analysis.patterns.length > 0) {
      await this.emitTestEvent(
        TestEventType.PATTERN_DETECTED,
        nodeId,
        flowId,
        { patterns: analysis.patterns }
      );
    }
  }

  // Retry Integration
  async emitRetryEvent(
    nodeId: string,
    flowId: string,
    retryContext: RetryContext,
    status: 'scheduled' | 'started' | 'success' | 'failed' | 'exhausted'
  ): Promise<void> {
    const eventMap = {
      scheduled: TestEventType.RETRY_SCHEDULED,
      started: TestEventType.RETRY_STARTED,
      success: TestEventType.RETRY_SUCCESS,
      failed: TestEventType.RETRY_FAILED,
      exhausted: TestEventType.RETRY_EXHAUSTED
    };

    await this.emitTestEvent(
      eventMap[status],
      nodeId,
      flowId,
      retryContext
    );
  }

  // WebSocket Support
  attachWebSocket(ws: WebSocket): void {
    this.websockets.add(ws);
    
    // Send current state
    const currentState = {
      type: 'connection',
      progressTrackers: Array.from(this.progressTrackers.entries()).map(([nodeId, progress]) => ({
        nodeId,
        progress
      })),
      timestamp: new Date()
    };
    
    ws.send(JSON.stringify(currentState));

    ws.on('close', () => {
      this.websockets.delete(ws);
    });

    ws.on('error', () => {
      this.websockets.delete(ws);
    });
  }

  private broadcastToWebSockets(event: TestHookEvent): void {
    const message = JSON.stringify(event);
    
    for (const ws of this.websockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  // Subscription Management
  subscribe(
    subscriberId: string,
    events: TestEventType[],
    callback: (event: TestHookEvent) => void
  ): void {
    this.subscribers.set(subscriberId, {
      events,
      callback,
      subscribed: new Date()
    });
  }

  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }

  private notifySubscribers(event: TestHookEvent): void {
    for (const [, subscriber] of this.subscribers) {
      if (subscriber.events.includes(event.type)) {
        try {
          subscriber.callback(event);
        } catch (error) {
          console.error('Error notifying subscriber:', error);
        }
      }
    }
  }

  // History Management
  private addToHistory(event: TestHookEvent): void {
    this.eventHistory.push(event);
    
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getEventHistory(
    filter?: {
      type?: TestEventType;
      nodeId?: string;
      flowId?: string;
      since?: Date;
    }
  ): TestHookEvent[] {
    if (!filter) {
      return [...this.eventHistory];
    }

    return this.eventHistory.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      if (filter.nodeId && event.nodeId !== filter.nodeId) return false;
      if (filter.flowId && event.flowId !== filter.flowId) return false;
      if (filter.since && event.timestamp < filter.since) return false;
      return true;
    });
  }

  // Statistics
  getStatistics(): {
    totalEvents: number;
    eventsByType: Record<TestEventType, number>;
    activeTests: number;
    recentEvents: TestHookEvent[];
  } {
    const eventsByType: Record<TestEventType, number> = {} as any;
    
    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      activeTests: this.testStartTimes.size,
      recentEvents: this.eventHistory.slice(-10)
    };
  }

  // Cleanup
  clear(): void {
    this.eventHistory = [];
    this.testStartTimes.clear();
    this.progressTrackers.clear();
    this.subscribers.clear();
    
    for (const ws of this.websockets) {
      ws.close();
    }
    this.websockets.clear();
  }
}

interface TestSubscriber {
  events: TestEventType[];
  callback: (event: TestHookEvent) => void;
  subscribed: Date;
}

// Hook Chain for fluent API
export class TestHookChain {
  private manager: TestHookManager;
  private nodeId: string;
  private flowId: string;
  private pendingEvents: TestHookEvent[] = [];

  constructor(manager: TestHookManager, nodeId: string, flowId: string) {
    this.manager = manager;
    this.nodeId = nodeId;
    this.flowId = flowId;
  }

  testStarted(data: any): TestHookChain {
    this.pendingEvents.push({
      type: TestEventType.TEST_START,
      timestamp: new Date(),
      nodeId: this.nodeId,
      flowId: this.flowId,
      data
    });
    return this;
  }

  testPassed(test: IndividualTest): TestHookChain {
    this.pendingEvents.push({
      type: TestEventType.CASE_PASS,
      timestamp: new Date(),
      nodeId: this.nodeId,
      flowId: this.flowId,
      data: test
    });
    return this;
  }

  testFailed(test: IndividualTest): TestHookChain {
    this.pendingEvents.push({
      type: TestEventType.CASE_FAIL,
      timestamp: new Date(),
      nodeId: this.nodeId,
      flowId: this.flowId,
      data: test
    });
    return this;
  }

  suiteCompleted(suite: TestSuite): TestHookChain {
    this.pendingEvents.push({
      type: TestEventType.SUITE_COMPLETE,
      timestamp: new Date(),
      nodeId: this.nodeId,
      flowId: this.flowId,
      data: suite
    });
    return this;
  }

  testCompleted(result: TestResult): TestHookChain {
    this.pendingEvents.push({
      type: TestEventType.TEST_COMPLETE,
      timestamp: new Date(),
      nodeId: this.nodeId,
      flowId: this.flowId,
      data: result
    });
    return this;
  }

  async emit(): Promise<void> {
    for (const event of this.pendingEvents) {
      await this.manager.emitTestEvent(
        event.type,
        event.nodeId,
        event.flowId,
        event.data
      );
    }
    this.pendingEvents = [];
  }
}