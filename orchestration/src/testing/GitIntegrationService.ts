import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GitConfig {
  workingDirectory: string;
  remote?: string;
  defaultBranch?: string;
  author?: {
    name: string;
    email: string;
  };
}

export interface BranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: CommitInfo;
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: FileChange[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
  oldPath?: string; // For renames
}

export interface MergeConflict {
  file: string;
  conflictMarkers: ConflictMarker[];
  suggestion?: string;
}

export interface ConflictMarker {
  start: number;
  end: number;
  ours: string;
  theirs: string;
}

export interface MergeStrategy {
  type: 'merge' | 'rebase' | 'squash';
  conflictResolution: 'manual' | 'ours' | 'theirs' | 'auto';
  autoResolvePatterns?: AutoResolvePattern[];
}

export interface AutoResolvePattern {
  filePattern: string | RegExp;
  resolution: 'ours' | 'theirs' | 'combine';
  priority?: number;
}

export class GitIntegrationService {
  private config: GitConfig;
  private conflictHistory: Map<string, MergeConflict[]> = new Map();

  constructor(config: GitConfig) {
    this.config = config;
  }

  // Branch Management
  async createBranch(branchName: string, from?: string): Promise<void> {
    const fromBranch = from || 'HEAD';
    await this.exec(['checkout', '-b', branchName, fromBranch]);
  }

  async switchBranch(branchName: string): Promise<void> {
    await this.exec(['checkout', branchName]);
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    const flag = force ? '-D' : '-d';
    await this.exec(['branch', flag, branchName]);
  }

  async listBranches(): Promise<BranchInfo[]> {
    const output = await this.exec(['branch', '-vv', '--no-abbrev']);
    const branches: BranchInfo[] = [];
    
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      
      const current = line.startsWith('*');
      const parts = line.substring(2).trim().split(/\s+/);
      const name = parts[0];
      const hash = parts[1];
      
      // Parse remote tracking info
      const remoteMatch = line.match(/\[([^:\]]+)(?:: ahead (\d+))?(?:, behind (\d+))?\]/);
      
      const branchInfo: BranchInfo = {
        name,
        current,
        ahead: remoteMatch ? parseInt(remoteMatch[2] || '0', 10) : 0,
        behind: remoteMatch ? parseInt(remoteMatch[3] || '0', 10) : 0
      };
      
      if (remoteMatch) {
        branchInfo.remote = remoteMatch[1];
      }
      
      // Get last commit info
      try {
        const commitInfo = await this.getCommitInfo(hash);
        branchInfo.lastCommit = commitInfo;
      } catch (e) {
        // Ignore if we can't get commit info
      }
      
