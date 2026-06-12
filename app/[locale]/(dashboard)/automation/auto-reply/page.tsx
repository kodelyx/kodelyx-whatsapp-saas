'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Loader2, MessageSquareReply, Clock, Bell, Smartphone, Save } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AutoReplyPage() {
    const { data: instances, isLoading: loadingInstances } = useSWR('/api/instance/details', fetcher);
    const [selectedInstanceId, setSelectedInstanceId] = useState('');
    const [saving, setSaving] = useState(false);

    // Settings state
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyMessage, setAutoReplyMessage] = useState('');
    const [autoReplyDelaySeconds, setAutoReplyDelaySeconds] = useState(300);
    const [autoReplyIntervalHours, setAutoReplyIntervalHours] = useState(12);

    const [followup1Enabled, setFollowup1Enabled] = useState(false);
    const [followup1Message, setFollowup1Message] = useState('');
    const [followup1DelayMinutes, setFollowup1DelayMinutes] = useState(480);

    const [followup2Enabled, setFollowup2Enabled] = useState(false);
    const [followup2Message, setFollowup2Message] = useState('');
    const [followup2DelayMinutes, setFollowup2DelayMinutes] = useState(720);

    const wabaInstances = (Array.isArray(instances) ? instances : []).filter((i: any) => i.integration === 'WHATSAPP-BUSINESS');

    useEffect(() => {
        if (wabaInstances.length > 0 && !selectedInstanceId) {
            setSelectedInstanceId(wabaInstances[0].dbId.toString());
        }
    }, [wabaInstances]);

    // Load settings when instance changes
    useEffect(() => {
        if (!selectedInstanceId) return;
        fetch(`/api/auto-reply/settings?instanceId=${selectedInstanceId}`)
            .then(r => r.json())
            .then(data => {
                setAutoReplyEnabled(data.autoReplyEnabled || false);
                setAutoReplyMessage(data.autoReplyMessage || '');
                setAutoReplyDelaySeconds(data.autoReplyDelaySeconds || 300);
                setAutoReplyIntervalHours(data.autoReplyIntervalHours || 12);
                setFollowup1Enabled(data.followup1Enabled || false);
                setFollowup1Message(data.followup1Message || '');
                setFollowup1DelayMinutes(data.followup1DelayMinutes || 480);
                setFollowup2Enabled(data.followup2Enabled || false);
                setFollowup2Message(data.followup2Message || '');
                setFollowup2DelayMinutes(data.followup2DelayMinutes || 720);
            });
    }, [selectedInstanceId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/auto-reply/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceId: selectedInstanceId,
                    autoReplyEnabled, autoReplyMessage, autoReplyDelaySeconds, autoReplyIntervalHours,
                    followup1Enabled, followup1Message, followup1DelayMinutes,
                    followup2Enabled, followup2Message, followup2DelayMinutes,
                })
            });
            if (res.ok) toast.success('Settings saved!');
            else toast.error('Failed to save');
        } catch { toast.error('Error saving'); }
        finally { setSaving(false); }
    };

    if (loadingInstances) return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="flex flex-col h-full bg-muted p-6 overflow-y-auto">
            <header className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Auto-Reply & Follow-Ups</h1>
                    <p className="text-sm text-muted-foreground">Automatically respond to incoming messages with smart cooldowns</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                        <SelectTrigger className="w-[200px] bg-background">
                            <SelectValue placeholder="Select Instance" />
                        </SelectTrigger>
                        <SelectContent>
                            {wabaInstances.map((inst: any) => (
                                <SelectItem key={inst.dbId} value={inst.dbId.toString()}>
                                    <span className="flex items-center gap-2"><Smartphone className="h-3 w-3" /> {inst.instanceName}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSave} disabled={saving || !selectedInstanceId}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Settings
                    </Button>
                </div>
            </header>

            <div className="grid gap-6 max-w-3xl">
                {/* Auto-Reply #1 */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <MessageSquareReply className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Auto-Reply</h3>
                                <p className="text-xs text-muted-foreground">Instant reply when customer messages</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={autoReplyEnabled ? 'default' : 'secondary'}>{autoReplyEnabled ? 'Active' : 'Disabled'}</Badge>
                            <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
                        </div>
                    </div>

                    {autoReplyEnabled && (
                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">Reply Message</label>
                                <Textarea value={autoReplyMessage} onChange={e => setAutoReplyMessage(e.target.value)} rows={3} placeholder="Auto-reply message..." className="bg-background" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1 block">
                                        <Clock className="h-3 w-3 inline mr-1" /> Delay (seconds)
                                    </label>
                                    <Input type="number" value={autoReplyDelaySeconds} onChange={e => setAutoReplyDelaySeconds(parseInt(e.target.value) || 0)} className="bg-background" />
                                    <p className="text-xs text-muted-foreground mt-1">Wait before sending reply ({Math.floor(autoReplyDelaySeconds / 60)}m {autoReplyDelaySeconds % 60}s)</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1 block">
                                        <Clock className="h-3 w-3 inline mr-1" /> Cooldown (hours)
                                    </label>
                                    <Input type="number" value={autoReplyIntervalHours} onChange={e => setAutoReplyIntervalHours(parseInt(e.target.value) || 1)} className="bg-background" />
                                    <p className="text-xs text-muted-foreground mt-1">Don't reply again within {autoReplyIntervalHours}h</p>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Follow-Up #1 */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Bell className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Follow-Up #1</h3>
                                <p className="text-xs text-muted-foreground">Sent after auto-reply if no response</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={followup1Enabled ? 'default' : 'secondary'}>{followup1Enabled ? 'Active' : 'Disabled'}</Badge>
                            <Switch checked={followup1Enabled} onCheckedChange={setFollowup1Enabled} />
                        </div>
                    </div>

                    {followup1Enabled && (
                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">Follow-Up Message</label>
                                <Textarea value={followup1Message} onChange={e => setFollowup1Message(e.target.value)} rows={3} placeholder="Follow-up message..." className="bg-background" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    <Clock className="h-3 w-3 inline mr-1" /> Delay (minutes)
                                </label>
                                <Input type="number" value={followup1DelayMinutes} onChange={e => setFollowup1DelayMinutes(parseInt(e.target.value) || 60)} className="bg-background" />
                                <p className="text-xs text-muted-foreground mt-1">Send {Math.floor(followup1DelayMinutes / 60)}h {followup1DelayMinutes % 60}m after auto-reply</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Follow-Up #2 */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <Bell className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Follow-Up #2</h3>
                                <p className="text-xs text-muted-foreground">Final reminder if still no response</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={followup2Enabled ? 'default' : 'secondary'}>{followup2Enabled ? 'Active' : 'Disabled'}</Badge>
                            <Switch checked={followup2Enabled} onCheckedChange={setFollowup2Enabled} />
                        </div>
                    </div>

                    {followup2Enabled && (
                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">Follow-Up Message</label>
                                <Textarea value={followup2Message} onChange={e => setFollowup2Message(e.target.value)} rows={3} placeholder="Final follow-up message..." className="bg-background" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    <Clock className="h-3 w-3 inline mr-1" /> Delay (minutes)
                                </label>
                                <Input type="number" value={followup2DelayMinutes} onChange={e => setFollowup2DelayMinutes(parseInt(e.target.value) || 60)} className="bg-background" />
                                <p className="text-xs text-muted-foreground mt-1">Send {Math.floor(followup2DelayMinutes / 60)}h {followup2DelayMinutes % 60}m after auto-reply</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Info */}
                <div className="bg-background border border-border rounded-xl p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-2">How it works:</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Customer sends a message → <strong>Auto-Reply</strong> is sent after the configured delay</li>
                        <li>If <strong>Follow-Up #1</strong> is enabled → sent after {Math.floor(followup1DelayMinutes / 60)}h {followup1DelayMinutes % 60}m</li>
                        <li>If <strong>Follow-Up #2</strong> is enabled → sent after {Math.floor(followup2DelayMinutes / 60)}h {followup2DelayMinutes % 60}m</li>
                        <li><strong>Cooldown:</strong> Same person won't get auto-reply again within {autoReplyIntervalHours} hours</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
