import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReviewRequest {
  nodeId: string;
  flowId: string;
  reviewScope: 'full' | 'changes' | 'specific';
  files?: string[];
  criteria?: string[];
  timeout?: number;
  requiresApproval: boolean;
  metadata?: Record<string, any>;
}

export interface ReviewFeedback {
  id: string;
  nodeId: string;
  reviewerId: string;
  decision: 'approve' | 'reject' | 'request-changes';
  comments: string;
  actionItems?: string[];
  timestamp: Date;
  severity?: 'info' | 'warning' | 'error';
}

export interface ReviewResult {
  nodeId: string;
  status: 'approved' | 'rejected' | 'changes-requested' | 'timeout';
  feedback: ReviewFeedback[];
  finalDecision?: 'continue' | 'retry' | 'abort';
  modifiedInstructions?: string;
  retryContext?: Record<string, any>;
}

export class ReviewService extends EventEmitter {
  private activeReviews: Map<string, ReviewRequest> = new Map();
  private reviewHistory: Map<string, ReviewResult[]> = new Map();
  private pendingFeedback: Map<string, ReviewFeedback[]> = new Map();
  private reviewTimers: Map<string, NodeJS.Timeout> = new Map();

  async requestReview(request: ReviewRequest): Promise<ReviewResult> {
    this.activeReviews.set(request.nodeId, request);
    this.pendingFeedback.set(request.nodeId, []);
    
    // Emit review request for UI to handle
    this.emit('review:requested', {
      nodeId: request.nodeId,
      flowId: request.flowId,
      scope: request.reviewScope,
      files: request.files,
      criteria: request.criteria,
      requiresApproval: request.requiresApproval,
      metadata: request.metadata
    });

    // Set timeout if specified
    if (request.timeout) {
      const timer = setTimeout(() => {
        this.handleTimeout(request.nodeId);
      }, request.timeout * 60 * 1000);
      this.reviewTimers.set(request.nodeId, timer);
    }

    // Wait for review completion
    return new Promise((resolve) => {
      this.once(`review:${request.nodeId}:complete`, (result: ReviewResult) => {
        // Clear timeout if exists
        const timer = this.reviewTimers.get(request.nodeId);
        if (timer) {
          clearTimeout(timer);
          this.reviewTimers.delete(request.nodeId);
        }
        
        // Store in history
        const history = this.reviewHistory.get(request.nodeId) || [];
        history.push(result);
        this.reviewHistory.set(request.nodeId, history);
        
        // Clean up
        this.activeReviews.delete(request.nodeId);
        this.pendingFeedback.delete(request.nodeId);
        
        resolve(result);
      });
    });
  }

  async submitFeedback(feedback: ReviewFeedback): Promise<void> {
    const request = this.activeReviews.get(feedback.nodeId);
    if (!request) {
      throw new Error(`No active review for node ${feedback.nodeId}`);
    }

    // Store feedback
    const feedbackList = this.pendingFeedback.get(feedback.nodeId) || [];
    feedbackList.push(feedback);
    this.pendingFeedback.set(feedback.nodeId, feedbackList);

    // Emit feedback event for real-time updates
    this.emit('review:feedback', feedback);

    // Check if we can complete the review
    if (this.canCompleteReview(feedback.nodeId)) {
      await this.completeReview(feedback.nodeId);
    }
  }

  private canCompleteReview(nodeId: string): boolean {
    const request = this.activeReviews.get(nodeId);
    const feedback = this.pendingFeedback.get(nodeId) || [];
    
    if (!request || feedback.length === 0) return false;
    
    // Check if we have enough approvals/rejections based on requirements
    const approvals = feedback.filter(f => f.decision === 'approve').length;
    const rejections = feedback.filter(f => f.decision === 'reject').length;
    const changeRequests = feedback.filter(f => f.decision === 'request-changes').length;
    
    // If any rejection, we can complete
    if (rejections > 0) return true;
    
    // If changes requested, we can complete
    if (changeRequests > 0) return true;
    
    // If approval received and not requiring multiple approvals
    if (approvals > 0 && !request.metadata?.requireMultipleApprovals) return true;
    
    // Check for multiple approvals requirement
    if (request.metadata?.requiredApprovals) {
      return approvals >= request.metadata.requiredApprovals;
    }
    
    return false;
  }

