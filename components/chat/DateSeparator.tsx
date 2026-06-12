'use client';
import React from 'react';
export function DateSeparator({ date, label }: { date: Date; label: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{label}</span>
    </div>
  );
}
