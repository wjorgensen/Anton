'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  TrendingUp,
  Star,
  Download,
  Heart,
  MessageCircle,
  Shield,
  Zap,
  Code2,
  Users,
  Calendar,
  Tag,
  Award,
  GitBranch,
  Eye,
  Copy,
  ExternalLink,
  ChevronRight,
  Bot,
  Sparkles,
  DollarSign,
  CheckCircle
} from 'lucide-react';

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  author: {
    name: string;
    avatar?: string;
    verified: boolean;
    reputation: number;
  };
  version: string;
  createdAt: Date;
  updatedAt: Date;
  downloads: number;
  likes: number;
  rating: number;
  reviews: Review[];
  pricing: {
    type: 'free' | 'paid' | 'subscription';
    price?: number;
    currency?: string;
  };
  tags: string[];
  isOfficial: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  dependencies: string[];
  performance: {
    avgExecutionTime: number;
    avgTokenUsage: number;
    successRate: number;
  };
  screenshots?: string[];
  documentation?: string;
  license: string;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: Date;
}

interface AgentMarketplaceProps {
  agents: MarketplaceAgent[];
  installedAgents: string[];
  onInstall: (agentId: string) => void;
  onUninstall: (agentId: string) => void;
  onPreview: (agentId: string) => void;
  onRate: (agentId: string, rating: number) => void;
}

const CATEGORIES = [
  { id: 'all', name: 'All Agents', icon: Bot, count: 0 },
  { id: 'featured', name: 'Featured', icon: Award, count: 0 },
  { id: 'trending', name: 'Trending', icon: TrendingUp, count: 0 },
  { id: 'setup', name: 'Setup & Config', icon: Settings, count: 0 },
  { id: 'execution', name: 'Code Execution', icon: Code2, count: 0 },
  { id: 'testing', name: 'Testing & QA', icon: CheckCircle, count: 0 },
  { id: 'integration', name: 'Integration', icon: GitBranch, count: 0 },
  { id: 'utility', name: 'Utilities', icon: Zap, count: 0 }
];

