'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, Megaphone, Calendar, Loader2, Play, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CampaignsPage() {
    const t = useTranslations('Campaigns');
    const { data: campaigns, isLoading, mutate } = useSWR('/api/campaigns/list', fetcher);
    const hasProcessing = campaigns?.some((c: any) => c.status === 'PROCESSING');

    React.useEffect(() => {
        if (!hasProcessing) return;
        const interval = setInterval(() => mutate(), 5000);
        return () => clearInterval(interval);
    }, [hasProcessing, mutate]);
    const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isCampaignsEnabled', fetcher);

    const handleStart = async (id: number) => {
        try {
            const res = await fetch('/api/campaigns/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: id })
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || t('toasts.error'));
                return;
            }
            toast.success(t('toasts.dispatching'));
            mutate();
        } catch {
            toast.error(t('toasts.error'));
        }
    };

    const handlePause = async (id: number) => {
        try {
            const res = await fetch('/api/campaigns/pause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: id })
            });
            if (res.ok) {
                toast.success('Campaign paused');
                mutate();
            } else {
                toast.error('Failed to pause campaign');
            }
        } catch {
            toast.error('Error pausing campaign');
        }
    };

    const handleResume = async (id: number) => {
        try {
            const res = await fetch('/api/campaigns/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: id })
            });
            if (res.ok) {
                toast.success('Campaign resumed');
                mutate();
            } else {
                toast.error('Failed to resume campaign');
            }
        } catch {
            toast.error('Error resuming campaign');
        }
    };

    const handleRetryFailed = async (id: number) => {
        try {
            const res = await fetch('/api/campaigns/retry-failed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: id })
            });
            if (res.ok) {
                toast.success('Resending failed messages...');
                mutate();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to retry');
            }
        } catch {
            toast.error('Error retrying failed leads');
        }
    };

    return (
        <div className="flex flex-col h-full bg-muted p-6">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                </div>
                {featureData?.hasAccess && (
                    <Link href="/campaigns/new">
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Plus className="h-4 w-4 mr-2" /> {t('create_btn')}
                        </Button>
                    </Link>
                )}
            </header>

            {isLoading ? (
                <div className="flex justify-center h-64 items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : (!campaigns || campaigns.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-96 bg-background rounded-xl border border-border">
                    <Megaphone className="h-16 w-16 text-muted mb-4" />
                    <h3 className="text-lg font-medium text-foreground">{t('empty_title')}</h3>
                    <p className="text-muted-foreground mb-6">{t('empty_desc')}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns?.map((camp: any) => (
                        <div key={camp.id} className="bg-background p-6 rounded-xl border border-border flex justify-between items-center">
                             <Link key={camp.id} href={`/campaigns/${camp.id}`} className="block">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-semibold text-foreground">{camp.name}</h3>
                                    <Badge variant={camp.status === 'COMPLETED' ? 'default' : camp.status === 'SCHEDULED' ? 'secondary' : 'outline'}>{camp.status}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
                                    <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" /> {new Date(camp.createdAt).toLocaleDateString()}</span>
                                    {camp.scheduledAt && (
                                        <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {t('scheduled_for', { date: new Date(camp.scheduledAt).toLocaleString() })}</span>
                                    )}
                                    <span>{t('stats_total', {count: camp.totalLeads})}</span>
                                    <span className="text-primary">{t('stats_sent', {count: camp.sentCount})}</span>
                                    <span className="text-destructive">{t('stats_failed', {count: camp.failedCount})}</span>
                                </div>
                            </div>
                            </Link>
                                <div className="flex gap-2 items-center">
                                {camp.status === 'DRAFT' && (
                                    <Button size="sm" onClick={() => handleStart(camp.id)}>
                                        <Play className="h-4 w-4 mr-2" /> {t('start_btn')}
                                    </Button>
                                )}
                                {(camp.status === 'PROCESSING' || camp.status === 'SCHEDULED') && (
                                    <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); handlePause(camp.id); }}>
                                        {camp.status === 'PROCESSING' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
                                        Pause
                                    </Button>
                                )}
                                {camp.status === 'PAUSED' && (
                                    <Button size="sm" onClick={(e) => { e.preventDefault(); handleResume(camp.id); }}>
                                        <Play className="h-4 w-4 mr-2" /> Resume
                                    </Button>
                                )}
                                {camp.status === 'COMPLETED' && camp.failedCount > 0 && (
                                    <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); handleRetryFailed(camp.id); }}>
                                        <RotateCcw className="h-4 w-4 mr-2" /> Retry Failed
                                    </Button>
                                )}
                                    <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            try {
                                                const res = await fetch(`/api/campaigns/delete?id=${camp.id}`, { method: 'DELETE' });
                                                if (res.ok) {
                                                    toast.success('Campaign deleted successfully');
                                                    mutate();
                                                } else {
                                                    toast.error('Failed to delete campaign');
                                                }
                                            } catch {
                                                toast.error('Error deleting campaign');
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                            </div>
                        </div>

                    ))}
                </div>
            )}
        </div>
    );
}