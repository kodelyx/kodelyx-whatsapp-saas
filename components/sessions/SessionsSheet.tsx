'use client';
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from 'lucide-react';

export function SessionsSheet({ type, chatId }: { type?: string; chatId?: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm"><List className="h-4 w-4 mr-2" />Sessions</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Active Sessions</SheetTitle></SheetHeader>
        <p className="text-sm text-muted-foreground mt-4">No active sessions.</p>
      </SheetContent>
    </Sheet>
  );
}