      branches.push(branchInfo);
    }
    
    return branches;
  }

  async getCurrentBranch(): Promise<string> {
    const output = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    return output.trim();
  }

  // Conflict Resolution
  async detectConflicts(): Promise<MergeConflict[]> {
    const output = await this.exec(['diff', '--name-only', '--diff-filter=U']);
    const conflictedFiles = output.trim().split('\n').filter(Boolean);
    const conflicts: MergeConflict[] = [];
    
    for (const file of conflictedFiles) {
      const conflict = await this.analyzeConflict(file);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
    
    return conflicts;
  }

  private async analyzeConflict(filePath: string): Promise<MergeConflict | null> {
    const fullPath = path.join(this.config.workingDirectory, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const markers: ConflictMarker[] = [];
      
      let inConflict = false;
      let conflictStart = -1;
      let oursContent: string[] = [];
      let theirsContent: string[] = [];
      let inTheirs = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('<<<<<<<')) {
          inConflict = true;
          conflictStart = i;
          oursContent = [];
        } else if (line.startsWith('=======') && inConflict) {
          inTheirs = true;
        } else if (line.startsWith('>>>>>>>') && inConflict) {
          markers.push({
            start: conflictStart,
            end: i,
            ours: oursContent.join('\n'),
            theirs: theirsContent.join('\n')
          });
          
          inConflict = false;
          inTheirs = false;
          oursContent = [];
          theirsContent = [];
        } else if (inConflict) {
          if (inTheirs) {
            theirsContent.push(line);
          } else {
            oursContent.push(line);
          }
        }
      }
      
      if (markers.length === 0) {
        return null;
      }
      
      return {
        file: filePath,
        conflictMarkers: markers,
        suggestion: this.suggestResolution(filePath, markers)
      };
    } catch (error) {
      console.error(`Failed to analyze conflict in ${filePath}:`, error);
      return null;
    }
  }

  private suggestResolution(filePath: string, markers: ConflictMarker[]): string {
    // Analyze the conflicts to suggest resolution
    const extension = path.extname(filePath);
    
    // Check if conflicts are in imports/requires
    const hasImportConflicts = markers.some(m => 
      m.ours.includes('import') || m.theirs.includes('import') ||
      m.ours.includes('require') || m.theirs.includes('require')
    );
    
    if (hasImportConflicts) {
      return 'Conflicts in imports detected. Consider combining both sets of imports.';
    }
    
    // Check if conflicts are in package.json
    if (filePath.includes('package.json')) {
      return 'Package.json conflicts. Merge dependencies and resolve version conflicts.';
    }
    
    // Check if conflicts are in configuration files
    if (['.json', '.yml', '.yaml', '.toml'].includes(extension)) {
      return 'Configuration file conflict. Carefully merge configuration values.';
    }
    
    // Check size of conflicts
    const totalConflictLines = markers.reduce((sum, m) => sum + (m.end - m.start), 0);
    if (totalConflictLines < 10) {
      return 'Small conflict. Manual review recommended.';
    }
    
    return 'Complex conflict detected. Manual resolution required.';
  }

  async resolveConflict(
    file: string,
    resolution: 'ours' | 'theirs' | 'manual',
    manualContent?: string
  ): Promise<void> {
    if (resolution === 'manual' && manualContent) {
      const fullPath = path.join(this.config.workingDirectory, file);
      await fs.writeFile(fullPath, manualContent);
      await this.exec(['add', file]);
    } else if (resolution === 'ours') {
      await this.exec(['checkout', '--ours', file]);
      await this.exec(['add', file]);
    } else if (resolution === 'theirs') {
      await this.exec(['checkout', '--theirs', file]);
      await this.exec(['add', file]);
    }
  }

  async autoResolveConflicts(strategy: MergeStrategy): Promise<{
    resolved: string[];
    remaining: MergeConflict[];
  }> {
    const conflicts = await this.detectConflicts();
    const resolved: string[] = [];
    const remaining: MergeConflict[] = [];
    
    for (const conflict of conflicts) {
      const pattern = this.findMatchingPattern(conflict.file, strategy.autoResolvePatterns);
      
      if (pattern) {
        if (pattern.resolution === 'combine') {
          // Try to intelligently combine changes
          const combinedContent = await this.combineChanges(conflict);
          if (combinedContent) {
            await this.resolveConflict(conflict.file, 'manual', combinedContent);
            resolved.push(conflict.file);
          } else {
            remaining.push(conflict);
          }
        } else {
          await this.resolveConflict(conflict.file, pattern.resolution);
          resolved.push(conflict.file);
        }
      } else if (strategy.conflictResolution === 'auto') {
        // Try automatic resolution based on heuristics
        const autoResolved = await this.attemptAutoResolve(conflict);
        if (autoResolved) {
          resolved.push(conflict.file);
        } else {
          remaining.push(conflict);
        }
      } else if (strategy.conflictResolution !== 'manual') {
        await this.resolveConflict(conflict.file, strategy.conflictResolution);
        resolved.push(conflict.file);
      } else {
        remaining.push(conflict);
      }
    }
    
    // Store conflicts for learning
    for (const conflict of remaining) {
      const history = this.conflictHistory.get(conflict.file) || [];
      history.push(conflict);
      this.conflictHistory.set(conflict.file, history);
    }
    
    return { resolved, remaining };
  }

  private findMatchingPattern(
    file: string,
    patterns?: AutoResolvePattern[]
  ): AutoResolvePattern | undefined {
    if (!patterns) return undefined;
    
    const matching = patterns
      .filter(p => {
        if (typeof p.filePattern === 'string') {
          return file.includes(p.filePattern);
        }
        return p.filePattern.test(file);
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return matching[0];
  }

  private async combineChanges(conflict: MergeConflict): Promise<string | null> {
    const fullPath = path.join(this.config.workingDirectory, conflict.file);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const result: string[] = [];
    
    let i = 0;
    for (const marker of conflict.conflictMarkers) {
      // Add lines before conflict
      while (i < marker.start) {
        result.push(lines[i++]);
      }
      
      // Try to intelligently combine
      const combined = this.intelligentMerge(marker.ours, marker.theirs, conflict.file);
      if (combined) {
        result.push(combined);
      } else {
        return null; // Can't auto-combine
      }
      
      // Skip to after conflict
      i = marker.end + 1;
    }
    
    // Add remaining lines
    while (i < lines.length) {
      result.push(lines[i++]);
    }
    
    return result.join('\n');
  }

  private intelligentMerge(ours: string, theirs: string, filePath: string): string | null {
    const extension = path.extname(filePath);
    
    // For imports/requires, combine both
    if (ours.includes('import') && theirs.includes('import')) {
      const ourImports = ours.split('\n').filter(l => l.includes('import'));
      const theirImports = theirs.split('\n').filter(l => l.includes('import'));
      const combined = [...new Set([...ourImports, ...theirImports])];
      return combined.join('\n');
    }
    
    // For JSON files, try to merge objects
    if (extension === '.json') {
      try {
        const ourObj = JSON.parse(ours);
        const theirObj = JSON.parse(theirs);
        const merged = this.deepMerge(ourObj, theirObj);
        return JSON.stringify(merged, null, 2);
      } catch (e) {
        // Not valid JSON fragments
      }
    }
    
    // If changes are on different lines, combine
    const ourLines = ours.split('\n');
    const theirLines = theirs.split('\n');
    if (ourLines.length === theirLines.length) {
      const combined: string[] = [];
      for (let i = 0; i < ourLines.length; i++) {
        if (ourLines[i] === theirLines[i]) {
          combined.push(ourLines[i]);
        } else if (ourLines[i].trim() === '' && theirLines[i].trim() !== '') {
          combined.push(theirLines[i]);
        } else if (theirLines[i].trim() === '' && ourLines[i].trim() !== '') {
          combined.push(ourLines[i]);
        } else {
          return null; // Can't auto-merge different changes on same line
        }
      }
      return combined.join('\n');
    }
    
    return null;
  }

  private deepMerge(obj1: any, obj2: any): any {
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      return [...new Set([...obj1, ...obj2])];
    }
    
    if (typeof obj1 === 'object' && typeof obj2 === 'object') {
      const merged: any = { ...obj1 };
      
      for (const key in obj2) {
        if (key in merged) {
          merged[key] = this.deepMerge(merged[key], obj2[key]);
        } else {
          merged[key] = obj2[key];
        }
      }
      
      return merged;
    }
    
    // For non-objects, prefer the second value (theirs)
    return obj2;
  }

  private async attemptAutoResolve(conflict: MergeConflict): Promise<boolean> {
    // Simple heuristics for auto-resolution
    const allMarkersSmall = conflict.conflictMarkers.every(m => 
      m.ours.split('\n').length < 3 && m.theirs.split('\n').length < 3
    );
    
    if (allMarkersSmall) {
      // Small conflicts might be formatting differences
      const combined = await this.combineChanges(conflict);
      if (combined) {
        await this.resolveConflict(conflict.file, 'manual', combined);
        return true;
      }
    }
    
    return false;
  }

  // Merge Strategies
  async merge(branch: string, strategy: MergeStrategy): Promise<{
    success: boolean;
    conflicts?: MergeConflict[];
    message?: string;
  }> {
    try {
      switch (strategy.type) {
        case 'merge':
          await this.exec(['merge', branch, '--no-ff']);
          break;
        case 'rebase':
          await this.exec(['rebase', branch]);
          break;
        case 'squash':
          await this.exec(['merge', '--squash', branch]);
          break;
      }
      
      return { success: true };
    } catch (error: any) {
      // Check for conflicts
      if (error.message.includes('CONFLICT')) {
        const conflicts = await this.detectConflicts();
        
        if (strategy.conflictResolution !== 'manual') {
          const { resolved, remaining } = await this.autoResolveConflicts(strategy);
          
          if (remaining.length === 0) {
            // All conflicts resolved, continue merge
            await this.exec(['commit', '--no-edit']);
            return { 
              success: true, 
              message: `Auto-resolved ${resolved.length} conflicts` 
            };
          }
          
          return { 
            success: false, 
            conflicts: remaining,
            message: `Resolved ${resolved.length} conflicts, ${remaining.length} require manual resolution`
          };
        }
        
        return { success: false, conflicts };
      }
      
      throw error;
    }
  }

  async cherryPick(commits: string[], strategy?: MergeStrategy): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
  }> {
    const applied: string[] = [];
    const failed: string[] = [];
    
    for (const commit of commits) {
      try {
        await this.exec(['cherry-pick', commit]);
        applied.push(commit);
      } catch (error: any) {
        if (error.message.includes('CONFLICT') && strategy) {
          const conflicts = await this.detectConflicts();
          const { remaining } = await this.autoResolveConflicts(strategy);
          
          if (remaining.length === 0) {
            await this.exec(['cherry-pick', '--continue']);
            applied.push(commit);
          } else {
            await this.exec(['cherry-pick', '--abort']);
            failed.push(commit);
          }
        } else {
          failed.push(commit);
        }
      }
    }
    
    return {
      success: failed.length === 0,
      applied,
      failed
    };
  }

  // Commit Management
  async commit(message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await this.exec(['add', ...files]);
    } else {
      await this.exec(['add', '-A']);
    }
    
    const args = ['commit', '-m', message];
    
    if (this.config.author) {
      args.push('--author', `${this.config.author.name} <${this.config.author.email}>`);
    }
    
    await this.exec(args);
    
    // Get commit hash
    const hash = await this.exec(['rev-parse', 'HEAD']);
    return hash.trim();
  }

  async getCommitInfo(hash: string): Promise<CommitInfo> {
    const format = '%H%n%an%n%at%n%s%n%b';
    const output = await this.exec(['show', '--format=' + format, '--no-patch', hash]);
    const lines = output.trim().split('\n');
    
    const commitInfo: CommitInfo = {
      hash: lines[0],
      author: lines[1],
      date: new Date(parseInt(lines[2], 10) * 1000),
      message: lines.slice(3).join('\n'),
      files: []
    };
    
    // Get file changes
    const filesOutput = await this.exec(['show', '--name-status', '--format=', hash]);
    const fileLines = filesOutput.trim().split('\n').filter(Boolean);
    
    for (const line of fileLines) {
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t');
      
      commitInfo.files.push({
        path: filePath,
        status: this.mapGitStatus(status)
      });
    }
    
    return commitInfo;
  }

  private mapGitStatus(status: string): 'added' | 'modified' | 'deleted' | 'renamed' {
    switch (status[0]) {
      case 'A': return 'added';
      case 'M': return 'modified';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      default: return 'modified';
    }
  }

  async getRecentCommits(count: number = 10): Promise<CommitInfo[]> {
    const hashes = await this.exec(['log', `--max-count=${count}`, '--format=%H']);
    const commits: CommitInfo[] = [];
    
    for (const hash of hashes.trim().split('\n')) {
      if (hash) {
        commits.push(await this.getCommitInfo(hash));
      }
    }
    
    return commits;
  }

  // Rollback and Recovery
  async rollback(to: string | number): Promise<void> {
    if (typeof to === 'number') {
      // Rollback by number of commits
      await this.exec(['reset', '--hard', `HEAD~${to}`]);
    } else {
      // Rollback to specific commit
      await this.exec(['reset', '--hard', to]);
    }
  }

  async stash(message?: string): Promise<void> {
    const args = ['stash', 'push'];
    if (message) {
      args.push('-m', message);
    }
    await this.exec(args);
  }

  async unstash(stashId?: string): Promise<void> {
    const args = ['stash', 'pop'];
    if (stashId) {
      args.push(stashId);
    }
    await this.exec(args);
  }

  // Utility Methods
  private async exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: SpawnOptionsWithoutStdio = {
        cwd: this.config.workingDirectory,
        env: { ...process.env }
      };
      
      const git = spawn('git', args, options);
      let stdout = '';
      let stderr = '';
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
      
      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  async isRepository(): Promise<boolean> {
    try {
      await this.exec(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (!(await this.isRepository())) {
      await this.exec(['init']);
      
      if (this.config.defaultBranch) {
        await this.exec(['checkout', '-b', this.config.defaultBranch]);
      }
    }
  }

  async getStatus(): Promise<{
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
  }> {
    const output = await this.exec(['status', '--porcelain']);
    const result = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      untracked: [] as string[]
    };
    
    for (const line of output.split('\n')) {
      if (!line) continue;
      
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      if (status === '??') {
        result.untracked.push(file);
      } else if (status.includes('M')) {
        result.modified.push(file);
      } else if (status.includes('A')) {
        result.added.push(file);
      } else if (status.includes('D')) {
        result.deleted.push(file);
      }
    }
    
    return result;
  }
}