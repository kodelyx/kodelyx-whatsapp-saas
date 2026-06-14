'use client';

import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Tile({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{(value ?? 0).toLocaleString()}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function CampaignReportDialog({
  campaignId,
  name,
  open,
  onOpenChange,
}: {
  campaignId: number | null;
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useSWR(
    open && campaignId ? `/api/campaigns/${campaignId}/stats` : null,
    fetcher,
    { refreshInterval: open ? 10000 : 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name ? `${name} — Delivery report` : 'Delivery report'}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : data.error ? (
          <p className="text-sm text-destructive py-6 text-center">{data.error}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Total" value={data.total} />
              <Tile label="Sent" value={data.sent} sub="accepted by WhatsApp" color="text-blue-600" />
              <Tile
                label="Delivered"
                value={data.delivery.delivered}
                sub={`${pct(data.delivery.delivered, data.sent)}% of sent`}
                color="text-green-600"
              />
              <Tile
                label="Read"
                value={data.delivery.read}
                sub={`${pct(data.delivery.read, data.delivery.delivered)}% of delivered`}
                color="text-emerald-600"
              />
              <Tile label="Failed" value={data.delivery.failed} sub="not delivered" color="text-red-600" />
              <Tile label="Queued" value={data.queued} sub="not sent yet" color="text-amber-600" />
            </div>

            {!data.delivery.available && (
              <p className="text-xs text-muted-foreground">
                Delivered / Read tracking is available only for campaigns sent with “Create contacts” turned on.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Live from WhatsApp delivery receipts. Read counts can keep rising as recipients open the message.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
