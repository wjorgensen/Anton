'use client';

import React, { useEffect, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import DashboardHeader from './DashboardHeader';
import FilterPanel from './FilterPanel';
import ProjectCard from './ProjectCard';
import ProjectListView from './ProjectListView';
import EmptyState from './EmptyState';
import { DashboardSkeleton } from '@/components/LoadingSkeletons';
import { Grid3X3, List, ChevronLeft, ChevronRight } from 'lucide-react';

interface EnhancedDashboardProps {
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  apiClient?: any;
}

export default function EnhancedDashboard({
  onCreateProject,
  onSelectProject,
  apiClient
}: EnhancedDashboardProps) {
  const {
    // Data
    projects,
    stats,
    
    // UI State
    viewMode,
    searchQuery,
    selectedProjects,
    
    // Filtering
    activeFilters,
    filterPresets,
    activeFilterPreset,
    showFilterPanel,
    
    // Sorting
    sortBy,
    sortOrder,
    
    // Loading states
    isLoading,
    isLoadingStats,
    error,
    
    // Actions
    setViewMode,
    setSearchQuery,
    toggleProjectSelection,
    selectAllProjects,
    clearSelection,
    
    // Filtering actions
    setStatusFilter,
    setTagsFilter,
    setTechnologyFilter,
    setDateRangeFilter,
    clearFilters,
    saveFilterPreset,
    applyFilterPreset,
    deleteFilterPreset,
    toggleFilterPanel,
    
    // Sorting actions
    setSortBy,
    
    // Data actions
    refreshData,
    toggleProjectFavorite,
    deleteProjects,
    duplicateProject,
    archiveProjects,
    
    // Computed getters
    getFilteredProjects,
    getProjectStats,
    hasActiveFilters
  } = useDashboardStore();

  // Load initial data
  useEffect(() => {
    refreshData();
  }, []);

  // Get computed values - MUST be before any conditional returns
  const filteredProjects = useMemo(() => getFilteredProjects(), [
    projects,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder
  ]);

  const dashboardStats = useMemo(() => getProjectStats(), [projects]);

  // Update stats when projects change
  useEffect(() => {
    if (projects.length > 0) {
      // Set computed stats
      useDashboardStore.getState().setStats(dashboardStats);
    }
  }, [projects, dashboardStats]);

  // Generate filter options from current projects
  const filterOptions = useMemo(() => {
    const statusCounts = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tagCounts = projects.reduce((acc, project) => {
      project.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const techCounts = projects.reduce((acc, project) => {
      [project.technology.frontend, project.technology.backend, project.technology.database]
        .filter(Boolean)
        .forEach(tech => {
          acc[tech] = (acc[tech] || 0) + 1;
        });
      return acc;
    }, {} as Record<string, number>);

    return {
      statuses: Object.entries(statusCounts).map(([value, count]) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        count
      })),
      tags: Object.entries(tagCounts).map(([value, count]) => ({
        value,
        label: value,
        count
      })),
      technologies: Object.entries(techCounts).map(([value, count]) => ({
        value,
        label: value,
        count
      }))
    };
  }, [projects]);

  // Show loading skeleton while loading - AFTER all hooks
  if (isLoading && projects.length === 0) {
    return <DashboardSkeleton />;
  }

  const handleBulkDelete = () => {
    if (selectedProjects.size > 0) {
      deleteProjects(Array.from(selectedProjects), apiClient);
    }
  };

  const handleBulkArchive = () => {
    if (selectedProjects.size > 0) {
      archiveProjects(Array.from(selectedProjects));
    }
  };

  const handleEditProject = (projectId: string, field: string, value: string) => {
    // In a real implementation, this would make an API call to update the project
    console.log('Edit project:', { projectId, field, value });
    // For now, we'll just simulate the update in the store
    // This would be implemented with a proper API integration
  };

  const getEmptyStateType = () => {
    if (error) return 'error';
    if (projects.length === 0) return 'no-projects';
    return 'no-results';
  };

  return (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden">
      {/* Dashboard Header */}
      <DashboardHeader
        stats={stats || dashboardStats}
        isLoading={isLoadingStats}
        onCreateProject={onCreateProject}
        onRefresh={refreshData}
        onToggleFilterPanel={toggleFilterPanel}
        showFilterPanel={showFilterPanel}
        hasActiveFilters={hasActiveFilters()}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          showFilterPanel ? 'mr-80' : ''
        }`}>
          
          {/* Toolbar */}
          <div className="border-b border-[#262626] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex border border-[#404040] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-[#3B82F6] text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-[#3B82F6] text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Results Count */}
                <span className="text-sm text-gray-400">
                  {filteredProjects.length} of {projects.length} projects
                  {hasActiveFilters() && ' (filtered)'}
                </span>
              </div>

              {/* Bulk Actions */}
              {selectedProjects.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg">
                  <span className="text-sm text-[#3B82F6] font-medium">
                    {selectedProjects.size} selected
                  </span>
                  <div className="h-4 w-px bg-[#3B82F6]/30" />
                  <button
                    onClick={handleBulkArchive}
                    className="text-sm text-gray-400 hover:text-white transition-colors px-2"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors px-2"
                  >
                    Delete
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-400 hover:text-white transition-colors px-2"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              // Loading State
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#3B82F6] border-t-transparent" />
                  <span>Loading projects...</span>
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              // Empty State
              <EmptyState
                type={getEmptyStateType()}
                searchQuery={searchQuery}
                hasFilters={hasActiveFilters()}
                onCreateProject={onCreateProject}
                onClearFilters={clearFilters}
                onRetry={refreshData}
              />
            ) : (
              // Project Content
              <div className="p-6">
                {viewMode === 'grid' ? (
                  // Grid View
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isSelected={selectedProjects.has(project.id)}
                        onSelect={onSelectProject}
                        onToggleSelection={toggleProjectSelection}
                        onToggleFavorite={toggleProjectFavorite}
                        onDuplicate={duplicateProject}
                        onDelete={(id) => deleteProjects([id], apiClient)}
                        onArchive={(id) => archiveProjects([id])}
                      />
                    ))}
                  </div>
                ) : (
                  // List View
                  <ProjectListView
                    projects={filteredProjects}
                    selectedProjects={selectedProjects}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={setSortBy}
                    onSelectAll={selectAllProjects}
                    onToggleSelection={toggleProjectSelection}
                    onToggleFavorite={toggleProjectFavorite}
                    onDuplicate={duplicateProject}
                    onDelete={(id) => deleteProjects([id])}
                    onArchive={(id) => archiveProjects([id])}
                    onEditProject={handleEditProject}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel
          isOpen={showFilterPanel}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          
          statusFilters={activeFilters.status}
          availableStatuses={filterOptions.statuses}
          onStatusFilterChange={setStatusFilter}
          
          tagFilters={activeFilters.tags}
          availableTags={filterOptions.tags}
          onTagFilterChange={setTagsFilter}
          
          technologyFilters={activeFilters.technology}
          availableTechnologies={filterOptions.technologies}
          onTechnologyFilterChange={setTechnologyFilter}
          
          dateRange={activeFilters.dateRange}
          onDateRangeChange={setDateRangeFilter}
          
          filterPresets={filterPresets}
          activePreset={activeFilterPreset}
          onApplyPreset={applyFilterPreset}
          onSavePreset={saveFilterPreset}
          onDeletePreset={deleteFilterPreset}
          
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters()}
        />

        {/* Filter Panel Overlay for Mobile */}
        {showFilterPanel && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={toggleFilterPanel}
          />
        )}
      </div>

      {/* Status Bar */}
      {projects.length > 0 && (
        <div className="border-t border-[#262626] px-6 py-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>{filteredProjects.length} projects shown</span>
            {selectedProjects.size > 0 && (
              <span>{selectedProjects.size} selected</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>{projects.filter(p => p.status === 'running').length} running</span>
            <span>{projects.filter(p => p.status === 'completed').length} completed</span>
            {stats && (
              <span>{Math.round(stats.averageSuccessRate * 100)}% success rate</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}