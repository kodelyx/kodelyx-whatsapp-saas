'use client';
import React from 'react';
import { useActionState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { upsertPlan } from '@/app/[locale]/(admin)/admin-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PlanForm({ plan, gatewayOptions }: { plan?: any; gatewayOptions?: any[] }) {
  const [state, formAction, isPending] = useActionState(upsertPlan, { error: '', success: '' });

  return (
    <form action={formAction}>
      {plan?.id && <input type="hidden" name="id" value={plan.id} />}

      <Card>
        <CardHeader><CardTitle>{plan ? 'Edit Plan' : 'Create Plan'}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {state.error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{state.error}</div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Input id="name" name="name" defaultValue={plan?.name || ''} placeholder="e.g. Starter" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={plan?.description || ''} placeholder="e.g. Perfect for small businesses" />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Price (₹)</Label>
              <Input id="amount" name="amount" type="number" step="1" defaultValue={plan ? (plan.amount / 100) : 0} placeholder="499" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue={plan?.currency || 'inr'} maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">Billing Interval</Label>
              <select id="interval" name="interval" defaultValue={plan?.interval || 'month'} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trialDays">Trial Days</Label>
              <Input id="trialDays" name="trialDays" type="number" defaultValue={plan?.trialDays || 0} />
            </div>
          </div>

          {/* Payment Gateway */}
          {gatewayOptions && gatewayOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Payment Gateway</Label>
              <select name="gatewayId" defaultValue={plan?.gatewayId || 'none'} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="none">None (Free Plan)</option>
                {gatewayOptions.map((gw: any) => (
                  <option key={gw.id} value={gw.id}>{gw.displayName} ({gw.gateway})</option>
                ))}
              </select>
            </div>
          )}

          {/* Limits */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input id="maxUsers" name="maxUsers" type="number" defaultValue={plan?.maxUsers || 1} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxContacts">Max Contacts</Label>
                <Input id="maxContacts" name="maxContacts" type="number" defaultValue={plan?.maxContacts || 500} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxInstances">Max WhatsApp Numbers</Label>
                <Input id="maxInstances" name="maxInstances" type="number" defaultValue={plan?.maxInstances || 1} required />
              </div>
            </div>
          </div>

          {/* Messaging */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Messaging</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="font-medium">Enable Messaging</Label>
                  <p className="text-xs text-muted-foreground">Allow users to send messages</p>
                </div>
                <Switch name="isMessagingEnabled" defaultChecked={plan?.isMessagingEnabled ?? false} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxMonthlyMessages">Monthly Message Limit</Label>
                <Input id="maxMonthlyMessages" name="maxMonthlyMessages" type="number" defaultValue={plan?.maxMonthlyMessages || 0} placeholder="0 = unlimited" />
                <p className="text-xs text-muted-foreground">Set to 0 for unlimited messages</p>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>AI Agent</Label>
                <Switch name="isAiEnabled" defaultChecked={plan?.isAiEnabled ?? false} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>Flow Builder</Label>
                <Switch name="isFlowBuilderEnabled" defaultChecked={plan?.isFlowBuilderEnabled ?? false} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>Campaigns</Label>
                <Switch name="isCampaignsEnabled" defaultChecked={plan?.isCampaignsEnabled ?? false} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>Templates</Label>
                <Switch name="isTemplatesEnabled" defaultChecked={plan?.isTemplatesEnabled ?? false} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>Voice Calls</Label>
                <Switch name="isVoiceCallsEnabled" defaultChecked={plan?.isVoiceCallsEnabled ?? false} />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full md:w-auto">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {plan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
