'use client';
import React from 'react';
import { Message, Reaction } from './types';

interface MessageBubbleProps {
  msg: Message;
  onMediaClick: (id: string) => void;
  onReply: (msg: Message) => void;
  onRetry: (msg: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  searchQuery: string;
  userBubbleColor?: string;
  contactBubbleColor?: string;
  isGroup: boolean;
}

export function MessageBubble({ msg, onMediaClick, onReply, onRetry, onReact, searchQuery, userBubbleColor, contactBubbleColor, isGroup }: MessageBubbleProps) {
  const isFromMe = msg.fromMe;
  const bubbleColor = isFromMe ? (userBubbleColor || undefined) : (contactBubbleColor || undefined);
  const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const renderContent = () => {
    if (msg.messageType === 'imageMessage' && msg.mediaUrl) {
      return (
        <div className="cursor-pointer flex flex-col gap-1" onClick={() => onMediaClick(msg.id)}>
          <img src={msg.mediaUrl} alt="" className="max-w-[280px] rounded-lg object-cover" />
          {(msg.text || msg.mediaCaption) && <p className="text-sm whitespace-pre-wrap break-words px-1">{msg.text || msg.mediaCaption}</p>}
        </div>
      );
    }
    if (msg.messageType === 'videoMessage' && msg.mediaUrl) {
      return (
        <div className="cursor-pointer flex flex-col gap-1" onClick={() => onMediaClick(msg.id)}>
          <video src={msg.mediaUrl} className="max-w-[280px] rounded-lg" />
          {(msg.text || msg.mediaCaption) && <p className="text-sm whitespace-pre-wrap break-words px-1">{msg.text || msg.mediaCaption}</p>}
        </div>
      );
    }
    if (msg.messageType === 'audioMessage' && msg.mediaUrl) {
      return <audio src={msg.mediaUrl} controls className="max-w-[250px]" />;
    }
    if (msg.messageType === 'documentMessage' && msg.mediaUrl) {
      return (
        <div className="flex flex-col gap-1">
          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline text-blue-500">
            📄 {msg.mediaCaption || 'Document'}
          </a>
          {msg.text && <p className="text-sm whitespace-pre-wrap break-words px-1">{msg.text}</p>}
        </div>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>;
  };

  // System log messages - render as centered notification
  if (msg.text?.startsWith('@@syslog')) {
    const parsed = msg.text.replace('@@syslog_', '').split('|').reduce((acc: Record<string, string>, part) => {
      const [key, ...val] = part.split('=');
      if (key && val.length) acc[key] = val.join('=');
      return acc;
    }, {} as Record<string, string>);

    let displayText = msg.text;
    const action = msg.text.match(/@@syslog_(\w+)/)?.[1]?.replace(/_/g, ' ') || '';
    if (action === 'moved to stage') {
      displayText = `${parsed.name || 'Someone'} moved to ${parsed.stage || 'a stage'}`;
    } else if (action === 'assigned') {
      displayText = `Assigned to ${parsed.agent || parsed.name || 'someone'}`;
    } else if (action === 'unassigned') {
      displayText = `${parsed.name || 'Someone'} unassigned contact`;
    } else {
      displayText = `${action} ${parsed.name ? `by ${parsed.name}` : ''}`.trim();
    }

    return (
      <div className="flex justify-center px-2">
        <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
          {displayText} · {time}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} group px-2`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${msg.isInternal
            ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
            : isFromMe
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100'
              : 'bg-card border'
          }`}
        style={!msg.isInternal && bubbleColor ? { backgroundColor: bubbleColor } : undefined}
      >
        {isGroup && !isFromMe && msg.participantName && (
          <p className="text-xs font-medium text-primary mb-0.5">{msg.participantName}</p>
        )}
        {msg.quotedMessageText && (
          <div className="text-xs p-1.5 mb-1 rounded bg-black/5 dark:bg-white/5 border-l-2 border-primary truncate">
            {(() => { try { return JSON.parse(msg.quotedMessageText).text || 'Media'; } catch { return msg.quotedMessageText; } })()}
          </div>
        )}
        {renderContent()}
        <div className={`flex items-center gap-1 mt-0.5 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] opacity-60">{time}</span>
          {isFromMe && msg.status && (
            <span className={`text-[10px] ${msg.status === 'read' ? 'text-blue-500' : 'opacity-50'}`}>
              {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
        {(msg.status === 'error' || msg.status === 'failed') && (
          <div className="flex flex-col mt-1">
            <span className="text-xs text-red-500">Failed to send</span>
            {msg.errorMessage && <span className="text-[10px] text-red-400">{msg.errorMessage}</span>}
          </div>
        )}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {msg.reactions.map(r => <span key={r.id} className="text-xs bg-muted rounded-full px-1">{r.emoji}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
