'use client';
import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';

export function AutomationStatusToggle({ initialActive }: { id: number; initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  return <Switch checked={active} onCheckedChange={setActive} />;
}
