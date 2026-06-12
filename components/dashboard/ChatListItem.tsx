'use client';
import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

export interface Chat {
  id: number;
  teamId: number;
  instanceId: number | null;
  remoteJid: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
  lastMessageText: string | null;
  lastMessageTimestamp: string | null;
  lastCustomerInteraction: string | null;
  unreadCount: number | null;
  lastMessageStatus: string | null;
  lastMessageFromMe: boolean | null;
  contact?: ContactData | null;
}

export interface Agent { id: number; name: string | null; email: string; }
export interface FunnelStage { id: number; name: string; emoji: string | null; order: number; }
export interface TagData { id: number; name: string; color: string; }

interface ContactData {
  id: number;
  name: string;
  funnelStage?: FunnelStage | null;
  assignedUser?: Agent | null;
  tags?: TagData[];
}

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  instances: any[];
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: number) => void;
  agents: Agent[];
  funnelStages: FunnelStage[];
  tags: TagData[];
  onContactUpdate: (updater?: (chats: Chat[]) => Chat[]) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function ChatListItem({ chat, isActive, instances, isSelectionMode, isSelected, onSelect, agents, funnelStages, tags, onContactUpdate, isMuted, onToggleMute }: ChatListItemProps) {
  const isGroup = chat.remoteJid.endsWith('@g.us');
  const chatIdentifier = isGroup ? chat.remoteJid : chat.remoteJid.split('@')[0];
  const displayName = chat.contact?.name || chat.name || chat.pushName || chatIdentifier;
  const lastMsg = chat.lastMessageText || '';
  const time = chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const instanceParam = chat.instanceId ? `?instanceId=${chat.instanceId}` : '';

  return (
    <Link href={`/dashboard/chat/${encodeURIComponent(chatIdentifier)}${instanceParam}`} className="block">
      <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted/50'}`} onClick={isSelectionMode ? (e) => { e.preventDefault(); onSelect(chat.id); } : undefined}>
        {isSelectionMode && (
          <Checkbox checked={isSelected} onCheckedChange={() => onSelect(chat.id)} className="shrink-0" />
        )}
        <Avatar className="h-10 w-10 shrink-0">
          {chat.profilePicUrl && <AvatarImage src={chat.profilePicUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{time}</span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground truncate">{lastMsg}</p>
            {chat.unreadCount && chat.unreadCount > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shrink-0">{chat.unreadCount}</span>
            )}
          </div>
          {chat.contact?.funnelStage && (
            <span className="text-[10px] text-muted-foreground">{chat.contact.funnelStage.emoji} {chat.contact.funnelStage.name}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-2.5 bg-muted rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