export default function AgentMarketplace({
  agents,
  installedAgents,
  onInstall,
  onUninstall,
  onPreview,
  onRate
}: AgentMarketplaceProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent' | 'price'>('popular');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = agents;

    // Category filter
    if (selectedCategory === 'featured') {
      filtered = filtered.filter(a => a.isFeatured);
    } else if (selectedCategory === 'trending') {
      // Sort by recent downloads/likes growth
      filtered = [...filtered].sort((a, b) => b.downloads - a.downloads).slice(0, 20);
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Price filter
    if (priceFilter === 'free') {
      filtered = filtered.filter(a => a.pricing.type === 'free');
    } else if (priceFilter === 'paid') {
      filtered = filtered.filter(a => a.pricing.type !== 'free');
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'recent':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'price':
          const priceA = a.pricing.price || 0;
          const priceB = b.pricing.price || 0;
          return priceA - priceB;
        default:
          return 0;
      }
    });

    return filtered;
  }, [agents, selectedCategory, searchQuery, priceFilter, sortBy]);

  const isInstalled = (agentId: string) => installedAgents.includes(agentId);

  const getRatingStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }
    if (hasHalfStar && stars.length < 5) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />);
    }
    while (stars.length < 5) {
      stars.push(<Star key={stars.length} className="w-4 h-4 text-gray-600" />);
    }
    return stars;
  };

  const AgentCard = ({ agent }: { agent: MarketplaceAgent }) => {
    const installed = isInstalled(agent.id);

    return (
      <div
        className="bg-[#0A0A0A] border border-[#262626] rounded-lg overflow-hidden hover:border-[#3B82F6]/50 transition-all cursor-pointer group"
        onClick={() => setSelectedAgent(agent)}
      >
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">{agent.name}</h3>
                  {agent.isOfficial && (
                    <Shield className="w-4 h-4 text-[#3B82F6]" title="Official" />
                  )}
                  {agent.isVerified && (
                    <CheckCircle className="w-4 h-4 text-green-400" title="Verified" />
                  )}
                  {agent.isFeatured && (
                    <Sparkles className="w-4 h-4 text-yellow-400" title="Featured" />
                  )}
                </div>
                <p className="text-xs text-gray-400">by {agent.author.name}</p>
              </div>
            </div>
            
            {/* Price Badge */}
            {agent.pricing.type === 'free' ? (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                Free
              </span>
            ) : (
              <span className="px-2 py-1 bg-[#3B82F6]/20 text-[#3B82F6] text-xs rounded-full">
                ${agent.pricing.price}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-400 line-clamp-2 mb-3">{agent.description}</p>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {agent.downloads.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {agent.likes}
              </span>
              <span className="flex items-center gap-1">
                {getRatingStars(agent.rating)}
                <span className="ml-1">{agent.rating.toFixed(1)}</span>
              </span>
            </div>
            <span>v{agent.version}</span>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#141414] rounded p-2 text-center">
              <p className="text-xs text-gray-500">Speed</p>
              <p className="text-sm text-white">{agent.performance.avgExecutionTime}s</p>
            </div>
            <div className="bg-[#141414] rounded p-2 text-center">
              <p className="text-xs text-gray-500">Tokens</p>
              <p className="text-sm text-white">{agent.performance.avgTokenUsage}</p>
            </div>
            <div className="bg-[#141414] rounded p-2 text-center">
              <p className="text-xs text-gray-500">Success</p>
              <p className="text-sm text-white">{agent.performance.successRate}%</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-[#141414] text-gray-400 text-xs rounded">
                {tag}
              </span>
            ))}
            {agent.tags.length > 3 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">+{agent.tags.length - 3}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {installed ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUninstall(agent.id);
                }}
                className="flex-1 px-3 py-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors text-sm"
              >
                Uninstall
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInstall(agent.id);
                }}
                className="flex-1 px-3 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors text-sm"
              >
                Install
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(agent.id);
              }}
              className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Marketplace</h1>
            <p className="text-sm text-gray-400 mt-1">Discover and install community agents</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-[#3B82F6]/20 text-[#3B82F6] text-sm rounded-lg">
              {filteredAgents.length} agents available
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
            />
          </div>

          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value as any)}
            className="px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="all">All Prices</option>
            <option value="free">Free Only</option>
            <option value="paid">Paid Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="recent">Recently Updated</option>
            <option value="price">Price: Low to High</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                : 'border-[#262626] text-gray-400 hover:text-white hover:border-[#404040]'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded" />
                <span className="text-sm text-gray-400">Official Only</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded" />
                <span className="text-sm text-gray-400">Verified Authors</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded" />
                <span className="text-sm text-gray-400">4+ Stars</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded" />
                <span className="text-sm text-gray-400">No Dependencies</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-56 border-r border-[#262626] p-4 overflow-y-auto">
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-3">Categories</h3>
          <div className="space-y-1">
            {CATEGORIES.map(category => {
              const Icon = category.icon;
              const count = category.id === 'all'
                ? filteredAgents.length
                : category.id === 'featured'
                  ? filteredAgents.filter(a => a.isFeatured).length
                  : category.id === 'trending'
                    ? 20
                    : filteredAgents.filter(a => a.category === category.id).length;

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

          {/* Top Authors */}
          <div className="mt-6">
            <h3 className="text-xs font-medium text-gray-400 uppercase mb-3">Top Authors</h3>
            <div className="space-y-2">
              {['Anton Team', 'Community', 'Claude Labs'].map(author => (
                <button
                  key={author}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#141414] rounded-lg transition-colors"
                >
                  <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white">
                    {author[0]}
                  </div>
                  <span>{author}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Bot className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No agents found</h3>
              <p className="text-sm text-gray-400">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black border border-[#262626] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal content would go here */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white">{selectedAgent.name}</h2>
              <button
                onClick={() => setSelectedAgent(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}