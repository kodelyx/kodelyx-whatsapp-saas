'use client';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSendTemplate: (templateId: number, variables: Record<string, string>) => void;
}

export function TemplateDialog({ open, onOpenChange, onSendTemplate }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send Template</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Template sending will be available once you connect a WhatsApp Business instance.</p>
      </DialogContent>
    </Dialog>
  );
}
