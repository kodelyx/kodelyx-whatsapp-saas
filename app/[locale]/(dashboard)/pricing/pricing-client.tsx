'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, Loader2, MessageCircle, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBranding } from '@/providers/branding-provider';
import { toast } from 'sonner';
import { checkoutAction, joinFreePlanAction } from '@/lib/payments/actions';

type Plan = {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  interval: string;
  currency: string;
  stripePriceId: string;
  maxUsers: number;
  maxContacts: number;
  maxInstances: number;
  isMessagingEnabled: boolean;
  maxMonthlyMessages: number;
  isAiEnabled: boolean;
  isFlowBuilderEnabled: boolean;
  isCampaignsEnabled: boolean;
  isTemplatesEnabled: boolean;
};

type TeamData = {
  planId: number | null;
  subscriptionStatus: string | null;
  stripeCustomerId?: string | null;
  gatewayType?: string | null;
  messagesSentThisMonth?: number;
  plan?: { name: string; amount: number } | null;
  subscriptionEndsAt?: string | null;
};

export function PricingClient({ allPlans, currentTeam }: { allPlans: Plan[], currentTeam?: TeamData }) {
  const { branding } = useBranding();
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    if (plan.amount === 0) {
      // Free plan
      setLoadingPlanId(plan.id);
      try {
        const formData = new FormData();
        formData.append('planId', plan.id.toString());
        await joinFreePlanAction(formData);
      } catch (error: any) {
        if (error?.digest?.startsWith?.('NEXT_REDIRECT')) return;
        toast.error(error.message || 'Failed to join free plan');
      }
      setLoadingPlanId(null);
      return;
    }

    // Paid plan → redirect to checkout
    setLoadingPlanId(plan.id);
    try {
      const formData = new FormData();
      formData.append('planId', plan.id.toString());
      await checkoutAction(formData);
    } catch (error: any) {
      // NEXT_REDIRECT is thrown by Next.js internally when redirect() is called — not a real error
      if (error?.digest?.startsWith?.('NEXT_REDIRECT')) return;
      toast.error(error.message || 'Failed to start checkout');
    }
    setLoadingPlanId(null);
  };

  // Sort plans by amount
  const sortedPlans = [...allPlans].sort((a, b) => a.amount - b.amount);

  const planIcons = [Crown, Crown, Crown];
  const planColors = [
    { border: 'border-border', bg: 'bg-card' },
    { border: 'border-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]', bg: 'bg-card' },
    { border: 'border-primary/50 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.2)]', bg: 'bg-card' },
  ];

  return (
    <div className="min-h-full w-full bg-background py-16 px-4 sm:px-6 lg:px-8 overflow-y-auto font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto text-center mb-16">
        <div className="flex items-center justify-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium tracking-wide uppercase text-primary">{branding?.name || 'ChatBulky'}</span>
        </div>
        
        <h1 className="text-4xl font-medium text-foreground sm:text-6xl tracking-tight mb-4">
          Choose Your Plan
          <br />
          <span className="text-muted-foreground/80">Scale as you grow</span>
        </h1>
        
        <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-4">
          Start free, upgrade when you&apos;re ready. All plans include WhatsApp connection, CRM, and contact management.
        </p>

        {currentTeam?.planId && currentTeam?.plan && (
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-primary font-medium">
              {currentTeam.plan.name} Plan Active
              {currentTeam.subscriptionEndsAt && (
                <span className="text-primary/70 ml-1">
                  · Expires {new Date(currentTeam.subscriptionEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div className={cn(
        "grid gap-6 max-w-7xl mx-auto items-start pb-16",
        sortedPlans.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {sortedPlans.map((plan, index) => {
          const isFeatured = index === 1 && sortedPlans.length >= 2;
          const isCurrentPlan = currentTeam?.planId === plan.id;
          const colors = planColors[Math.min(index, planColors.length - 1)];
          const Icon = planIcons[Math.min(index, planIcons.length - 1)];

          const features = [
            { text: plan.isMessagingEnabled ? (plan.maxMonthlyMessages > 0 ? `${plan.maxMonthlyMessages.toLocaleString('en-IN')} messages/month` : 'Unlimited messages') : 'No messaging', enabled: plan.isMessagingEnabled },
            { text: `${plan.maxUsers} team member${plan.maxUsers > 1 ? 's' : ''}`, enabled: true },
            { text: `${plan.maxInstances} WhatsApp number${plan.maxInstances > 1 ? 's' : ''}`, enabled: true },
            { text: plan.maxContacts > 0 ? `${plan.maxContacts.toLocaleString('en-IN')} contacts` : 'Unlimited contacts', enabled: true },
            { text: 'AI Agent', enabled: plan.isAiEnabled },
            { text: 'Flow Builder', enabled: plan.isFlowBuilderEnabled },
            { text: 'Campaigns', enabled: plan.isCampaignsEnabled },
            { text: 'Templates', enabled: plan.isTemplatesEnabled },
          ];

          const hasActivePlan = currentTeam?.planId != null;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col p-8 transition-all duration-300 h-full",
                "rounded-[2.5rem] border",
                isCurrentPlan 
                  ? "bg-card border-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]" 
                  : isFeatured && !hasActivePlan 
                  ? `${colors.bg} ${colors.border} z-10 scale-105` 
                  : `${colors.bg} ${colors.border} hover:border-foreground/20`,
              )}
            >
              {/* Show "Most Popular" only when user has NO active plan */}
              {isFeatured && !hasActivePlan && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}

              {/* Show "Current Plan" badge on user's active plan */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">✓ Current Plan</span>
                </div>
              )}

              <div className="mb-8">
                <div className="h-12 w-12 rounded-full border border-border/50 bg-gradient-to-br from-background to-muted flex items-center justify-center mb-6">
                  <Icon className={cn("h-6 w-6", "text-primary")} />
                </div>
                
                <h3 className="text-2xl font-medium mb-2 text-foreground">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {plan.description || (plan.amount === 0 ? 'Get started for free' : 'For growing businesses')}
                </p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight text-foreground">
                  {plan.amount === 0 ? 'Free' : `₹${(plan.amount / 100).toLocaleString('en-IN')}`}
                </span>
                {plan.amount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    /{plan.interval === 'month' ? 'mo' : 'yr'}
                  </span>
                )}
              </div>

              {(() => {
                const currentPlanAmount = currentTeam?.plan?.amount ?? 0;
                const isHigherPlan = plan.amount > currentPlanAmount;
                const isLowerPlan = hasActivePlan && plan.amount < currentPlanAmount && !isCurrentPlan;

                return (
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isCurrentPlan || isLowerPlan || loadingPlanId === plan.id}
                    className={cn(
                      "w-full rounded-full h-12 font-medium text-sm mb-6 transition-all",
                      isCurrentPlan
                        ? "bg-primary/10 text-primary border border-primary/30 cursor-not-allowed"
                        : isHigherPlan && hasActivePlan
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-lg shadow-primary/20"
                        : isLowerPlan
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    {loadingPlanId === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isCurrentPlan ? (
                      '✓ Current Plan'
                    ) : isLowerPlan ? (
                      'Included in your plan'
                    ) : isHigherPlan && hasActivePlan ? (
                      'Upgrade'
                    ) : plan.amount === 0 ? (
                      'Get Started'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                );
              })()}

              <div className="space-y-4 flex-1">
                <p className="text-sm font-medium text-foreground">Includes</p>
                <ul className="space-y-3">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center justify-center h-5 w-5 rounded-full border shrink-0",
                        feature.enabled 
                          ? "border-primary text-primary bg-primary/10"
                          : "border-zinc-600 text-zinc-600 dark:border-zinc-600 dark:text-zinc-600"
                      )}>
                        {feature.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <span className={cn(
                        "text-sm", 
                        feature.enabled 
                          ? "text-foreground"
                          : "text-muted-foreground line-through"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Usage (for subscribed users) */}
      {currentTeam?.planId && currentTeam.messagesSentThisMonth !== undefined && (
        <div className="max-w-xl mx-auto pb-20">
          <div className="rounded-2xl border border-border p-6 bg-card">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">This Month&apos;s Usage</h3>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold tabular-nums">{currentTeam.messagesSentThisMonth.toLocaleString('en-IN')}</span>
              <span className="text-muted-foreground text-sm">messages sent</span>
            </div>
            {(() => {
              const activePlan = allPlans.find(p => p.id === currentTeam.planId);
              if (activePlan && activePlan.maxMonthlyMessages > 0) {
                const pct = Math.min((currentTeam.messagesSentThisMonth / activePlan.maxMonthlyMessages) * 100, 100);
                return (
                  <div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-primary")} 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {currentTeam.messagesSentThisMonth.toLocaleString('en-IN')} / {activePlan.maxMonthlyMessages.toLocaleString('en-IN')} messages
                    </p>
                  </div>
                );
              }
              return <p className="text-xs text-muted-foreground">Unlimited messages on your plan</p>;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}