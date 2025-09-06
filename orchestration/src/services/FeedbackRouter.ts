import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FeedbackRoute {
  nodeId: string;
  targetNodeId?: string;
  feedbackType: 'review' | 'error' | 'suggestion' | 'correction';
  priority: 'high' | 'medium' | 'low';
  data: any;
}

export interface ProcessedFeedback {
  id: string;
  originalNodeId: string;
  targetNodeId: string;
  instructions: string;
  context: Record<string, any>;
  timestamp: Date;
  applied: boolean;
}

export class FeedbackRouter extends EventEmitter {
  private routes: Map<string, FeedbackRoute[]> = new Map();
  private processedFeedback: Map<string, ProcessedFeedback[]> = new Map();
  private feedbackQueue: FeedbackRoute[] = [];
  private processing: boolean = false;

  /**
   * Route feedback to appropriate handler or node
   */
  async routeFeedback(feedback: any, nodeId: string): Promise<void> {
    const route: FeedbackRoute = {
      nodeId,
      feedbackType: this.determineFeedbackType(feedback),
      priority: this.determinePriority(feedback),
      data: feedback
    };

    // Determine target node based on feedback
    route.targetNodeId = await this.determineTargetNode(feedback, nodeId);

    // Add to routing table
    const nodeRoutes = this.routes.get(nodeId) || [];
    nodeRoutes.push(route);
    this.routes.set(nodeId, nodeRoutes);

    // Queue for processing
    this.feedbackQueue.push(route);
    
    // Emit event for immediate handling
    this.emit('feedback:routed', route);

    // Process queue if not already processing
    if (!this.processing) {
      await this.processFeedbackQueue();
    }
  }

  /**
   * Process queued feedback
   */
  private async processFeedbackQueue(): Promise<void> {
    this.processing = true;

    while (this.feedbackQueue.length > 0) {
      // Sort by priority
      this.feedbackQueue.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      const route = this.feedbackQueue.shift()!;
      
      try {
        await this.processFeedbackRoute(route);
      } catch (error) {
        console.error('Error processing feedback route:', error);
        this.emit('feedback:error', { route, error });
      }
    }

    this.processing = false;
  }

  /**
   * Process individual feedback route
   */
  private async processFeedbackRoute(route: FeedbackRoute): Promise<void> {
    const { nodeId, targetNodeId, feedbackType, data } = route;

    // Create processed feedback record
    const processed: ProcessedFeedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalNodeId: nodeId,
      targetNodeId: targetNodeId || nodeId,
      instructions: '',
      context: {},
      timestamp: new Date(),
      applied: false
    };

    // Process based on feedback type
    switch (feedbackType) {
      case 'review':
        processed.instructions = this.generateReviewInstructions(data);
        processed.context = {
          reviewDecision: data.decision,
          reviewComments: data.comments,
          actionItems: data.actionItems
        };
        break;

      case 'error':
        processed.instructions = this.generateErrorFixInstructions(data);
        processed.context = {
          errorType: data.errorType,
          errorMessage: data.message,
          stackTrace: data.stackTrace,
          suggestedFix: data.suggestedFix
        };
        break;

      case 'suggestion':
        processed.instructions = this.generateSuggestionInstructions(data);
        processed.context = {
          suggestion: data.suggestion,
          rationale: data.rationale
        };
        break;

      case 'correction':
        processed.instructions = this.generateCorrectionInstructions(data);
        processed.context = {
          original: data.original,
          corrected: data.corrected,
          files: data.files
        };
        break;
    }

    // Store processed feedback
    const targetFeedback = this.processedFeedback.get(targetNodeId || nodeId) || [];
    targetFeedback.push(processed);
    this.processedFeedback.set(targetNodeId || nodeId, targetFeedback);

    // Emit for application
    this.emit('feedback:processed', processed);

