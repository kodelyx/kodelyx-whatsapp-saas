'use client';
import React from 'react';
import Link from 'next/link';
import { ChatDetails } from './types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, PanelRightClose, PanelRightOpen, ArrowLeft } from 'lucide-react';

interface ChatHeaderProps {
  chatDetails: ChatDetails;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isGroup: boolean;
}

export function ChatHeader({ chatDetails, showSearch, setShowSearch, searchQuery, setSearchQuery, isSidebarCollapsed, onToggleSidebar, isGroup }: ChatHeaderProps) {
  const displayName = chatDetails.name || 'Chat';
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0 h-[60px]">
      <div className="flex items-center gap-3 min-w-0">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0">
          <Link href="/dashboard" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Avatar className="h-10 w-10 shrink-0">
          {chatDetails.profilePicUrl && <AvatarImage src={chatDetails.profilePicUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-sm">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{displayName}</h2>
          {isGroup && <p className="text-xs text-muted-foreground">Group</p>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {showSearch ? (
          <div className="flex items-center gap-1">
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search messages..." className="h-8 w-32 sm:w-48 text-sm" autoFocus />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowSearch(false); setSearchQuery(''); }}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}><Search className="h-4 w-4" /></Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleSidebar}>
          {isSidebarCollapsed ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
