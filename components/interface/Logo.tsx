'use client';
import React from 'react';
import { useBranding } from '@/providers/branding-provider';

export default function Logo({ showName = true }: { showName?: boolean }) {
  const { branding } = useBranding();
  const logoUrl = branding?.logoUrl;
  const name = branding?.name || 'Kodelyx';

  return (
    <span className="flex items-center gap-2">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          className="h-8 w-auto object-contain"
        />
      )}
      {/* Always show the name when there's no logo image so something renders.
          When showName is false (e.g. login pages) we only hide the text if a
          logo image is actually available. */}
      {(showName || !logoUrl) && (
        <span className="text-xl font-bold text-primary">{name}</span>
      )}
    </span>
  );
}
