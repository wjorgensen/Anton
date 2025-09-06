'use client';

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Tag,
  Filter,
  X,
  Plus,
  Bookmark,
  Trash2,
  Settings,
  RefreshCw,
  Download,
  ChevronDown,
  Check
} from 'lucide-react';
import { FilterPreset } from '@/store/dashboardStore';

interface FilterPanelProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  // Status filters
  statusFilters: string[];
  availableStatuses: Array<{ value: string; label: string; count: number }>;
  onStatusFilterChange: (statuses: string[]) => void;
  
  // Tag filters
  tagFilters: string[];
  availableTags: Array<{ value: string; label: string; count: number }>;
  onTagFilterChange: (tags: string[]) => void;
  
  // Technology filters
  technologyFilters: string[];
  availableTechnologies: Array<{ value: string; label: string; count: number }>;
  onTechnologyFilterChange: (technologies: string[]) => void;
  
  // Date range
  dateRange?: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date } | undefined) => void;
  
  // Filter presets
  filterPresets: FilterPreset[];
  activePreset: string | null;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  
  // Actions
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const FilterSection = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#262626] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] 
                   hover:bg-[#202020] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {icon}
          {title}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>
      {isOpen && (
        <div className="p-3 bg-[#0F0F0F] border-t border-[#262626]">
          {children}
        </div>
      )}
    </div>
  );
};

