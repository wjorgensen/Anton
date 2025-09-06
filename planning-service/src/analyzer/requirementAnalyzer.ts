import { ProjectRequirements } from '../types';

export class RequirementAnalyzer {
  private readonly techKeywords = {
    frontend: {
      react: ['react', 'jsx', 'redux', 'hooks', 'component'],
      vue: ['vue', 'vuejs', 'vuex', 'composition api'],
      angular: ['angular', 'rxjs', 'directive', 'service'],
      nextjs: ['next.js', 'nextjs', 'server-side', 'ssr', 'ssg'],
      svelte: ['svelte', 'sveltekit'],
      flutter: ['flutter', 'dart', 'mobile', 'cross-platform']
    },
    backend: {
      nodejs: ['node', 'nodejs', 'express', 'fastify', 'nestjs', 'koa'],
      python: ['python', 'django', 'fastapi', 'flask', 'pyramid'],
      java: ['java', 'spring', 'springboot', 'jakarta', 'maven'],
      go: ['golang', 'go', 'gin', 'echo', 'fiber'],
      rust: ['rust', 'actix', 'rocket', 'axum'],
      ruby: ['ruby', 'rails', 'sinatra'],
      php: ['php', 'laravel', 'symfony', 'slim']
    },
    database: {
      postgres: ['postgres', 'postgresql', 'psql', 'relational'],
      mysql: ['mysql', 'mariadb'],
      mongodb: ['mongodb', 'mongo', 'nosql', 'document'],
      redis: ['redis', 'cache', 'session', 'pub/sub'],
      sqlite: ['sqlite', 'embedded', 'lightweight']
    },
    testing: {
      jest: ['jest', 'unit test', 'testing react', 'snapshot'],
      pytest: ['pytest', 'python test', 'fixture'],
      playwright: ['playwright', 'e2e', 'end-to-end', 'browser'],
      cypress: ['cypress', 'integration', 'e2e test'],
      vitest: ['vitest', 'vite test'],
      mocha: ['mocha', 'chai', 'sinon']
    }
  };

  private readonly projectTypePatterns = {
    web: ['web app', 'website', 'spa', 'single page', 'frontend', 'ui', 'user interface'],
    mobile: ['mobile', 'ios', 'android', 'app', 'flutter', 'react native'],
    api: ['api', 'rest', 'graphql', 'microservice', 'backend', 'server', 'service'],
    fullstack: ['full stack', 'fullstack', 'full-stack', 'complete app', 'end-to-end'],
    microservice: ['microservice', 'micro-service', 'distributed', 'service mesh'],
    cli: ['cli', 'command line', 'terminal', 'console', 'script', 'automation']
  };

  private readonly featureKeywords = {
    authentication: ['auth', 'login', 'signup', 'oauth', 'jwt', 'session', 'user management'],
    database: ['database', 'db', 'data storage', 'persistence', 'orm', 'query'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'websocket', 'real-time'],
    testing: ['test', 'testing', 'tdd', 'unit test', 'integration test', 'e2e'],
    deployment: ['deploy', 'deployment', 'docker', 'kubernetes', 'ci/cd', 'pipeline'],
    documentation: ['docs', 'documentation', 'readme', 'api docs', 'swagger'],
    security: ['security', 'encryption', 'csrf', 'xss', 'vulnerability', 'secure'],
    performance: ['performance', 'optimization', 'caching', 'lazy loading', 'speed'],
    internationalization: ['i18n', 'internationalization', 'localization', 'multi-language'],
    monitoring: ['monitoring', 'logging', 'analytics', 'metrics', 'observability'],
    payment: ['payment', 'stripe', 'paypal', 'billing', 'subscription'],
    search: ['search', 'elasticsearch', 'algolia', 'full-text', 'indexing'],
    messaging: ['messaging', 'chat', 'notification', 'email', 'sms', 'push'],
    fileUpload: ['file upload', 'image upload', 's3', 'storage', 'media']
  };

  analyze(description: string): ProjectRequirements {
    const normalized = description.toLowerCase();
    
    const projectType = this.detectProjectType(normalized);
    const technology = this.detectTechnology(normalized);
    const features = this.detectFeatures(normalized);
    const preferences = this.detectPreferences(normalized);
    const constraints = this.detectConstraints(normalized);

    return {
      description,
      projectType,
      technology,
      features,
      preferences,
      constraints
    };
  }