    // If target node is different, route to that node
    if (targetNodeId && targetNodeId !== nodeId) {
      this.emit('feedback:forward', {
        fromNode: nodeId,
        toNode: targetNodeId,
        feedback: processed
      });
    }
  }

  /**
   * Determine feedback type from content
   */
  private determineFeedbackType(feedback: any): FeedbackRoute['feedbackType'] {
    if (feedback.decision) return 'review';
    if (feedback.errorType || feedback.error) return 'error';
    if (feedback.suggestion || feedback.recommendations) return 'suggestion';
    if (feedback.correction || feedback.fix) return 'correction';
    return 'suggestion'; // Default
  }

  /**
   * Determine priority based on feedback content
   */
  private determinePriority(feedback: any): FeedbackRoute['priority'] {
    // High priority for rejections and errors
    if (feedback.decision === 'reject' || feedback.severity === 'error') {
      return 'high';
    }
    
    // Medium priority for change requests
    if (feedback.decision === 'request-changes' || feedback.severity === 'warning') {
      return 'medium';
    }
    
    // Low priority for approvals and info
    return 'low';
  }

  /**
   * Determine which node should handle the feedback
   */
  private async determineTargetNode(feedback: any, currentNodeId: string): Promise<string | undefined> {
    // If feedback contains explicit target
    if (feedback.targetNodeId) {
      return feedback.targetNodeId;
    }

    // If feedback is about specific files, find the node that created them
    if (feedback.files && feedback.files.length > 0) {
      // This would require flow analysis to determine which node created which files
      // For now, return current node
      return currentNodeId;
    }

    // If feedback is an error, might need to route to a testing node
    if (feedback.errorType === 'test-failure') {
      // Would need flow information to find testing nodes
      return undefined; // Will be handled by current node
    }

    // Default to current node
    return currentNodeId;
  }

  /**
   * Generate instructions for review feedback
   */
  private generateReviewInstructions(feedback: any): string {
    let instructions = '## Review Feedback Received\n\n';
    
    instructions += `Decision: **${feedback.decision}**\n\n`;
    
    if (feedback.comments) {
      instructions += `### Reviewer Comments\n${feedback.comments}\n\n`;
    }
    
    if (feedback.actionItems && feedback.actionItems.length > 0) {
      instructions += `### Action Items to Address\n`;
      feedback.actionItems.forEach((item: string, index: number) => {
        instructions += `${index + 1}. ${item}\n`;
      });
      instructions += '\n';
    }
    
    if (feedback.decision === 'request-changes') {
      instructions += `### Instructions\n`;
      instructions += `Please address the action items and feedback above. `;
      instructions += `Focus on the specific issues raised by the reviewer. `;
      instructions += `Once complete, the changes will be submitted for re-review.\n`;
    }
    
    return instructions;
  }

  /**
   * Generate instructions for error fixes
   */
  private generateErrorFixInstructions(error: any): string {
    let instructions = '## Error Fix Required\n\n';
    
    instructions += `### Error Details\n`;
    instructions += `- Type: ${error.errorType || 'Unknown'}\n`;
    instructions += `- Message: ${error.message}\n`;
    
    if (error.file) {
      instructions += `- File: ${error.file}\n`;
      if (error.line) {
        instructions += `- Line: ${error.line}\n`;
      }
    }
    
    instructions += `\n### Instructions\n`;
    instructions += `1. Analyze the error message and stack trace\n`;
    instructions += `2. Identify the root cause of the issue\n`;
    instructions += `3. Implement a fix that addresses the error\n`;
    instructions += `4. Verify the fix resolves the issue\n`;
    
    if (error.suggestedFix) {
      instructions += `\n### Suggested Fix\n${error.suggestedFix}\n`;
    }
    
    return instructions;
  }

  /**
   * Generate instructions for suggestions
   */
  private generateSuggestionInstructions(suggestion: any): string {
    let instructions = '## Suggestion for Improvement\n\n';
    
    instructions += `### Suggestion\n${suggestion.suggestion || suggestion.text}\n\n`;
    
    if (suggestion.rationale) {
      instructions += `### Rationale\n${suggestion.rationale}\n\n`;
    }
    
    instructions += `### Instructions\n`;
    instructions += `Consider implementing this suggestion if it improves the code quality, `;
    instructions += `performance, or maintainability. This is optional but recommended.\n`;
    
    return instructions;
  }

  /**
   * Generate instructions for corrections
   */
  private generateCorrectionInstructions(correction: any): string {
    let instructions = '## Correction Required\n\n';
    
    if (correction.files && correction.files.length > 0) {
      instructions += `### Files to Correct\n`;
      correction.files.forEach((file: string) => {
        instructions += `- ${file}\n`;
      });
      instructions += '\n';
    }
    
    if (correction.original) {
      instructions += `### Original (Incorrect)\n\`\`\`\n${correction.original}\n\`\`\`\n\n`;
    }
    
    if (correction.corrected) {
      instructions += `### Corrected Version\n\`\`\`\n${correction.corrected}\n\`\`\`\n\n`;
    }
    
    instructions += `### Instructions\n`;
    instructions += `Replace the incorrect implementation with the corrected version. `;
    instructions += `Ensure all references and dependencies are updated accordingly.\n`;
    
    return instructions;
  }

  /**
   * Get all feedback for a specific node
   */
  async getNodeFeedback(nodeId: string): Promise<ProcessedFeedback[]> {
    return this.processedFeedback.get(nodeId) || [];
  }

  /**
   * Mark feedback as applied
   */
  async markFeedbackApplied(feedbackId: string, nodeId: string): Promise<void> {
    const nodeFeedback = this.processedFeedback.get(nodeId);
    if (!nodeFeedback) return;

    const feedback = nodeFeedback.find(f => f.id === feedbackId);
    if (feedback) {
      feedback.applied = true;
      this.emit('feedback:applied', { feedbackId, nodeId });
    }
  }

  /**
   * Export feedback history to file
   */
  async exportFeedbackHistory(flowId: string, outputPath: string): Promise<void> {
    const history: Record<string, any> = {
      flowId,
      exportDate: new Date(),
      routes: Array.from(this.routes.entries()).map(([nodeId, routes]) => ({
        nodeId,
        routes
      })),
      processedFeedback: Array.from(this.processedFeedback.entries()).map(([nodeId, feedback]) => ({
        nodeId,
        feedback
      }))
    };

    await fs.writeFile(
      path.join(outputPath, `feedback-history-${flowId}.json`),
      JSON.stringify(history, null, 2)
    );
  }

  /**
   * Clear all feedback data
   */
  clearFeedback(): void {
    this.routes.clear();
    this.processedFeedback.clear();
    this.feedbackQueue = [];
    this.processing = false;
  }
}