const CheckboxOption = ({ 
  label, 
  count, 
  checked, 
  onChange 
}: { 
  label: string; 
  count: number; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex items-center justify-between p-2 rounded hover:bg-[#1a1a1a] 
                    transition-colors cursor-pointer group">
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#404040] rounded 
                   focus:ring-[#3B82F6] focus:ring-offset-0"
      />
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
        {label}
      </span>
    </div>
    <span className="text-xs text-gray-500 bg-[#1a1a1a] px-2 py-0.5 rounded">
      {count}
    </span>
  </label>
);

export default function FilterPanel({
  isOpen,
  searchQuery,
  onSearchChange,
  statusFilters,
  availableStatuses,
  onStatusFilterChange,
  tagFilters,
  availableTags,
  onTagFilterChange,
  technologyFilters,
  availableTechnologies,
  onTechnologyFilterChange,
  dateRange,
  onDateRangeChange,
  filterPresets,
  activePreset,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onClearFilters,
  hasActiveFilters
}: FilterPanelProps) {
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [selectedQuickRange, setSelectedQuickRange] = useState<string>('');

  if (!isOpen) return null;

  const handleStatusChange = (status: string, checked: boolean) => {
    if (checked) {
      onStatusFilterChange([...statusFilters, status]);
    } else {
      onStatusFilterChange(statusFilters.filter(s => s !== status));
    }
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    if (checked) {
      onTagFilterChange([...tagFilters, tag]);
    } else {
      onTagFilterChange(tagFilters.filter(t => t !== tag));
    }
  };

  const handleTechnologyChange = (tech: string, checked: boolean) => {
    if (checked) {
      onTechnologyFilterChange([...technologyFilters, tech]);
    } else {
      onTechnologyFilterChange(technologyFilters.filter(t => t !== tech));
    }
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim());
      setPresetName('');
      setShowPresetInput(false);
    }
  };

  const handleQuickDateRange = (range: string) => {
    setSelectedQuickRange(range);
    const now = new Date();
    let start: Date;
    
    switch (range) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        onDateRangeChange({ start, end: new Date() });
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        onDateRangeChange({ start, end: new Date() });
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        onDateRangeChange({ start, end: new Date() });
        break;
      case 'quarter':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        onDateRangeChange({ start, end: new Date() });
        break;
      default:
        onDateRangeChange(undefined);
        break;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#0A0A0A] border-l border-[#262626] 
                    shadow-2xl transform transition-transform duration-300 ease-out z-50
                    overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#0A0A0A] border-b border-[#262626] p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-semibold text-white">Filters</h2>
          </div>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-red-400 hover:text-red-300 transition-colors
                         px-2 py-1 rounded border border-red-400/30 hover:border-red-300/50"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#404040] rounded-lg 
                       text-white placeholder-gray-500 focus:border-[#3B82F6] focus:outline-none 
                       focus:ring-1 focus:ring-[#3B82F6]/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 
                         hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Presets */}
      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-yellow-400" />
              Saved Filters
            </h3>
            <button
              onClick={() => setShowPresetInput(!showPresetInput)}
              className="text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showPresetInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#404040] rounded 
                           text-sm text-white placeholder-gray-500 focus:border-[#3B82F6] 
                           focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <button
                onClick={handleSavePreset}
                className="px-3 py-1.5 bg-[#3B82F6] text-white rounded text-sm 
                           hover:bg-[#60A5FA] transition-colors"
              >
                Save
              </button>
            </div>
          )}

          <div className="space-y-2">
            {filterPresets.map((preset) => (
              <div
                key={preset.id}
                className={`flex items-center justify-between p-2 rounded border transition-all
                           ${activePreset === preset.id 
                             ? 'bg-[#3B82F6]/10 border-[#3B82F6]/30' 
                             : 'bg-[#1a1a1a] border-[#404040] hover:border-[#606060]'
                           }`}
              >
                <button
                  onClick={() => onApplyPreset(preset.id)}
                  className="flex-1 text-left text-sm text-gray-300 hover:text-white 
                             transition-colors"
                >
                  {preset.name}
                </button>
                {!preset.id.startsWith('active-projects') && !preset.id.startsWith('completed-today') && (
                  <button
                    onClick={() => onDeletePreset(preset.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Filter Sections */}
        <div className="space-y-4">
          {/* Status Filter */}
          <FilterSection
            title="Status"
            icon={<Settings className="w-4 h-4" />}
            defaultOpen={true}
          >
            <div className="space-y-1">
              {availableStatuses.map((status) => (
                <CheckboxOption
                  key={status.value}
                  label={status.label}
                  count={status.count}
                  checked={statusFilters.includes(status.value)}
                  onChange={(checked) => handleStatusChange(status.value, checked)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Technology Filter */}
          <FilterSection
            title="Technology Stack"
            icon={<Tag className="w-4 h-4" />}
          >
            <div className="space-y-1">
              {availableTechnologies.map((tech) => (
                <CheckboxOption
                  key={tech.value}
                  label={tech.label}
                  count={tech.count}
                  checked={technologyFilters.includes(tech.value)}
                  onChange={(checked) => handleTechnologyChange(tech.value, checked)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Tags Filter */}
          <FilterSection
            title="Project Tags"
            icon={<Tag className="w-4 h-4" />}
          >
            <div className="space-y-1">
              {availableTags.map((tag) => (
                <CheckboxOption
                  key={tag.value}
                  label={tag.label}
                  count={tag.count}
                  checked={tagFilters.includes(tag.value)}
                  onChange={(checked) => handleTagChange(tag.value, checked)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Date Range Filter */}
          <FilterSection
            title="Date Range"
            icon={<Calendar className="w-4 h-4" />}
          >
            <div className="space-y-3">
              {/* Quick Date Ranges */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'This Week', value: 'week' },
                  { label: 'This Month', value: 'month' },
                  { label: 'This Quarter', value: 'quarter' }
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() => handleQuickDateRange(range.value)}
                    className={`px-3 py-2 text-xs rounded border transition-all
                               ${selectedQuickRange === range.value
                                 ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                                 : 'bg-[#1a1a1a] border-[#404040] text-gray-300 hover:border-[#606060]'
                               }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-400">
                  Custom Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange?.start.toISOString().split('T')[0] || ''}
                    onChange={(e) => {
                      const start = new Date(e.target.value);
                      onDateRangeChange(dateRange ? { ...dateRange, start } : { start, end: new Date() });
                    }}
                    className="flex-1 px-2 py-1.5 bg-[#1a1a1a] border border-[#404040] rounded 
                               text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                  />
                  <input
                    type="date"
                    value={dateRange?.end.toISOString().split('T')[0] || ''}
                    onChange={(e) => {
                      const end = new Date(e.target.value);
                      onDateRangeChange(dateRange ? { ...dateRange, end } : { start: new Date(), end });
                    }}
                    className="flex-1 px-2 py-1.5 bg-[#1a1a1a] border border-[#404040] rounded 
                               text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
                {dateRange && (
                  <button
                    onClick={() => {
                      onDateRangeChange(undefined);
                      setSelectedQuickRange('');
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear date range
                  </button>
                )}
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-6 p-3 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg">
            <h4 className="text-sm font-medium text-[#3B82F6] mb-2">Active Filters</h4>
            <div className="space-y-1 text-xs text-gray-300">
              {searchQuery && (
                <div>Search: "{searchQuery}"</div>
              )}
              {statusFilters.length > 0 && (
                <div>Status: {statusFilters.join(', ')}</div>
              )}
              {tagFilters.length > 0 && (
                <div>Tags: {tagFilters.join(', ')}</div>
              )}
              {technologyFilters.length > 0 && (
                <div>Tech: {technologyFilters.join(', ')}</div>
              )}
              {dateRange && (
                <div>
                  Date: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}