  private detectProjectType(text: string): ProjectRequirements['projectType'] {
    let scores: Record<string, number> = {};
    
    for (const [type, patterns] of Object.entries(this.projectTypePatterns)) {
      scores[type] = patterns.filter(pattern => text.includes(pattern)).length;
    }

    const hasBackend = this.hasTechnology(text, 'backend');
    const hasFrontend = this.hasTechnology(text, 'frontend');
    
    if (hasBackend && hasFrontend) {
      scores['fullstack'] = (scores['fullstack'] || 0) + 2;
    } else if (hasBackend && !hasFrontend) {
      scores['api'] = (scores['api'] || 0) + 2;
    } else if (hasFrontend && !hasBackend) {
      scores['web'] = (scores['web'] || 0) + 2;
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'fullstack';
    
    const topType = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
    return topType as ProjectRequirements['projectType'] || 'fullstack';
  }

  private detectTechnology(text: string): ProjectRequirements['technology'] {
    const technology: ProjectRequirements['technology'] = {};

    for (const [category, techs] of Object.entries(this.techKeywords)) {
      const detected: string[] = [];
      
      for (const [tech, keywords] of Object.entries(techs)) {
        const score = keywords.filter(keyword => text.includes(keyword)).length;
        if (score > 0) {
          detected.push(tech);
        }
      }

      if (detected.length > 0) {
        technology[category as keyof typeof technology] = detected;
      }
    }

    const inferredTech = this.inferTechnology(text, technology);
    return { ...technology, ...inferredTech };
  }

  private inferTechnology(
    text: string, 
    detected: ProjectRequirements['technology']
  ): ProjectRequirements['technology'] {
    const inferred: ProjectRequirements['technology'] = {};

    if (!detected?.frontend && text.includes('frontend')) {
      inferred.frontend = ['react'];
    }
    
    if (!detected?.backend && (text.includes('backend') || text.includes('api'))) {
      inferred.backend = ['nodejs'];
    }

    if (!detected?.database && (text.includes('database') || text.includes('data'))) {
      inferred.database = ['postgres'];
    }

    if (!detected?.testing && text.includes('test')) {
      const hasFrontend = detected?.frontend || inferred.frontend;
      const hasBackend = detected?.backend || inferred.backend;
      
      if (hasFrontend?.includes('react') || hasFrontend?.includes('nextjs')) {
        inferred.testing = ['jest', 'playwright'];
      } else if (hasBackend?.includes('python')) {
        inferred.testing = ['pytest'];
      } else {
        inferred.testing = ['jest'];
      }
    }

    return inferred;
  }

  private detectFeatures(text: string): string[] {
    const features: string[] = [];

    for (const [feature, keywords] of Object.entries(this.featureKeywords)) {
      const hasFeature = keywords.some(keyword => text.includes(keyword));
      if (hasFeature) {
        features.push(feature);
      }
    }

    const inferredFeatures = this.inferFeatures(text, features);
    return [...new Set([...features, ...inferredFeatures])];
  }

  private inferFeatures(text: string, detected: string[]): string[] {
    const inferred: string[] = [];

    if (text.includes('crud') || text.includes('create read update delete')) {
      inferred.push('database', 'api');
    }

    if (text.includes('user') || text.includes('account')) {
      if (!detected.includes('authentication')) {
        inferred.push('authentication');
      }
    }

    if (text.includes('production') || text.includes('deploy')) {
      if (!detected.includes('deployment')) {
        inferred.push('deployment');
      }
    }

    return inferred;
  }

  private detectPreferences(text: string): ProjectRequirements['preferences'] {
    const preferences: ProjectRequirements['preferences'] = {};

    if (text.includes('comprehensive test') || text.includes('full test')) {
      preferences.testing = 'comprehensive';
    } else if (text.includes('basic test') || text.includes('minimal test')) {
      preferences.testing = 'basic';
    } else if (text.includes('no test') || text.includes('skip test')) {
      preferences.testing = 'none';
    }

    if (text.includes('manual review') || text.includes('human review')) {
      preferences.review = 'manual';
    } else if (text.includes('automated review') || text.includes('auto review')) {
      preferences.review = 'automated';
    }

    if (text.includes('deploy') || text.includes('production')) {
      preferences.deployment = true;
    }

    if (text.includes('document') || text.includes('readme')) {
      preferences.documentation = true;
    }

    return preferences;
  }

  private detectConstraints(text: string): ProjectRequirements['constraints'] {
    const constraints: ProjectRequirements['constraints'] = {};

    const parallelMatch = text.match(/(\d+)\s*parallel/i);
    if (parallelMatch) {
      constraints.maxParallel = parseInt(parallelMatch[1]);
    }

    const timeMatch = text.match(/(\d+)\s*(hour|minute|hr|min)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      constraints.timeLimit = unit.startsWith('h') ? value * 60 : value;
    }

    return constraints;
  }

  private hasTechnology(text: string, category: 'frontend' | 'backend'): boolean {
    const techs = this.techKeywords[category];
    
    for (const keywords of Object.values(techs)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return true;
      }
    }
    
    return false;
  }

  extractPriorities(requirements: ProjectRequirements): string[] {
    const priorities: string[] = [];

    if (requirements.projectType === 'api' || requirements.projectType === 'microservice') {
      priorities.push('performance', 'scalability', 'security');
    } else if (requirements.projectType === 'web' || requirements.projectType === 'mobile') {
      priorities.push('user-experience', 'responsiveness', 'accessibility');
    }

    if (requirements.features?.includes('authentication')) {
      priorities.push('security');
    }

    if (requirements.features?.includes('payment')) {
      priorities.push('security', 'reliability');
    }

    if (requirements.preferences?.testing === 'comprehensive') {
      priorities.push('quality', 'reliability');
    }

    return [...new Set(priorities)];
  }
}