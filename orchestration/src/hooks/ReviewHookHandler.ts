import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface UserPromptHook {
  nodeId: string;
  userInput: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ReviewHookData {
  nodeId: string;
  event: 'user_prompt' | 'review_complete' | 'review_timeout';
  data: any;
}

export class ReviewHookHandler extends EventEmitter {
  private projectDir: string;
  private activeReviews: Map<string, any> = new Map();
  
  constructor(projectDir: string) {
    super();
    this.projectDir = projectDir;
  }

  /**
   * Handle UserPromptSubmit hook from Claude Code
   */
  async handleUserPromptSubmit(hookData: UserPromptHook): Promise<void> {
    const { nodeId, userInput, context } = hookData;
    
    // Check if this is a review node
    const reviewNode = this.activeReviews.get(nodeId);
    if (!reviewNode) {
      // Not a review node, ignore
      return;
    }

    // Parse the user input to extract review decision and feedback
    const feedback = this.parseUserFeedback(userInput, nodeId);
    
    // Emit feedback event for processing
    this.emit('review:feedback', feedback);
    
    // If decision is final (approve/reject), mark review as complete
    if (feedback.decision === 'approve' || feedback.decision === 'reject') {
      this.emit('review:complete', {
        nodeId,
        decision: feedback.decision,
        feedback
      });
      this.activeReviews.delete(nodeId);
    }
  }

  /**
   * Parse user feedback from various formats
   */
  private parseUserFeedback(input: string, nodeId: string): any {
    // Try to parse JSON format first
    if (input.trim().startsWith('{')) {
      try {
        return JSON.parse(input);
      } catch (e) {
        // Not JSON, continue with text parsing
      }
    }

    // Parse structured text format
    const lines = input.split('\n').map(l => l.trim()).filter(l => l);
    
    // Look for decision keywords
    let decision: 'approve' | 'reject' | 'request-changes' = 'request-changes';
    let comments = '';
    let actionItems: string[] = [];
    let severity: 'info' | 'warning' | 'error' = 'info';
    
    // Check first line for decision
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('approve')) {
      decision = 'approve';
      severity = 'info';
    } else if (firstLine.includes('reject')) {
      decision = 'reject';
      severity = 'error';
    } else if (firstLine.includes('change')) {
      decision = 'request-changes';
      severity = 'warning';
    }
    
    // Extract comments and action items
    let inActionItems = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.toLowerCase().includes('action items:') || 
          line.toLowerCase().includes('todo:') ||
          line.toLowerCase().includes('changes:')) {
        inActionItems = true;
        continue;
      }
      
      if (inActionItems && (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\./))) {
        // This is an action item
        actionItems.push(line.replace(/^[-*\d.]\s*/, '').trim());
      } else if (!inActionItems) {
        // This is a comment
        comments += (comments ? ' ' : '') + line;
      }
    }
    
    // If no explicit decision found, try to infer from content
    if (!comments && lines.length === 1) {
      comments = lines[0];
      
      // Simple keyword detection for single-line responses
      const lowerInput = comments.toLowerCase();
      if (lowerInput === 'lgtm' || lowerInput === 'looks good' || lowerInput === 'approved') {
        decision = 'approve';
        severity = 'info';
      } else if (lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('issue')) {
        decision = 'request-changes';
        severity = 'warning';
      }
    }
    
    return {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      reviewerId: 'claude_user',
      decision,
      comments: comments || input,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      timestamp: new Date(),
      severity
    };
  }

  /**
   * Setup hook script for capturing UserPromptSubmit
   */
  async setupReviewHooks(nodeId: string, flowId: string): Promise<void> {
    const hooksDir = path.join(this.projectDir, nodeId, '.claude', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    
    // Create UserPromptSubmit hook configuration
    const hookConfig = {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: 'command',
              command: `${path.join(this.projectDir, 'hooks', 'capture-review-feedback.sh')} ${nodeId} "$USER_INPUT" "$USER_ID"`
            }
          ]
        }
      ],
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: `echo "[REVIEW] Starting review session for node ${nodeId}" && ${path.join(this.projectDir, 'hooks', 'present-for-review.sh')} ${nodeId}`
            }
          ]
        }
      ]
    };
    
    const hookConfigPath = path.join(hooksDir, 'hooks.json');
    await fs.writeFile(hookConfigPath, JSON.stringify(hookConfig, null, 2));
    
    // Mark this node as active review
    this.activeReviews.set(nodeId, {
      flowId,
      startTime: new Date(),
      status: 'active'
    });
  }

  /**
   * Monitor review feedback files for changes
   */
  async monitorFeedbackFiles(nodeId: string): Promise<void> {
    const feedbackDir = path.join(this.projectDir, nodeId, 'review_feedback');
    
    try {
      await fs.mkdir(feedbackDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Watch for new feedback files
    const watcher = fs.watch(feedbackDir);
    
    for await (const event of watcher) {
      if (event.eventType === 'rename' && event.filename?.endsWith('.json')) {
        try {
          const feedbackPath = path.join(feedbackDir, event.filename);
          const feedbackContent = await fs.readFile(feedbackPath, 'utf-8');
          const feedback = JSON.parse(feedbackContent);
          
          // Emit feedback event
          this.emit('review:feedback', feedback);
          
          // Check for completion signal
          const signalPath = path.join(feedbackDir, `review_complete_${nodeId}.signal`);
          try {
            const signal = await fs.readFile(signalPath, 'utf-8');
            if (signal.trim() === 'approve' || signal.trim() === 'reject') {
              this.emit('review:complete', {
                nodeId,
                decision: signal.trim(),
                feedback
              });
              
              // Clean up signal file
              await fs.unlink(signalPath);
              
              // Stop watching
              break;
            }
          } catch (error) {
            // No signal file yet
          }
        } catch (error) {
          console.error('Error processing feedback file:', error);
        }
      }
    }
  }

  /**
   * Create a review presentation file for the Claude Code agent
   */
  async createReviewPresentation(nodeId: string, files: string[], changes: any): Promise<void> {
    const presentationPath = path.join(this.projectDir, nodeId, 'REVIEW.md');
    
    let content = `# Manual Review Required\n\n`;
    content += `## Review Instructions\n\n`;
    content += `Please review the changes made by this agent and provide your feedback.\n\n`;
    content += `### How to Respond:\n`;
    content += `1. Type "approve" to approve the changes\n`;
    content += `2. Type "reject" to reject and abort\n`;
    content += `3. Type "request changes" followed by specific feedback\n\n`;
    content += `### For requesting changes, use this format:\n`;
    content += `\`\`\`\n`;
    content += `request changes\n`;
    content += `Your feedback here...\n`;
    content += `Action items:\n`;
    content += `- First thing to fix\n`;
    content += `- Second thing to fix\n`;
    content += `\`\`\`\n\n`;
    
    if (files && files.length > 0) {
      content += `## Modified Files\n\n`;
      for (const file of files) {
        content += `- \`${file}\`\n`;
      }
      content += `\n`;
    }
    
    if (changes) {
      content += `## Summary of Changes\n\n`;
      content += `\`\`\`json\n${JSON.stringify(changes, null, 2)}\n\`\`\`\n`;
    }
    
    await fs.writeFile(presentationPath, content);
  }

  /**
   * Clean up review artifacts for a node
   */
  async cleanupReview(nodeId: string): Promise<void> {
    this.activeReviews.delete(nodeId);
    
    // Clean up review files
    try {
      const reviewDir = path.join(this.projectDir, nodeId, 'review_feedback');
      await fs.rmdir(reviewDir, { recursive: true });
      
      const presentationPath = path.join(this.projectDir, nodeId, 'REVIEW.md');
      await fs.unlink(presentationPath);
    } catch (error) {
      // Files might not exist
    }
  }
}