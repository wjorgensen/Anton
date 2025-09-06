'use client';

import React, { useState, useMemo } from 'react';
import {
  Layout,
  Search,
  Star,
  Download,
  Upload,
  Copy,
  Eye,
  Heart,
  Users,
  Clock,
  Tag,
  TrendingUp,
  Filter,
  Grid3X3,
  List,
  Plus,
  Check,
  X,
  ChevronRight,
  Globe,
  Lock,
  Shield,
  Zap,
  Code2,
  Database,
  Smartphone
} from 'lucide-react';

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  authorAvatar?: string;
  createdAt: Date;
  updatedAt: Date;
  downloads: number;
  likes: number;
  rating: number;
  reviews: number;
  isPublic: boolean;
  isPremium: boolean;
  isOfficial: boolean;
  tags: string[];
  preview: {
    nodeCount: number;
    estimatedTime: number;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    technologies: string[];
  };
  thumbnail?: string;
}

interface TemplateLibraryProps {
  templates: FlowTemplate[];
  userTemplates: FlowTemplate[];
  onUseTemplate: (templateId: string) => void;
  onPreviewTemplate: (templateId: string) => void;
  onExportTemplate: (templateId: string) => void;
  onImportTemplate: (file: File) => void;
  onCreateTemplate: () => void;
}

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Grid3X3 },
  { id: 'web', name: 'Web Applications', icon: Globe },
  { id: 'api', name: 'APIs & Backend', icon: Code2 },
  { id: 'mobile', name: 'Mobile Apps', icon: Smartphone },
  { id: 'data', name: 'Data & Analytics', icon: Database },
  { id: 'automation', name: 'Automation', icon: Zap },
  { id: 'official', name: 'Official', icon: Shield },
];

export default function TemplateLibrary({
  templates,
  userTemplates,
  onUseTemplate,
  onPreviewTemplate,
  onExportTemplate,
  onImportTemplate,
  onCreateTemplate
}: TemplateLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  const [showUserTemplates, setShowUserTemplates] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [complexityFilter, setComplexityFilter] = useState<string>('all');

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    [...templates, ...userTemplates].forEach(t => {
      t.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [templates, userTemplates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = showUserTemplates ? userTemplates : templates;

    // Category filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'official') {
        filtered = filtered.filter(t => t.isOfficial);
      } else {
        filtered = filtered.filter(t => t.category === selectedCategory);
      }
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Tag filter
    if (selectedTags.size > 0) {
      filtered = filtered.filter(t => 
        t.tags.some(tag => selectedTags.has(tag))
      );
    }

    // Complexity filter
    if (complexityFilter !== 'all') {
      filtered = filtered.filter(t => t.preview.complexity === complexityFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads;
        case 'recent':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, userTemplates, showUserTemplates, selectedCategory, searchQuery, selectedTags, complexityFilter, sortBy]);

  const getCategoryIcon = (category: string) => {
    const cat = TEMPLATE_CATEGORIES.find(c => c.id === category);
    return cat ? cat.icon : Grid3X3;
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner':
        return 'text-green-400 bg-green-400/10';
      case 'intermediate':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'advanced':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const TemplateCard = ({ template }: { template: FlowTemplate }) => (
    <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg overflow-hidden hover:border-[#3B82F6]/50 transition-all cursor-pointer group">
      {/* Thumbnail */}
      {template.thumbnail ? (
        <img 
          src={template.thumbnail} 
          alt={template.name}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-[#141414] to-[#0A0A0A] flex items-center justify-center">
          {React.createElement(getCategoryIcon(template.category), { 
            className: "w-12 h-12 text-gray-600" 
          })}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-medium">{template.name}</h3>
              {template.isOfficial && (
                <Shield className="w-4 h-4 text-[#3B82F6]" title="Official Template" />
              )}
              {template.isPremium && (
                <Zap className="w-4 h-4 text-yellow-400" title="Premium Template" />
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{template.description}</p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Toggle like
            }}
            className="p-1 hover:bg-[#141414] rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Heart className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>

        {/* Complexity & Technologies */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getComplexityColor(template.preview.complexity)}`}>
            {template.preview.complexity}
          </span>
          {template.preview.technologies.slice(0, 2).map(tech => (
            <span key={tech} className="px-2 py-0.5 bg-[#141414] border border-[#262626] rounded text-xs text-gray-300">
              {tech}
            </span>
          ))}
          {template.preview.technologies.length > 2 && (
            <span className="text-xs text-gray-500">+{template.preview.technologies.length - 2}</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {template.downloads}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {template.likes}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {template.rating.toFixed(1)}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {template.preview.estimatedTime}m
          </span>
        </div>

        {/* Author */}
        <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white">
              {template.author[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-400">{template.author}</span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreviewTemplate(template.id);
              }}
              className="p-1.5 hover:bg-[#141414] rounded text-gray-400 hover:text-white"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUseTemplate(template.id);
              }}
              className="p-1.5 bg-[#3B82F6] text-white rounded hover:bg-[#60A5FA]"
              title="Use Template"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Template Library</h1>
          
          <div className="flex items-center gap-2">
            <label className="relative">
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && onImportTemplate(e.target.files[0])}
                className="hidden"
              />
              <button className="px-4 py-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                Import
              </button>
            </label>
            
            <button
              onClick={onCreateTemplate}
              className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
              />
            </div>

            {/* Template Type Toggle */}
            <div className="flex border border-[#262626] rounded-lg">
              <button
                onClick={() => setShowUserTemplates(false)}
                className={`px-4 py-2 ${!showUserTemplates ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
              >
                Public
              </button>
              <button
                onClick={() => setShowUserTemplates(true)}
                className={`px-4 py-2 ${showUserTemplates ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
              >
                My Templates
              </button>
            </div>

            {/* Complexity Filter */}
            <select
              value={complexityFilter}
              onChange={(e) => setComplexityFilter(e.target.value)}
              className="px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="popular">Most Popular</option>
              <option value="recent">Most Recent</option>
              <option value="rating">Highest Rated</option>
            </select>

            {/* View Mode */}
            <div className="flex border border-[#262626] rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-400">Popular tags:</span>
              {allTags.slice(0, 10).map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    const newTags = new Set(selectedTags);
                    if (newTags.has(tag)) {
                      newTags.delete(tag);
                    } else {
                      newTags.add(tag);
                    }
                    setSelectedTags(newTags);
                  }}
                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                    selectedTags.has(tag)
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#141414] text-gray-400 hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-56 border-r border-[#262626] p-4 overflow-y-auto">
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-3">Categories</h3>
          <div className="space-y-1">
            {TEMPLATE_CATEGORIES.map(category => {
              const Icon = category.icon;
              const count = category.id === 'all' 
                ? filteredTemplates.length
                : filteredTemplates.filter(t => 
                    category.id === 'official' ? t.isOfficial : t.category === category.id
                  ).length;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                      : 'text-gray-400 hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <span className="text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Grid/List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Layout className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
              <p className="text-sm text-gray-400 mb-4">
                Try adjusting your filters or search query
              </p>
              <button
                onClick={onCreateTemplate}
                className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors"
              >
                Create Your First Template
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            // List view would go here
            <div className="space-y-2">
              {filteredTemplates.map(template => (
                <div key={template.id} className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                  {/* List item implementation */}
                  <p className="text-white">{template.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}