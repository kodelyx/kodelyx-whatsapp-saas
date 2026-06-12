'use client';
import React from 'react';
import { Button } from '@/components/ui/button';

interface FilterState {
  funnelStageId: number | null;
  tagId: number | null;
  agentId: number | null;
  instanceId: number | null;
}

interface ChatFiltersProps {
  activeTab: string;
  setActiveTab: (v: string) => void;
  filters: FilterState;
  setFilters: (v: FilterState) => void;
  instances: any[];
}

export function ChatFilters({ activeTab, setActiveTab, filters, setFilters, instances }: ChatFiltersProps) {
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
      {tabs.map(tab => (
        <Button key={tab.key} variant={activeTab === tab.key ? 'default' : 'ghost'} size="sm" className="text-xs h-7" onClick={() => setActiveTab(tab.key)}>
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
