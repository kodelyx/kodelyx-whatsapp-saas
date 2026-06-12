'use client';
import React from 'react';
export default function Logo({ showName = true }: { showName?: boolean }) {
  if (!showName) return null;
  return <span className="text-xl font-bold text-primary">Kodelyx</span>;
}
