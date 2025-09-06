'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Code2, 
  GitBranch, 
  Sparkles, 
  Settings, 
  Eye,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  Github,
  FileText,
  Zap,
  Globe,
  Smartphone,
  Database,
  Shield,
  Star,
  Clock,
  Users,
  Layers,
  Play,
  Save,
  X,
  Plus,
  Minus,
  Edit3,
  ArrowRight,
  Check,
  AlertCircle,
  Lightbulb,
  Target,
  Workflow,
  Brain,
  Download,
  Copy
} from 'lucide-react';

interface ProjectWizardProps {
  onComplete: (project: any) => void;
  onCancel: () => void;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  technologies: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  features: string[];
}

interface TechnologyStack {
  id: string;
  name: string;
  icon: string;
  category: 'frontend' | 'backend' | 'database' | 'cloud' | 'testing';
  description: string;
  popular: boolean;
}

interface AIRequirement {
  id: string;
  text: string;
  category: string;
  confidence: number;
  suggestedAgents: string[];
}

interface WizardStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

const WIZARD_STEPS: WizardStep[] = [
  { 
    id: 'basics', 
    title: 'Project Basics', 
    subtitle: 'Name, description & template',
    icon: FileText 
  },
  { 
    id: 'planning', 
    title: 'AI Planning', 
    subtitle: 'Requirements & flow generation',
    icon: Brain 
  },
  { 
    id: 'customization', 
    title: 'Customization', 
    subtitle: 'Fine-tune your workflow',
    icon: Settings 
  },
  { 
    id: 'review', 
    title: 'Review & Create', 
    subtitle: 'Final review & launch',
    icon: CheckCircle 
  },
];

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'full-stack-web',
    name: 'Full-Stack Web App',
    description: 'Complete web application with frontend, backend, and database',
    category: 'web',
    icon: Globe,
    technologies: ['React', 'Node.js', 'PostgreSQL'],
    complexity: 'intermediate',
    estimatedTime: 120,
    features: ['Authentication', 'API', 'Database', 'Testing']
  },
  {
    id: 'mobile-app',
    name: 'Mobile Application',
    description: 'Cross-platform mobile app with React Native',
    category: 'mobile',
    icon: Smartphone,
    technologies: ['React Native', 'Expo', 'Firebase'],
    complexity: 'intermediate',
    estimatedTime: 90,
    features: ['Cross-platform', 'Push notifications', 'Offline support']
  },
  {
    id: 'api-backend',
    name: 'REST API Backend',
    description: 'Scalable REST API with authentication and documentation',
    category: 'backend',
    icon: Code2,
    technologies: ['Node.js', 'Express', 'MongoDB'],
    complexity: 'beginner',
    estimatedTime: 60,
    features: ['REST API', 'Authentication', 'Documentation', 'Testing']
  },
  {
    id: 'data-pipeline',
    name: 'Data Processing Pipeline',
    description: 'ETL pipeline for data processing and analytics',
    category: 'data',
    icon: Database,
    technologies: ['Python', 'Pandas', 'PostgreSQL'],
    complexity: 'advanced',
    estimatedTime: 150,
    features: ['Data ingestion', 'Processing', 'Analytics', 'Visualization']
  },
  {
    id: 'ml-model',
    name: 'Machine Learning Model',
    description: 'End-to-end ML model training and deployment',
    category: 'ai',
    icon: Brain,
    technologies: ['Python', 'TensorFlow', 'Docker'],
    complexity: 'advanced',
    estimatedTime: 180,
    features: ['Model training', 'Deployment', 'API endpoint', 'Monitoring']
  },
  {
    id: 'custom',
    name: 'Custom Project',
    description: 'Start from scratch with AI-generated workflow',
    category: 'custom',
    icon: Sparkles,
    technologies: [],
    complexity: 'intermediate',
    estimatedTime: 0,
    features: ['AI-generated', 'Fully customizable']
  }
];

