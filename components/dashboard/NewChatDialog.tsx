'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  instances: any[];
}

export function NewChatDialog({ isOpen, onClose, instances }: NewChatDialogProps) {
  const [phone, setPhone] = useState('');
  const handleStart = () => {
    if (!phone.trim()) return;
    const jid = phone.replace(/\D/g, '');
    window.location.href = `/dashboard/chat/${jid}`;
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Chat</DialogTitle></DialogHeader>
        <Input placeholder="Enter phone number..." value={phone} onChange={e => setPhone(e.target.value)} />
        <DialogFooter><Button onClick={handleStart}>Start Chat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
