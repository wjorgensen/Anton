import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';

/**
 * Agent Library Validation System
 * Validates agent JSON files against the schema and ensures consistency
 */

interface AgentConfig {
  id: string;
  name: string;
  category: 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'utility';
  type: string;
  version: string;
  description: string;
  instructions: {
    base: string;
    contextual: string;
  };
  claudeMD: string;
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: any;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  hooks: {
    Stop: Array<any>;
    [key: string]: Array<any>;
  };
  resources: {
    estimatedTime: number;
    estimatedTokens: number;
    requiresGPU: boolean;
    maxRetries: number;
    memory?: string;
    cpu?: string;
  };
  dependencies: string[];
  tags: string[];
}

interface ValidationResult {
  valid: boolean;
  errors?: any[];
  warnings?: string[];
}

interface AgentValidationReport {
  agentId: string;
  file: string;
  validation: ValidationResult;
  hookValidation: ValidationResult;
  dependencyValidation: ValidationResult;
}

export class AgentValidator {
  private ajv: Ajv;
  private schema: any;
  private agentsDir: string;
  private loadedAgents: Map<string, AgentConfig>;

  constructor(schemaPath?: string, agentsDir?: string) {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.agentsDir = agentsDir || path.join(__dirname, '../library');
    this.loadedAgents = new Map();
    
    // Load schema
    const schemaFile = schemaPath || path.join(__dirname, 'agent.schema.json');
    this.schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
  }

  /**
   * Validate a single agent configuration
   */
  validateAgent(agentConfig: any, filePath?: string): ValidationResult {
    const validate = this.ajv.compile(this.schema);
    const valid = validate(agentConfig);
    
    const result: ValidationResult = {
      valid: valid as boolean,
      errors: valid ? undefined : validate.errors,
      warnings: []
    };

    // Additional validation checks
    if (valid) {
      // Check for warnings
      result.warnings = this.checkWarnings(agentConfig);
    }

    return result;
  }

  /**
   * Check for non-critical issues that should be warnings
   */
  private checkWarnings(agent: AgentConfig): string[] {
    const warnings: string[] = [];

    // Check if description is too short
    if (agent.description.length < 50) {
      warnings.push('Description is very short (< 50 chars)');
    }

    // Check if claudeMD is comprehensive
    if (agent.claudeMD.length < 200) {
      warnings.push('ClaudeMD documentation seems minimal (< 200 chars)');
    }

    // Check for missing optional fields
    if (!agent.icon) {
      warnings.push('Missing icon field');
    }
    if (!agent.color) {
      warnings.push('Missing color field');
    }

    // Check resource estimations
    if (agent.resources.estimatedTime < 5) {
      warnings.push('Estimated time seems very low (< 5 minutes)');
    }
    if (agent.resources.estimatedTokens < 10000) {
      warnings.push('Estimated tokens seems very low (< 10,000)');
    }

    // Check hooks
    if (!agent.hooks.Stop || agent.hooks.Stop.length === 0) {
      warnings.push('Missing Stop hook - required for orchestration');
    }
    if (!agent.hooks.PostToolUse) {
      warnings.push('Missing PostToolUse hook - recommended for tracking');
    }

    return warnings;
  }