const TECHNOLOGY_STACKS: TechnologyStack[] = [
  // Frontend
  { id: 'react', name: 'React', icon: '⚛️', category: 'frontend', description: 'Popular UI library', popular: true },
  { id: 'vue', name: 'Vue.js', icon: '🖖', category: 'frontend', description: 'Progressive framework', popular: true },
  { id: 'angular', name: 'Angular', icon: '🅰️', category: 'frontend', description: 'Full-featured framework', popular: false },
  { id: 'nextjs', name: 'Next.js', icon: '▲', category: 'frontend', description: 'React meta-framework', popular: true },
  { id: 'svelte', name: 'Svelte', icon: '🔥', category: 'frontend', description: 'Compile-time framework', popular: false },
  
  // Backend
  { id: 'nodejs', name: 'Node.js', icon: '🟢', category: 'backend', description: 'JavaScript runtime', popular: true },
  { id: 'python', name: 'Python', icon: '🐍', category: 'backend', description: 'Versatile language', popular: true },
  { id: 'java', name: 'Java', icon: '☕', category: 'backend', description: 'Enterprise-grade', popular: false },
  { id: 'golang', name: 'Go', icon: '🐹', category: 'backend', description: 'Fast and simple', popular: false },
  { id: 'rust', name: 'Rust', icon: '🦀', category: 'backend', description: 'Memory-safe systems', popular: false },
  
  // Database
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', category: 'database', description: 'Advanced SQL database', popular: true },
  { id: 'mongodb', name: 'MongoDB', icon: '🍃', category: 'database', description: 'Document database', popular: true },
  { id: 'mysql', name: 'MySQL', icon: '🐬', category: 'database', description: 'Popular SQL database', popular: false },
  { id: 'redis', name: 'Redis', icon: '🔴', category: 'database', description: 'In-memory cache', popular: false },
  
  // Cloud
  { id: 'aws', name: 'AWS', icon: '☁️', category: 'cloud', description: 'Amazon Web Services', popular: true },
  { id: 'gcp', name: 'Google Cloud', icon: '🌤️', category: 'cloud', description: 'Google Cloud Platform', popular: false },
  { id: 'azure', name: 'Azure', icon: '🔵', category: 'cloud', description: 'Microsoft Azure', popular: false },
  { id: 'docker', name: 'Docker', icon: '🐳', category: 'cloud', description: 'Containerization', popular: true },
];

