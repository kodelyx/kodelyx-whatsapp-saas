'use client';
import React from 'react';
import { useBranding } from '@/providers/branding-provider';

export default function Logo({ showName = true }: { showName?: boolean }) {
  const { branding } = useBranding();
  if (!showName) return null;
  return <span className="text-xl font-bold text-primary">{branding?.name || 'Kodelyx'}</span>;
}
