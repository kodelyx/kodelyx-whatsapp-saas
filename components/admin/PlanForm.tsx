'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function PlanForm({ plan, gatewayOptions }: { plan?: any; gatewayOptions?: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{plan ? 'Edit Plan' : 'Create Plan'}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Plan Name</Label><Input defaultValue={plan?.name || ''} placeholder="e.g. Pro Plan" /></div>
        <div><Label>Price (cents)</Label><Input type="number" defaultValue={plan?.amount || 0} /></div>
        <div className="flex items-center gap-2"><Switch defaultChecked={plan?.isAiEnabled} /><Label>AI Enabled</Label></div>
        <div className="flex items-center gap-2"><Switch defaultChecked={plan?.isFlowBuilderEnabled} /><Label>Flow Builder</Label></div>
        <div className="flex items-center gap-2"><Switch defaultChecked={plan?.isCampaignsEnabled} /><Label>Campaigns</Label></div>
        <Button type="submit">Save Plan</Button>
      </CardContent>
    </Card>
  );
}
