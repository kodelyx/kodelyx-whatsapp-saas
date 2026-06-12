'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, MessageCircle, Coins, Banknote, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranding } from '@/providers/branding-provider';
import { toast } from 'sonner';
import useSWR from 'swr';
import Image from 'next/image';

const fetcher = (url: string) => fetch(url).then(r => r.json());

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
};

type CreditPack = {
  id: number;
  credits: number;
  priceInr: number;
  label: string;
  perMsg: string;
};

export function PricingClient({ allPlans, currentTeam }: { allPlans: Plan[], currentTeam?: TeamData }) {
  const t = useTranslations('Pricing');
  const [buyingPack, setBuyingPack] = useState<CreditPack | null>(null);
  const [utr, setUtr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { branding } = useBranding();

  const { data: creditsData, mutate: mutateCredits } = useSWR('/api/message-credits', fetcher);
  const { data: packsData } = useSWR('/api/message-credits/purchase', fetcher);
  const { data: historyData, mutate: mutateHistory } = useSWR('/api/message-credits/history', fetcher);

  const balance = creditsData?.balance ?? 0;
  const packs: CreditPack[] = packsData?.packs ?? [];
  const transactions = historyData?.transactions ?? [];

  const handleOfflineSubmit = async () => {
    if (!utr || utr.length < 6) {
      toast.error('Please enter a valid UTR or Transaction ID');
      return;
    }
    if (!buyingPack) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/message-credits/offline-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: buyingPack.id,
          packLabel: buyingPack.label,
          packPrice: buyingPack.priceInr,
          credits: buyingPack.credits,
          utr: utr
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Payment verification request submitted successfully! Credits will be added once approved.');
        setBuyingPack(null);
        setUtr('');
        mutateHistory();
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch {
      toast.error('Error submitting request');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-full w-full bg-background dark:bg-black py-16 px-4 sm:px-6 lg:px-8 overflow-y-auto font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto text-center mb-16">
        <div className="flex items-center justify-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium tracking-wide uppercase text-primary">{branding?.name || 'Kodelyx'}</span>
        </div>
        
        <h1 className="text-4xl font-medium text-foreground sm:text-6xl tracking-tight mb-4">
          Buy Message Credits
          <br />
          <span className="text-muted-foreground/80">Pay As You Go</span>
        </h1>
        
        <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-10">
          Purchase message credits and use them for campaigns, automations, and direct messaging. No monthly commitment required.
        </p>

        <div className="flex flex-col items-center gap-6">
          {/* Balance Pill */}
          <div className="inline-flex items-center gap-3 bg-muted/30 dark:bg-zinc-900/50 border border-border px-6 py-3 rounded-full">
            <Coins className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Your Balance:</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{balance.toLocaleString('en-IN')} <span className="text-sm font-normal text-muted-foreground">credits</span></span>
          </div>
        </div>
      </div>

      {/* Credit Packs */}
      <div className={cn(
        "grid gap-6 max-w-7xl mx-auto items-start pb-16",
        packs.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-3 lg:grid-cols-5"
      )}>
        {packs.map((pack, index) => {
          const isFeatured = index === 3;
          return (
            <div
              key={pack.id}
              className={cn(
                "relative flex flex-col p-8 transition-all duration-300 h-full",
                "rounded-[2.5rem] border",
                isFeatured 
                  ? "bg-zinc-900 border-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)] dark:bg-zinc-900 dark:border-primary z-10 scale-105" 
                  : "bg-background border-border hover:border-foreground/20 dark:bg-black dark:border-zinc-800",
              )}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Popular</span>
                </div>
              )}

              <div className="mb-8">
                <div className="h-12 w-12 rounded-full border border-border/50 bg-gradient-to-br from-background to-muted flex items-center justify-center mb-6">
                  <Coins className={cn("h-6 w-6", isFeatured ? "text-primary" : "text-foreground")} />
                </div>
                
                <h3 className={cn("text-2xl font-medium mb-2", isFeatured ? "text-white" : "text-foreground")}>
                  {pack.label}
                </h3>
                <p className={cn("text-sm", isFeatured ? "text-zinc-400" : "text-muted-foreground")}>
                  {pack.perMsg} per message
                </p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className={cn("text-4xl font-semibold tracking-tight", isFeatured ? "text-white" : "text-foreground")}>
                  ₹{(pack.priceInr / 100).toLocaleString('en-IN')}
                </span>
              </div>

              <Button
                onClick={() => setBuyingPack(pack)}
                className={cn(
                  "w-full rounded-full h-12 font-medium text-sm mb-6 transition-all",
                  isFeatured
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-lg shadow-primary/20"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700",
                )}
              >
                Buy via UPI
              </Button>

              <div className="space-y-4 flex-1">
                <p className={cn("text-sm font-medium", isFeatured ? "text-white" : "text-foreground")}>Includes</p>
                <ul className="space-y-3">
                  <FeatureItem text={`${pack.credits.toLocaleString('en-IN')} Messages`} isFeatured={isFeatured} />
                  <FeatureItem text="No Expiry" isFeatured={isFeatured} />
                  <FeatureItem text="All Channels" isFeatured={isFeatured} />
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="max-w-4xl mx-auto pb-20">
          <h2 className="text-lg font-medium text-foreground mb-4">Recent Transactions</h2>
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Credits</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-t border-border/50">
                    <td className="px-4 py-3 text-foreground text-sm">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 text-xs rounded-full font-medium capitalize",
                        tx.type === 'purchase' ? "bg-green-500/10 text-green-600" :
                        tx.type === 'deduct' ? "bg-red-500/10 text-red-600" :
                        tx.type === 'offline_request' ? "bg-purple-500/10 text-purple-600" :
                        "bg-blue-500/10 text-blue-600"
                      )}>
                        {tx.type === 'offline_request' ? 'UPI Request' : tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 text-xs rounded-full font-medium capitalize",
                        tx.status === 'completed' ? "bg-green-500/10 text-green-600" :
                        tx.status === 'pending' ? "bg-yellow-500/10 text-yellow-600" :
                        tx.status === 'rejected' ? "bg-red-500/10 text-red-600" : ""
                      )}>
                        {tx.status || 'completed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {tx.description}
                      {tx.utr && <div className="text-xs mt-1 text-muted-foreground/70">UTR: {tx.utr}</div>}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-semibold tabular-nums text-sm", tx.type === 'deduct' ? 'text-red-500' : 'text-green-600')}>
                      {tx.type === 'deduct' ? '-' : '+'}{tx.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      <Dialog open={!!buyingPack} onOpenChange={(open) => { if (!open) setBuyingPack(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Pay via UPI
            </DialogTitle>
            <DialogDescription>
              Scan the QR code below to pay for {buyingPack?.label}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Payment Info */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Pack</span>
                <span className="font-medium">{buyingPack?.label}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-border/50 pt-3">
                <span className="text-muted-foreground">Amount to Pay</span>
                <span className="font-bold text-lg text-primary">
                  ₹{((buyingPack?.priceInr || 0) / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
                {/* We use a public QR image if you place it in public/qr.png, or a static text if not available */}
                <div className="w-48 h-48 bg-zinc-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <Image 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('upi://pay?pa=Q564122588@ybl&pn=Kodelyx')}`} 
                    alt="UPI QR" 
                    fill 
                    className="object-contain p-2" 
                    unoptimized
                  />
                </div>
              </div>
              <p className="font-medium text-sm">UPI ID: <span className="text-primary tracking-wider">Q564122588@ybl</span></p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="utr">Transaction ID / UTR Number <span className="text-red-500">*</span></Label>
              <Input 
                id="utr" 
                placeholder="e.g. 312456789012" 
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                After successful payment, enter the 12-digit UTR or Reference Number here. Your credits will be added once an admin verifies the payment.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyingPack(null)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleOfflineSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureItem({ text, isEnabled = true, isFeatured }: { text: string; isEnabled?: boolean; isFeatured: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded-full border shrink-0",
        isEnabled 
          ? (isFeatured ? "border-primary text-primary bg-primary/10" : "border-foreground text-foreground")
          : (isFeatured ? "border-zinc-700 text-zinc-700" : "border-zinc-300 text-zinc-300 dark:border-zinc-800 dark:text-zinc-800")
      )}>
        <Check className="h-3 w-3" />
      </div>
      <span className={cn(
        "text-sm", 
        isEnabled 
          ? (isFeatured ? "text-zinc-300" : "text-muted-foreground")
          : (isFeatured ? "text-zinc-700 line-through" : "text-zinc-300 dark:text-zinc-800 line-through")
      )}>
        {text}
      </span>
    </li>
  );
}