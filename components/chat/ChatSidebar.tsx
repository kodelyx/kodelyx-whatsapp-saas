'use client';
import React, { useState } from 'react';
import useSWR from 'swr';
import { ChatDetails, ContactData } from './types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  X, UserCircle, Tag, Milestone, PenLine, Save, Bot, BotOff,
  UserPlus, Phone, MessageSquare, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface FunnelStage { id: number; name: string; emoji: string | null; order: number; }
interface Agent { id: number; name: string | null; email: string; }
interface TagData { id: number; name: string; color: string; }
interface TeamDataWithMembers {
  id: number;
  teamMembers?: { user: Agent }[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ChatSidebarProps {
  chatDetails: ChatDetails;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isGroup: boolean;
  onSyncMessages: () => void;
  isSyncingMessages: boolean;
}

export function ChatSidebar({ chatDetails, isCollapsed, onToggleCollapse, isGroup }: ChatSidebarProps) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const { data: contact, mutate: mutateContact } = useSWR<ContactData | null>(
    chatDetails.remoteJid ? `/api/contacts/by-chat?jid=${chatDetails.remoteJid}` : null, fetcher
  );
  const { data: funnelStages } = useSWR<FunnelStage[]>('/api/funnel-stages', fetcher);
  const { data: tags } = useSWR<TagData[]>('/api/tags', fetcher);
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const agents: Agent[] = teamData?.teamMembers?.map(tm => tm.user) || [];

  // Get chat ID for AI status
  const { data: chatsData } = useSWR<any[]>('/api/chats', fetcher);
  const currentChat = chatsData?.find?.((c: any) => c.remoteJid === chatDetails.remoteJid);
  const chatId = currentChat?.id;

  const { data: aiStatus, mutate: mutateAiStatus } = useSWR<{ isActive: boolean }>(
    chatId ? `/api/chats/${chatId}/ai-status` : null, fetcher
  );

  if (isCollapsed) return null;

  const displayName = chatDetails.name || 'Unknown';
  const phoneNumber = chatDetails.remoteJid?.split('@')[0] || '';
  const formattedPhone = phoneNumber ? `+${phoneNumber}` : '';
  const initials = displayName.slice(0, 2).toUpperCase();

  const updateContact = async (field: string, value: any) => {
    if (!contact?.id) {
      toast.error('Contact not found');
      return;
    }
    setUpdatingField(field);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update');
      mutateContact();
      toast.success('Updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await updateContact('notes', notesText);
    setSavingNotes(false);
    setEditingNotes(false);
  };

  const handleToggleAi = async () => {
    if (!chatId) { toast.error('Chat not found'); return; }
    setUpdatingField('ai');
    try {
      const newStatus = aiStatus?.isActive ? 'paused' : 'active';
      const res = await fetch(`/api/chats/${chatId}/ai-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle AI');
      mutateAiStatus();
      toast.success(newStatus === 'active' ? 'AI Activated' : 'AI Paused');
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle AI');
    } finally {
      setUpdatingField(null);
    }
  };

  return (
    <aside className="w-80 border-l bg-card flex flex-col h-screen shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Contact Info</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Avatar & Name */}
      <div className="flex flex-col items-center py-6 px-4 border-b">
        <Avatar className="h-20 w-20 mb-3">
          {chatDetails.profilePicUrl && <AvatarImage src={chatDetails.profilePicUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-semibold">{displayName}</h2>
        {formattedPhone && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <Phone className="h-3 w-3" />
            {formattedPhone}
          </p>
        )}
      </div>

      {/* Funnel Stage */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Milestone className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Funnel Stage</span>
        </div>
        <Select
          value={contact?.funnelStage?.id?.toString() || ''}
          onValueChange={(val) => updateContact('funnelStageId', val ? parseInt(val) : null)}
          disabled={updatingField === 'funnelStageId'}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select stage..." />
          </SelectTrigger>
          <SelectContent>
            {funnelStages?.map(stage => (
              <SelectItem key={stage.id} value={stage.id.toString()}>
                {stage.emoji} {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contact?.tags && contact.tags.length > 0 ? (
            contact.tags.map(tag => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs px-2 py-0.5 cursor-pointer hover:opacity-80"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
              >
                {tag.name}
              </Badge>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">No tags assigned</p>
          )}
        </div>
        {tags && tags.length > 0 && (
          <Select
            onValueChange={(val) => {
              const tagId = parseInt(val);
              const currentTagIds = contact?.tags?.map(t => t.id) || [];
              if (!currentTagIds.includes(tagId)) {
                updateContact('tagIds', [...currentTagIds, tagId]);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs mt-2">
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent>
              {tags.filter(t => !contact?.tags?.some(ct => ct.id === t.id)).map(tag => (
                <SelectItem key={tag.id} value={tag.id.toString()}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Actions</span>
        </div>
        <div className="space-y-2">
          {/* Assign Agent */}
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={contact?.assignedUser?.id?.toString() || ''}
              onValueChange={(val) => updateContact('assignedUserId', val ? parseInt(val) : null)}
              disabled={updatingField === 'assignedUserId'}
            >
              <SelectTrigger className="h-9 text-sm flex-1">
                <SelectValue placeholder="Assign Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pause/Resume AI */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-9"
            onClick={handleToggleAi}
            disabled={updatingField === 'ai'}
          >
            {updatingField === 'ai' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : aiStatus?.isActive ? (
              <BotOff className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            {aiStatus?.isActive ? 'Pause AI' : 'Resume AI'}
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 py-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Notes</span>
          </div>
          {!editingNotes ? (
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => { setNotesText(contact?.notes || ''); setEditingNotes(true); }}
            >
              Edit
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          )}
        </div>
        {editingNotes ? (
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Add notes about this contact..."
            className="min-h-[100px] text-sm resize-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {contact?.notes || 'No notes yet. Click Edit to add.'}
          </p>
        )}
      </div>
    </aside>
  );
}
