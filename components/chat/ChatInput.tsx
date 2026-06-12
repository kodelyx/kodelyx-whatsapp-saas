'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mic, Square, Paperclip, Smile, Image, FileText, Play, Pause, X, Trash2, BookOpen, StickyNote } from 'lucide-react';
import { RecordingStatus, QuickReply } from './types';
import { EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
  isInternalNote: boolean;
  setIsInternalNote: (v: boolean) => void;
  newMessage: string;
  setNewMessage: (v: string) => void;
  recordingStatus: RecordingStatus;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSendText: (e: React.FormEvent) => void;
  onSendAudio: () => void;
  onSendAttachment: (file: File) => void;
  audioUrl: string | null;
  isAudioPlaying: boolean;
  toggleAudioPlayback: () => void;
  audioPlayerRef: React.RefObject<HTMLAudioElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileIconClick: (accept: string) => void;
  onEmojiClick: (data: EmojiClickData) => void;
  quickRepliesOpen: boolean;
  setQuickRepliesOpen: (v: boolean) => void;
  showQuickReplySuggestions: boolean;
  setShowQuickReplySuggestions: (v: boolean) => void;
  filteredQuickReplies: QuickReply[];
  isWindowExpired: boolean;
  onOpenTemplateDialog: () => void;
  isGroup: boolean;
}

export function ChatInput({
  isInternalNote, setIsInternalNote, newMessage, setNewMessage,
  recordingStatus, recordingTime, onStartRecording, onStopRecording, onCancelRecording,
  onSendText, onSendAudio, onSendAttachment,
  audioUrl, isAudioPlaying, toggleAudioPlayback, audioPlayerRef,
  fileInputRef, handleFileIconClick, onEmojiClick,
  quickRepliesOpen, setQuickRepliesOpen,
  showQuickReplySuggestions, setShowQuickReplySuggestions, filteredQuickReplies,
  isWindowExpired, onOpenTemplateDialog, isGroup
}: ChatInputProps) {
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (recordingStatus === 'recording') {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono text-muted-foreground">{formatTime(recordingTime)}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancelRecording}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        <Button variant="default" size="icon" onClick={onStopRecording}><Square className="h-4 w-4" /></Button>
      </div>
    );
  }

  if (recordingStatus === 'review' && audioUrl) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onCancelRecording}><X className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={toggleAudioPlayback}>{isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
        <audio ref={audioPlayerRef} src={audioUrl} className="hidden" />
        <span className="text-sm text-muted-foreground flex-1">Audio ready</span>
        <Button size="icon" onClick={onSendAudio} disabled={recordingStatus === 'sending' as any}><Send className="h-4 w-4" /></Button>
      </div>
    );
  }

  if (recordingStatus === 'sending') {
    return (
      <div className="flex items-center justify-center px-4 py-3">
        <span className="text-sm text-muted-foreground animate-pulse">Sending...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {showQuickReplySuggestions && filteredQuickReplies.length > 0 && (
        <div className="mb-2 bg-card border rounded-lg p-1 max-h-32 overflow-y-auto">
          {filteredQuickReplies.map(qr => (
            <button key={qr.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded" onClick={() => { setNewMessage(qr.content); setShowQuickReplySuggestions(false); }}>
              <span className="font-medium text-primary">/{qr.shortcut}</span> <span className="text-muted-foreground">{qr.content.slice(0, 50)}</span>
            </button>
          ))}
        </div>
      )}
      {isWindowExpired && (
        <div className="mb-2 flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-700 dark:text-amber-300">
          <span>24h window expired.</span>
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onOpenTemplateDialog}>Send Template</Button>
        </div>
      )}
      <form onSubmit={onSendText} className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => handleFileIconClick('image/*,video/*')}><Paperclip className="h-5 w-5 text-muted-foreground" /></Button>
        <Button type="button" variant={isInternalNote ? "default" : "ghost"} size="icon" className="shrink-0" onClick={() => setIsInternalNote(!isInternalNote)} title="Internal Note">
          <StickyNote className="h-4 w-4" />
        </Button>
        <Input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={isInternalNote ? "Write an internal note..." : "Type a message..."}
          className={`flex-1 ${isInternalNote ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300' : ''}`}
          disabled={isWindowExpired && !isInternalNote}
        />
        <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onSendAttachment(f); e.target.value = ''; }} />
        {newMessage.trim() ? (
          <Button type="submit" size="icon" className="shrink-0"><Send className="h-4 w-4" /></Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onStartRecording}><Mic className="h-5 w-5 text-muted-foreground" /></Button>
        )}
      </form>
    </div>
  );
}