export default function ProjectCreationWizard({ onComplete, onCancel }: ProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectData, setProjectData] = useState({
    name: '',
    slug: '',
    description: '',
    githubUrl: '',
    selectedTemplate: null as ProjectTemplate | null,
    technologies: [] as string[],
    requirements: '',
    aiRequirements: [] as AIRequirement[],
    generatedFlow: null,
    customizations: {},
    estimatedTime: 0,
    estimatedCost: 0,
    draft: null as any
  });
  
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  
  // Auto-save draft functionality
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Animation states
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-generate slug from project name
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }, []);
  
  // Update slug when name changes
  useEffect(() => {
    if (projectData.name) {
      const newSlug = generateSlug(projectData.name);
      if (newSlug !== projectData.slug) {
        setProjectData(prev => ({ ...prev, slug: newSlug }));
      }
    }
  }, [projectData.name, generateSlug]);
  
  // Auto-save functionality
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (hasUnsavedChanges) {
        localStorage.setItem('wizard-draft', JSON.stringify(projectData));
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    }, 2000);
    
    return () => clearTimeout(saveTimer);
  }, [projectData, hasUnsavedChanges]);
  
  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('wizard-draft');
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        setProjectData(prev => ({ ...prev, ...parsedDraft }));
      } catch (e) {
        console.warn('Failed to load draft:', e);
      }
    }
  }, []);
  
  // Mark changes as unsaved
  const updateProjectData = useCallback((updates: Partial<typeof projectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);
  
  // Validate current step
  const validateStep = useCallback(() => {
    const errors: Record<string, string> = {};
    
    switch (WIZARD_STEPS[currentStep].id) {
      case 'basics':
        if (!projectData.name.trim()) {
          errors.name = 'Project name is required';
        }
        if (!projectData.description.trim()) {
          errors.description = 'Project description is required';
        }
        if (!projectData.selectedTemplate) {
          errors.template = 'Please select a project template';
        }
        break;
        
      case 'planning':
        if (!projectData.requirements.trim()) {
          errors.requirements = 'Requirements are needed to generate the workflow';
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStep, projectData]);
  
  const handleNext = () => {
    if (!validateStep()) return;
    
    if (currentStep === 1 && !projectData.generatedFlow) {
      generatePlan();
    } else if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateAiSuggestions = async (requirements: string) => {
    if (requirements.length < 10) return;
    
    setIsGeneratingSuggestions(true);
    try {
      // TODO: Call AI service for suggestions
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockSuggestions = [
        'Add user authentication and authorization',
        'Implement real-time data synchronization',
        'Include comprehensive unit and integration tests',
        'Set up CI/CD pipeline for automated deployment',
        'Add API rate limiting and security headers'
      ];
      setAiSuggestions(mockSuggestions);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };
  
  const generatePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      // TODO: Call planning service API with enhanced data
      const planData = {
        name: projectData.name,
        description: projectData.description,
        template: projectData.selectedTemplate,
        technologies: projectData.technologies,
        requirements: projectData.requirements
      };
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockFlow = {
        nodes: [],
        edges: [],
        metadata: {
          totalAgents: Math.floor(Math.random() * 8) + 4,
          parallelStages: Math.floor(Math.random() * 3) + 2,
          complexityScore: Math.random() * 10
        }
      };
      
      updateProjectData({
        generatedFlow: mockFlow,
        estimatedTime: Math.floor(Math.random() * 120) + 30,
        estimatedCost: Math.floor(Math.random() * 1000) + 100
      });
      
      setCurrentStep(currentStep + 1);
    } finally {
      setIsGeneratingPlan(false);
    }
  };
  
  const handleTemplateSelect = (template: ProjectTemplate) => {
    updateProjectData({ 
      selectedTemplate: template,
      technologies: template.technologies
    });
  };
  
  const toggleTechnology = (techId: string) => {
    const technologies = projectData.technologies.includes(techId)
      ? projectData.technologies.filter(t => t !== techId)
      : [...projectData.technologies, techId];
    updateProjectData({ technologies });
  };

  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      // Clear draft when creating project
      localStorage.removeItem('wizard-draft');
      
      // Simulate project creation process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show success animation
      setShowSuccess(true);
      
      // Wait for success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onComplete(projectData);
    } finally {
      setIsCreating(false);
    }
  };
  
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'intermediate': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'advanced': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'basics':
        return (
          <div className="space-y-8">
            {/* Project Name & Slug */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectData.name}
                  onChange={(e) => updateProjectData({ name: e.target.value })}
                  className={`w-full px-4 py-3 bg-[#0A0A0A] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all ${
                    validationErrors.name ? 'border-red-500' : 'border-[#262626] focus:border-[#3B82F6]'
                  }`}
                  placeholder="My Amazing Project"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Slug
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-3 bg-[#141414] border border-r-0 border-[#262626] rounded-l-lg text-gray-400 text-sm">
                    /projects/
                  </span>
                  <input
                    type="text"
                    value={projectData.slug}
                    onChange={(e) => updateProjectData({ slug: e.target.value })}
                    className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-r-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
                    placeholder="my-amazing-project"
                  />
                </div>
              </div>
            </div>

            {/* Description with Markdown Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Description *
                </label>
                <button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className="text-sm text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  {isPreviewMode ? 'Edit' : 'Preview'}
                </button>
              </div>
              
              {isPreviewMode ? (
                <div className="w-full min-h-[120px] px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white overflow-auto">
                  <div className="prose prose-invert max-w-none">
                    {projectData.description || <span className="text-gray-500">Nothing to preview...</span>}
                  </div>
                </div>
              ) : (
                <textarea
                  value={projectData.description}
                  onChange={(e) => updateProjectData({ description: e.target.value })}
                  className={`w-full px-4 py-3 bg-[#0A0A0A] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all resize-none h-32 ${
                    validationErrors.description ? 'border-red-500' : 'border-[#262626] focus:border-[#3B82F6]'
                  }`}
                  placeholder="Describe what you want to build... (supports Markdown)"
                />
              )}
              {validationErrors.description && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.description}
                </p>
              )}
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">
                Choose Template *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PROJECT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isSelected = projectData.selectedTemplate?.id === template.id;
                  
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
                        isSelected 
                          ? 'border-[#3B82F6] bg-[#3B82F6]/5 shadow-lg shadow-[#3B82F6]/20' 
                          : 'border-[#262626] hover:border-[#404040] bg-[#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-[#3B82F6] text-white' : 'bg-[#141414] text-gray-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{template.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getComplexityColor(template.complexity)}`}>
                              {template.complexity}
                            </span>
                            {template.estimatedTime > 0 && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {template.estimatedTime}m
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {template.technologies.slice(0, 3).map(tech => (
                            <span key={tech} className="px-2 py-0.5 bg-[#141414] border border-[#262626] rounded text-xs text-gray-300">
                              {tech}
                            </span>
                          ))}
                          {template.technologies.length > 3 && (
                            <span className="text-xs text-gray-500">+{template.technologies.length - 3}</span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {template.features.slice(0, 2).join(', ')}
                          {template.features.length > 2 && `, +${template.features.length - 2} more`}
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-[#3B82F6]/20">
                          <div className="flex items-center gap-2 text-[#3B82F6] text-sm">
                            <Check className="w-4 h-4" />
                            Selected Template
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {validationErrors.template && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.template}
                </p>
              )}
            </div>

            {/* Optional GitHub Import */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHub Repository (Optional)
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={projectData.githubUrl}
                    onChange={(e) => updateProjectData({ githubUrl: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
                    placeholder="https://github.com/user/repo"
                  />
                </div>
                <button className="px-4 py-3 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-all hover:bg-[#141414]">
                  <Upload className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Import existing repository to analyze structure and dependencies
              </p>
            </div>
          </div>
        );


      case 'planning':
        return (
          <div className="space-y-8">
            {/* Technology Stack Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">
                Technology Stack
              </label>
              
              {/* Categories */}
              {['frontend', 'backend', 'database', 'cloud'].map(category => {
                const categoryTechs = TECHNOLOGY_STACKS.filter(t => t.category === category);
                const selectedInCategory = projectData.technologies.filter(tech => 
                  categoryTechs.some(t => t.id === tech)
                ).length;
                
                return (
                  <div key={category} className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-300 capitalize flex items-center gap-2">
                        {category === 'frontend' && <Globe className="w-4 h-4" />}
                        {category === 'backend' && <Code2 className="w-4 h-4" />}
                        {category === 'database' && <Database className="w-4 h-4" />}
                        {category === 'cloud' && <Zap className="w-4 h-4" />}
                        {category}
                      </h4>
                      {selectedInCategory > 0 && (
                        <span className="text-xs text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-1 rounded">
                          {selectedInCategory} selected
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {categoryTechs.map(tech => {
                        const isSelected = projectData.technologies.includes(tech.id);
                        return (
                          <button
                            key={tech.id}
                            onClick={() => toggleTechnology(tech.id)}
                            className={`p-3 border rounded-lg text-left transition-all hover:scale-105 ${
                              isSelected 
                                ? 'border-[#3B82F6] bg-[#3B82F6]/10 shadow-sm' 
                                : 'border-[#262626] hover:border-[#404040] bg-[#0A0A0A]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{tech.icon}</span>
                              <span className={`font-medium text-sm ${
                                isSelected ? 'text-[#3B82F6]' : 'text-white'
                              }`}>
                                {tech.name}
                              </span>
                              {tech.popular && (
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{tech.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Requirements Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Project Requirements *
                </label>
                <button
                  onClick={() => generateAiSuggestions(projectData.requirements)}
                  disabled={isGeneratingSuggestions || projectData.requirements.length < 10}
                  className="text-sm text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-4 h-4" />
                  {isGeneratingSuggestions ? 'Generating...' : 'Get AI Suggestions'}
                </button>
              </div>
              
              <textarea
                value={projectData.requirements}
                onChange={(e) => {
                  updateProjectData({ requirements: e.target.value });
                  if (e.target.value.length > 50) {
                    generateAiSuggestions(e.target.value);
                  }
                }}
                className={`w-full px-4 py-3 bg-[#0A0A0A] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all resize-none h-32 ${
                  validationErrors.requirements ? 'border-red-500' : 'border-[#262626] focus:border-[#3B82F6]'
                }`}
                placeholder="Describe your project requirements in detail...\n\nExample:\n- User authentication with Google OAuth\n- Real-time chat functionality\n- File upload and sharing\n- Mobile-responsive design\n- Admin dashboard with analytics"
              />
              {validationErrors.requirements && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.requirements}
                </p>
              )}
            </div>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="bg-gradient-to-r from-[#3B82F6]/5 to-[#8B5CF6]/5 border border-[#3B82F6]/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-[#3B82F6] mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  AI Suggestions
                </h4>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const updatedRequirements = projectData.requirements + (projectData.requirements ? '\n' : '') + '- ' + suggestion;
                        updateProjectData({ requirements: updatedRequirements });
                      }}
                      className="block w-full text-left p-2 text-sm text-gray-300 hover:text-white hover:bg-[#3B82F6]/10 rounded transition-colors"
                    >
                      <span className="text-[#3B82F6]">+</span> {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generation Status */}
            {isGeneratingPlan ? (
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-8">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin"></div>
                    <Brain className="w-6 h-6 text-[#3B82F6] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="mt-4 text-white font-medium">AI is analyzing your requirements...</p>
                  <p className="mt-2 text-sm text-gray-400">Generating optimized workflow</p>
                  <div className="mt-4 w-64 h-1 bg-[#262626] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                </div>
              </div>
            ) : projectData.generatedFlow ? (
              <div className="space-y-4">
                {/* Generated Plan Overview */}
                <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <h3 className="text-white font-medium">Workflow Generated Successfully!</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white">{projectData.generatedFlow.metadata?.totalAgents || 8}</div>
                      <div className="text-xs text-gray-400">AI Agents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white">{projectData.estimatedTime}m</div>
                      <div className="text-xs text-gray-400">Est. Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white">{projectData.generatedFlow.metadata?.parallelStages || 3}</div>
                      <div className="text-xs text-gray-400">Parallel Stages</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white">${projectData.estimatedCost}</div>
                      <div className="text-xs text-gray-400">Est. Cost</div>
                    </div>
                  </div>
                </div>

                {/* Workflow Preview */}
                <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Workflow className="w-4 h-4" />
                    Workflow Overview
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['Setup & Configuration', 'Development Phase', 'Testing & Quality', 'Deployment & Launch'].map((stage, index) => (
                      <div key={stage} className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg">
                        <div className="w-8 h-8 bg-[#3B82F6] rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{stage}</div>
                          <div className="text-xs text-gray-400">{Math.floor(Math.random() * 3) + 2} agents</div>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-[#262626] rounded-lg">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Complete the requirements to generate your workflow</p>
                <p className="text-sm text-gray-500 mt-1">AI will analyze and create an optimized execution plan</p>
              </div>
            )}
          </div>
        );

      case 'customization':
        return (
          <div className="space-y-8">
            {/* Mini Flow Editor Preview */}
            <div>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Workflow Customization
              </h3>
              
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-6 min-h-[300px]">
                <div className="text-center py-12">
                  <Workflow className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">Interactive Flow Editor</p>
                  <p className="text-sm text-gray-500 mb-6">Drag and drop to customize your workflow</p>
                  
                  {/* Mock Node Elements */}
                  <div className="flex justify-center items-center gap-4 mb-6">
                    <div className="w-32 h-20 bg-[#3B82F6]/20 border border-[#3B82F6] rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Code2 className="w-6 h-6 text-[#3B82F6] mx-auto mb-1" />
                        <div className="text-xs text-[#3B82F6]">Setup</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <div className="w-32 h-20 bg-green-500/20 border border-green-500 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Layers className="w-6 h-6 text-green-500 mx-auto mb-1" />
                        <div className="text-xs text-green-500">Build</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <div className="w-32 h-20 bg-yellow-500/20 border border-yellow-500 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <CheckCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                        <div className="text-xs text-yellow-500">Test</div>
                      </div>
                    </div>
                  </div>
                  
                  <button className="px-6 py-3 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2 mx-auto">
                    <Edit3 className="w-4 h-4" />
                    Open Advanced Editor
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Configuration Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Execution Options */}
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Execution Settings
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'retries', label: 'Enable automatic retries', checked: true },
                    { key: 'parallel', label: 'Run tests in parallel', checked: true },
                    { key: 'notifications', label: 'Real-time notifications', checked: false },
                    { key: 'rollback', label: 'Auto-rollback on failure', checked: false }
                  ].map((option) => (
                    <label key={option.key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{option.label}</span>
                      <input 
                        type="checkbox" 
                        defaultChecked={option.checked}
                        className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#404040] rounded focus:ring-[#3B82F6] focus:ring-2" 
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Quality Options */}
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Quality Assurance
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'review', label: 'Add manual review checkpoints', checked: false },
                    { key: 'docs', label: 'Generate documentation', checked: true },
                    { key: 'security', label: 'Security vulnerability scanning', checked: true },
                    { key: 'performance', label: 'Performance benchmarking', checked: false }
                  ].map((option) => (
                    <label key={option.key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{option.label}</span>
                      <input 
                        type="checkbox" 
                        defaultChecked={option.checked}
                        className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#404040] rounded focus:ring-[#3B82F6] focus:ring-2" 
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Agent Management */}
            <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Agent Configuration
                </h4>
                <button className="text-sm text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Agent
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {['Setup Agent', 'Frontend Agent', 'Backend Agent', 'Test Agent', 'Deploy Agent'].map((agent, index) => (
                  <div key={agent} className="flex items-center justify-between p-3 bg-[#141414] rounded-lg group hover:bg-[#1A1A1A] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#3B82F6] rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-white">{agent}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-[#262626] rounded text-gray-400 hover:text-white">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button className="p-1 hover:bg-[#262626] rounded text-gray-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-8">
            {/* Project Overview */}
            <div className="bg-gradient-to-r from-[#3B82F6]/5 to-[#8B5CF6]/5 border border-[#3B82F6]/20 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#3B82F6] rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{projectData.name || 'Untitled Project'}</h3>
                  <p className="text-sm text-gray-400">/{projectData.slug}</p>
                </div>
              </div>
              
              <p className="text-gray-300 mb-4">{projectData.description || 'No description provided'}</p>
              
              {projectData.selectedTemplate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Template:</span>
                  <span className="px-2 py-1 bg-[#3B82F6]/20 text-[#3B82F6] rounded">{projectData.selectedTemplate.name}</span>
                </div>
              )}
            </div>

            {/* Technology Stack */}
            <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
              <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Technology Stack
              </h4>
              {projectData.technologies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projectData.technologies.map(techId => {
                    const tech = TECHNOLOGY_STACKS.find(t => t.id === techId);
                    if (!tech) return null;
                    return (
                      <div key={techId} className="flex items-center gap-2 px-3 py-2 bg-[#141414] border border-[#262626] rounded-lg">
                        <span className="text-lg">{tech.icon}</span>
                        <span className="text-sm text-gray-300">{tech.name}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No technologies selected</p>
              )}
            </div>

            {/* Execution Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Execution Timeline
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Total Agents:</span>
                    <span className="text-white font-medium">{projectData.generatedFlow?.metadata?.totalAgents || 8}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Estimated Time:</span>
                    <span className="text-white font-medium">{projectData.estimatedTime || 90} minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Parallel Stages:</span>
                    <span className="text-white font-medium">{projectData.generatedFlow?.metadata?.parallelStages || 3}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Estimated Cost:</span>
                    <span className="text-white font-medium">${projectData.estimatedCost || 150}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Resource Requirements
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-sm text-gray-300">CPU: Moderate usage expected</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-sm text-gray-300">Memory: 2-4 GB recommended</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span className="text-sm text-gray-300">Network: API calls required</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span className="text-sm text-gray-300">Storage: ~500 MB workspace</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Requirements Summary */}
            {projectData.requirements && (
              <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Project Requirements
                </h4>
                <div className="bg-[#141414] rounded p-3 text-sm text-gray-300 max-h-32 overflow-y-auto">
                  {projectData.requirements.split('\n').map((line, index) => (
                    <div key={index} className="mb-1">{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Ready to Launch */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-600/30 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold text-lg mb-1">Ready to Launch!</h4>
                  <p className="text-green-200">Your project configuration is complete and ready for execution.</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {Math.round((projectData.estimatedTime || 90) / 60 * 10) / 10}h
                  </div>
                  <div className="text-xs text-green-300">estimated</div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-green-600/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-200">Auto-save: {lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'No draft saved'}</span>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 text-green-200 hover:text-white">
                      <Download className="w-4 h-4" />
                      Export Config
                    </button>
                    <button className="flex items-center gap-2 text-green-200 hover:text-white">
                      <Copy className="w-4 h-4" />
                      Share Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="modal bg-black border border-[#262626] rounded-xl w-full max-w-4xl max-h-[95vh] overflow-auto shadow-2xl flex flex-col" role="dialog">
        {/* Enhanced Header */}
        <div className="border-b border-[#262626] p-6 bg-gradient-to-r from-[#0A0A0A] to-[#141414]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3B82F6] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                Create New Project
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Let AI help you build your project from idea to deployment
              </p>
            </div>
            
            {/* Auto-save Indicator */}
            {lastSaved && (
              <div className="text-right">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Save className="w-3 h-3" />
                  Auto-saved {lastSaved.toLocaleTimeString()}
                </div>
                {hasUnsavedChanges && (
                  <div className="text-xs text-yellow-400 mt-1">Unsaved changes</div>
                )}
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progress</span>
              <span className="text-sm text-[#3B82F6] font-medium">
                {Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100)}% complete
              </span>
            </div>
            <div className="w-full h-2 bg-[#262626] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Enhanced Step Indicators */}
          <div className="grid grid-cols-4 gap-4">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isUpcoming = index > currentStep;
              
              return (
                <div 
                  key={step.id} 
                  className={`relative p-4 rounded-lg border transition-all duration-300 ${
                    isActive 
                      ? 'border-[#3B82F6] bg-[#3B82F6]/5 shadow-lg shadow-[#3B82F6]/20' 
                      : isCompleted
                      ? 'border-green-600 bg-green-600/5'
                      : 'border-[#262626] bg-[#0A0A0A]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive 
                        ? 'bg-[#3B82F6] text-white scale-110' 
                        : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-[#262626] text-gray-500'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium text-sm truncate ${
                        isActive ? 'text-[#3B82F6]' : isCompleted ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </div>
                      <div className={`text-xs truncate ${
                        isActive ? 'text-[#3B82F6]/70' : 'text-gray-500'
                      }`}>
                        {step.subtitle}
                      </div>
                    </div>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#3B82F6] rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 280px)' }}>
          {Object.keys(validationErrors).length > 0 && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-600/50 rounded-lg" role="alert">
              <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                Please fix the following errors:
              </div>
              <ul className="space-y-1 text-sm text-red-300">
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field} className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-red-400 rounded-full" />
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div 
            key={currentStep} 
            className="animate-in slide-in-from-right-10 duration-300 fade-in"
          >
            {renderStepContent()}
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="border-t border-[#262626] bg-gradient-to-r from-[#0A0A0A] to-[#141414] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all hover:bg-[#262626] rounded-lg flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              
              {/* Step info */}
              <div className="text-sm text-gray-500">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-6 py-3 border border-[#262626] rounded-lg text-white hover:border-[#404040] transition-all hover:bg-[#141414] flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
              
              {currentStep < WIZARD_STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={isGeneratingPlan || isGeneratingSuggestions}
                  className="px-8 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white rounded-lg hover:from-[#60A5FA] hover:to-[#A78BFA] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg shadow-[#3B82F6]/25"
                >
                  {currentStep === 1 && !projectData.generatedFlow ? (
                    isGeneratingPlan ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        Generate Plan
                        <Sparkles className="w-4 h-4" />
                      </>
                    )
                  ) : (
                    <>
                      Next: {WIZARD_STEPS[currentStep + 1]?.title}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 font-medium shadow-lg shadow-green-600/25"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Project...
                    </>
                  ) : showSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 animate-pulse" />
                      Success!
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Create Project
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Success Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/90 to-emerald-600/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Project Created!</h3>
              <p className="text-green-100">Redirecting to your new workflow...</p>
              <div className="mt-4 flex justify-center">
                <div className="w-8 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full animate-pulse" style={{width: '100%'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}