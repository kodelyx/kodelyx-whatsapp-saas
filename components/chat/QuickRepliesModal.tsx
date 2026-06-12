'use client';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QuickRepliesModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickRepliesModal({ open, onOpenChange }: QuickRepliesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Quick Replies</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Manage your quick replies from Settings.</p>
      </DialogContent>
    </Dialog>
  );
}