  private async completeReview(nodeId: string): Promise<void> {
    const feedback = this.pendingFeedback.get(nodeId) || [];
    const request = this.activeReviews.get(nodeId);
    
    if (!request) return;
    
    // Determine final status
    let status: ReviewResult['status'] = 'approved';
    let finalDecision: ReviewResult['finalDecision'] = 'continue';
    let modifiedInstructions: string | undefined;
    let retryContext: Record<string, any> | undefined;
    
    const hasRejection = feedback.some(f => f.decision === 'reject');
    const hasChangeRequest = feedback.some(f => f.decision === 'request-changes');
    
    if (hasRejection) {
      status = 'rejected';
      finalDecision = 'abort';
    } else if (hasChangeRequest) {
      status = 'changes-requested';
      finalDecision = 'retry';
      
      // Compile action items and feedback into retry context
      const actionItems = feedback
        .filter(f => f.actionItems && f.actionItems.length > 0)
        .flatMap(f => f.actionItems!);
      
      const comments = feedback
        .filter(f => f.comments)
        .map(f => f.comments);
      
      retryContext = {
        previousFeedback: comments,
        actionItems,
        reviewerSuggestions: this.extractSuggestions(feedback)
      };
      
      modifiedInstructions = this.generateModifiedInstructions(feedback);
    }
    
    const result: ReviewResult = {
      nodeId,
      status,
      feedback,
      finalDecision,
      modifiedInstructions,
      retryContext
    };
    
    this.emit(`review:${nodeId}:complete`, result);
  }

  private handleTimeout(nodeId: string): void {
    const request = this.activeReviews.get(nodeId);
    if (!request) return;
    
    const feedback = this.pendingFeedback.get(nodeId) || [];
    
    // Auto-approve if no feedback and not requiring approval
    let status: ReviewResult['status'] = 'timeout';
    let finalDecision: ReviewResult['finalDecision'] = 'continue';
    
    if (!request.requiresApproval) {
      status = 'approved';
      finalDecision = 'continue';
    } else {
      // If approval required but timed out, abort
      finalDecision = 'abort';
    }
    
    const result: ReviewResult = {
      nodeId,
      status,
      feedback,
      finalDecision
    };
    
    this.emit(`review:${nodeId}:complete`, result);
  }

  private extractSuggestions(feedback: ReviewFeedback[]): string[] {
    const suggestions: string[] = [];
    
    for (const item of feedback) {
      // Extract suggestions from comments using simple patterns
      const suggestionPatterns = [
        /suggest(?:ion)?:?\s*(.+)/gi,
        /should\s+(.+)/gi,
        /could\s+(.+)/gi,
        /try\s+(.+)/gi,
        /consider\s+(.+)/gi
      ];
      
      for (const pattern of suggestionPatterns) {
        const matches = item.comments.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            suggestions.push(match[1].trim());
          }
        }
      }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  private generateModifiedInstructions(feedback: ReviewFeedback[]): string {
    const actionItems = feedback
      .filter(f => f.actionItems && f.actionItems.length > 0)
      .flatMap(f => f.actionItems!);
    
    const criticalFeedback = feedback
      .filter(f => f.severity === 'error')
      .map(f => f.comments);
    
    let instructions = "Based on the review feedback, please address the following:\n\n";
    
    if (criticalFeedback.length > 0) {
      instructions += "CRITICAL ISSUES TO FIX:\n";
      criticalFeedback.forEach((comment, i) => {
        instructions += `${i + 1}. ${comment}\n`;
      });
      instructions += "\n";
    }
    
    if (actionItems.length > 0) {
      instructions += "ACTION ITEMS:\n";
      actionItems.forEach((item, i) => {
        instructions += `${i + 1}. ${item}\n`;
      });
      instructions += "\n";
    }
    
    const suggestions = this.extractSuggestions(feedback);
    if (suggestions.length > 0) {
      instructions += "SUGGESTIONS TO CONSIDER:\n";
      suggestions.forEach((suggestion, i) => {
        instructions += `${i + 1}. ${suggestion}\n`;
      });
    }
    
    return instructions;
  }

  async getReviewHistory(nodeId: string): Promise<ReviewResult[]> {
    return this.reviewHistory.get(nodeId) || [];
  }

  async saveReviewHistory(flowId: string, outputDir: string): Promise<void> {
    const history: Record<string, ReviewResult[]> = {};
    
    this.reviewHistory.forEach((results, nodeId) => {
      history[nodeId] = results;
    });
    
    const historyPath = path.join(outputDir, `review-history-${flowId}.json`);
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  }

  getActiveReviews(): ReviewRequest[] {
    return Array.from(this.activeReviews.values());
  }

  cancelReview(nodeId: string): void {
    const timer = this.reviewTimers.get(nodeId);
    if (timer) {
      clearTimeout(timer);
      this.reviewTimers.delete(nodeId);
    }
    
    this.activeReviews.delete(nodeId);
    this.pendingFeedback.delete(nodeId);
    
    this.emit('review:cancelled', { nodeId });
  }
}