  /**
   * Validate hooks configuration
   */
  validateHooks(agent: AgentConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required Stop hook
    if (!agent.hooks.Stop || agent.hooks.Stop.length === 0) {
      errors.push('Stop hook is required for all agents');
    } else {
      // Validate Stop hook structure
      const stopHook = agent.hooks.Stop[0];
      if (!stopHook.hooks || !Array.isArray(stopHook.hooks)) {
        errors.push('Stop hook must contain hooks array');
      } else {
        const command = stopHook.hooks[0]?.command;
        if (!command || !command.includes('$NODE_ID')) {
          errors.push('Stop hook command must include $NODE_ID variable');
        }
      }
    }

    // Category-specific hook validation
    switch (agent.category) {
      case 'setup':
        if (!agent.hooks.PostToolUse) {
          warnings.push('Setup agents should have PostToolUse hook for tracking installations');
        }
        break;
      case 'execution':
        if (!agent.hooks.PreCompact) {
          warnings.push('Execution agents should have PreCompact hook for saving work');
        }
        break;
      case 'testing':
        const hasTestParseHook = agent.hooks.PostToolUse?.some(
          h => h.hooks?.some(hk => hk.command?.includes('parse-test-output'))
        );
        if (!hasTestParseHook) {
          warnings.push('Testing agents should parse test output');
        }
        break;
      case 'review':
        if (!agent.hooks.UserPromptSubmit) {
          warnings.push('Review agents should capture user feedback');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings
    };
  }

  /**
   * Validate agent dependencies exist
   */
  async validateDependencies(agent: AgentConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.loadedAgents.size) {
      await this.loadAllAgents();
    }

    for (const dep of agent.dependencies) {
      if (!this.loadedAgents.has(dep)) {
        errors.push(`Dependency '${dep}' does not exist`);
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    if (this.hasCircularDependency(agent.id, visited, recursionStack)) {
      errors.push('Circular dependency detected');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings
    };
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependency(
    agentId: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(agentId);
    recursionStack.add(agentId);

    const agent = this.loadedAgents.get(agentId);
    if (agent) {
      for (const dep of agent.dependencies) {
        if (!visited.has(dep)) {
          if (this.hasCircularDependency(dep, visited, recursionStack)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }
    }

    recursionStack.delete(agentId);
    return false;
  }

  /**
   * Load all agents from the library
   */
  async loadAllAgents(): Promise<void> {
    const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.agentsDir, category);
      if (fs.existsSync(categoryPath)) {
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
        
        for (const file of files) {
          const filePath = path.join(categoryPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.loadedAgents.set(content.id, content);
        }
      }
    }
  }

  /**
   * Validate all agents in the library
   */
  async validateLibrary(): Promise<{
    valid: boolean;
    totalAgents: number;
    validAgents: number;
    reports: AgentValidationReport[];
  }> {
    await this.loadAllAgents();
    const reports: AgentValidationReport[] = [];
    let validCount = 0;

    for (const [agentId, agent] of this.loadedAgents) {
      const schemaValidation = this.validateAgent(agent);
      const hookValidation = this.validateHooks(agent);
      const dependencyValidation = await this.validateDependencies(agent);

      const isValid = schemaValidation.valid && hookValidation.valid && dependencyValidation.valid;
      if (isValid) validCount++;

      reports.push({
        agentId,
        file: `${agent.category}/${agentId}.json`,
        validation: schemaValidation,
        hookValidation,
        dependencyValidation
      });
    }

    return {
      valid: validCount === this.loadedAgents.size,
      totalAgents: this.loadedAgents.size,
      validAgents: validCount,
      reports
    };
  }

  /**
   * Generate validation report
   */
  generateReport(results: any): string {
    let report = '# Agent Library Validation Report\n\n';
    report += `Total Agents: ${results.totalAgents}\n`;
    report += `Valid Agents: ${results.validAgents}\n`;
    report += `Invalid Agents: ${results.totalAgents - results.validAgents}\n\n`;

    if (!results.valid) {
      report += '## Validation Errors\n\n';
      for (const r of results.reports) {
        if (!r.validation.valid || !r.hookValidation.valid || !r.dependencyValidation.valid) {
          report += `### ${r.agentId} (${r.file})\n`;
          
          if (r.validation.errors) {
            report += '#### Schema Errors:\n';
            r.validation.errors.forEach(e => {
              report += `- ${e.message}\n`;
            });
          }
          
          if (r.hookValidation.errors) {
            report += '#### Hook Errors:\n';
            r.hookValidation.errors.forEach(e => {
              report += `- ${e}\n`;
            });
          }
          
          if (r.dependencyValidation.errors) {
            report += '#### Dependency Errors:\n';
            r.dependencyValidation.errors.forEach(e => {
              report += `- ${e}\n`;
            });
          }
          
          report += '\n';
        }
      }
    }

    // Add warnings section
    report += '## Warnings\n\n';
    for (const r of results.reports) {
      const allWarnings = [
        ...(r.validation.warnings || []),
        ...(r.hookValidation.warnings || []),
        ...(r.dependencyValidation.warnings || [])
      ];
      
      if (allWarnings.length > 0) {
        report += `### ${r.agentId}\n`;
        allWarnings.forEach(w => {
          report += `- ${w}\n`;
        });
        report += '\n';
      }
    }

    return report;
  }
}

// CLI interface
if (require.main === module) {
  (async () => {
    const validator = new AgentValidator();
    console.log('Validating agent library...');
    
    const results = await validator.validateLibrary();
    const report = validator.generateReport(results);
    
    console.log(report);
    
    // Write report to file
    fs.writeFileSync(
      path.join(__dirname, '../../validation-report.md'),
      report
    );
    
    // Exit with error code if validation failed
    process.exit(results.valid ? 0 : 1);
  })();
}