'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { Trash2, Plus, Smartphone, Info, Signal, Globe, Zap, Loader2, Copy, Check } from 'lucide-react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

type InstanceDetailItem = {
    dbId: number;
    instanceName: string;
    internalName?: string;
    owner: string | null;
    profileName: string | null;
    profilePictureUrl: string | null;
    status: string;
    token: string | null;
    number?: string;
    integration?: string;
    metaPhoneNumberId?: string | null;
    metaWabaId?: string | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ConnectInstanceForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void; }) {
  const t = useTranslations('Settings');
  const [instanceName, setInstanceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaToken, setMetaToken] = useState("");
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        instanceName,
        integration: 'WHATSAPP-BUSINESS',
        metaToken,
        metaBusinessId,
        metaPhoneNumberId,
      };

      const response = await fetch('/api/instance/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('failed_to_connect_toast'));

      if (data.webhook && !data.webhook.overridden) {
        toast.warning(`Instance created, but webhook auto-setup failed: ${data.webhook.error || 'unknown error'}. Messages may not arrive until this is fixed.`);
      } else {
        toast.success(t('instance_created_success_toast'));
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label htmlFor="instanceNameFormModal">{t('instance_name_label')}</Label>
          <Input id="instanceNameFormModal" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder={t('instance_name_placeholder')} required disabled={isLoading && !error}/>
        </div>
        <div className="space-y-2">
            <Label>{t('phone_number_id_label')}</Label>
            <Input value={metaPhoneNumberId} onChange={(e) => setMetaPhoneNumberId(e.target.value)} placeholder={t('phone_number_id_placeholder')} required disabled={isLoading && !error}/>
        </div>
        <div className="space-y-2">
            <Label>{t('business_account_id_label')}</Label>
            <Input value={metaBusinessId} onChange={(e) => setMetaBusinessId(e.target.value)} placeholder={t('business_account_id_placeholder')} required disabled={isLoading && !error}/>
        </div>
        <div className="space-y-2">
            <Label>{t('system_user_token_label')}</Label>
            <Input type="password" value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder={t('system_user_token_placeholder')} required disabled={isLoading && !error}/>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel_btn')}</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
              {isLoading ? t('creating_instance_btn') : t('create_instance_btn')}
            </Button>
        </div>
     {error && (<p className="text-destructive text-center mt-4 text-sm bg-destructive/10 p-2 rounded">{error}</p>)}
    </form>
  );
}

function InstanceCard({ details, mutateDetails, allInstances }: { details: InstanceDetailItem; mutateDetails: () => void; allInstances: InstanceDetailItem[] }) {
  const t = useTranslations('Settings');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [moveContactsTarget, setMoveContactsTarget] = useState<string>('');
  const otherInstances = allInstances.filter(i => i.dbId !== details.dbId);

  const handleDelete = () => {
      setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
      setActionLoading('delete'); setError(null);
      try {
          if (moveContactsTarget && moveContactsTarget !== 'none') {
              const moveRes = await fetch('/api/contacts/move-instance-by-instance', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      sourceInstanceId: details.dbId,
                      targetInstanceId: parseInt(moveContactsTarget)
                  })
              });
              if (!moveRes.ok) {
                  const moveData = await moveRes.json();
                  throw new Error(moveData.error || t('move_contacts_error'));
              }
          }

          const response = await fetch(`/api/instance/delete?instanceName=${encodeURIComponent(details.internalName || details.instanceName)}`, {
              method: 'DELETE'
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || t('failed_to_action_toast', { action: 'delete' }));
          toast.success(t('instance_action_success_toast', { action: t('instance_deleted_success') }));
          setShowDeleteDialog(false);
          setMoveContactsTarget('');
          mutateDetails();
      } catch (err: any) { toast.error(err.message); setError(err.message); }
      finally { setActionLoading(null); }
  };

  const isConnected = details.status === 'open';
  const ownerNumber = details.number || details.owner?.split('@')[0] || t('no_number_fallback');
  const displayName = details.profileName || details.instanceName;
  const avatarUrl = details.profilePictureUrl || undefined;
  const isWaba = details.integration === 'WHATSAPP-BUSINESS';
  const isMetaCloud = details.integration === 'META-CLOUD';

  const getBadgeStyle = () => {
    return 'bg-zinc-100 text-zinc-600 border-zinc-200/80 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50';
  };

  const getBadgeLabel = () => {
    return t('waba_api_badge');
  };

  return (
    <Card className="w-fit border shadow-sm hover:shadow-md transition-all duration-200 bg-card text-card-foreground overflow-hidden group">

      <div className="flex items-center justify-between px-4 pt-4 pb-0">
        <div className="flex items-center gap-2">
            <div className={`relative flex h-2.5 w-2.5 items-center justify-center`}>
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : (details.status === 'connecting' ? 'bg-amber-500' : 'bg-destructive')}`}></span>
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : (details.status === 'connecting' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}`}>
                {isConnected ? t('online_status') : (details.status === 'connecting' ? t('connecting_status') : t('offline_status'))}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={actionLoading !== null} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg">
                {actionLoading === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
            </Button>
        </div>
      </div>

      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-col items-center text-center mt-0 gap-1.5">
          <div className={`p-0.5 rounded-full border-2 ${isConnected ? 'border-emerald-500/50' : 'border-border'} shrink-0`}>
            <Avatar className="h-14 w-14">
                <AvatarImage src={avatarUrl} alt={displayName} className="object-cover"/>
                <AvatarFallback className="text-xl font-bold bg-muted text-muted-foreground">
                    {displayName?.substring(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex flex-col items-center min-w-0 w-full mt-0.5">
              <h3 className="text-base font-semibold text-foreground whitespace-nowrap leading-tight w-full" title={displayName}>{displayName}</h3>
              <div className="flex items-center justify-center text-xs text-muted-foreground mt-1 w-full">
                  <Smartphone className="h-3.5 w-3.5 mr-1.5 opacity-70 shrink-0"/>
                  <span className="font-mono tracking-tight whitespace-nowrap">{ownerNumber}</span>
              </div>
          </div>
        </div>

        {/* WABA credentials metadata section */}
        {(details.metaPhoneNumberId || details.metaWabaId) && (
          <div className="mt-3.5 pt-2.5 border-t border-border/50 space-y-1.5 text-[11px] text-muted-foreground">
            {details.metaPhoneNumberId && (
              <div className="flex justify-between items-center gap-2">
                <span className="shrink-0 text-muted-foreground/85">Phone ID:</span>
                <span className="font-mono text-foreground font-medium select-all" title={details.metaPhoneNumberId}>{details.metaPhoneNumberId}</span>
              </div>
            )}
            {details.metaWabaId && (
              <div className="flex justify-between items-center gap-2">
                <span className="shrink-0 text-muted-foreground/85">WABA ID:</span>
                <span className="font-mono text-foreground font-medium select-all" title={details.metaWabaId}>{details.metaWabaId}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setMoveContactsTarget(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_instance_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('delete_instance_dialog.description', { instanceName: details.instanceName })}
            </DialogDescription>
          </DialogHeader>
          {otherInstances.length > 0 && (
            <div className="py-4 space-y-3">
              <Label>{t('delete_instance_dialog.move_contacts_label')}</Label>
              <p className="text-sm text-muted-foreground">{t('delete_instance_dialog.move_contacts_desc')}</p>
              <Select value={moveContactsTarget} onValueChange={setMoveContactsTarget}>
                <SelectTrigger>
                  <SelectValue placeholder={t('delete_instance_dialog.dont_move')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('delete_instance_dialog.dont_move')}</SelectItem>
                  {otherInstances.map((inst) => (
                    <SelectItem key={inst.dbId} value={inst.dbId.toString()}>
                      {inst.profileName || inst.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setMoveContactsTarget(''); }}>
              {t('cancel_btn')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={actionLoading === 'delete'}>
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('delete_instance_dialog.confirm_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ConnectInstancePage() {
  const t = useTranslations('Settings');
  const { data: instanceList, error, isLoading, mutate } = useSWR<InstanceDetailItem[]>(
    '/api/instance/details',
    fetcher,
    { revalidateOnFocus: true }
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/webhook` : 'https://meta.chatbulky.com/webhook';
  const verifyToken = 'token_verify_2026';

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    toast.success(t('copied_to_clipboard_toast') || 'Copied to clipboard!');
  };

  if (isLoading) {
    return (
        <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
             <div className="flex justify-between items-center border-b pb-6">
                 <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
                 <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="h-64 animate-pulse">
                        <CardHeader><div className="h-6 bg-muted rounded w-1/3"></div></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <div className="h-12 w-12 rounded-full bg-muted"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-muted rounded w-3/4"></div>
                                    <div className="h-3 bg-muted rounded w-1/2"></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
             </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex h-[80vh] flex-col items-center justify-center p-8">
            <div className="bg-destructive/10 p-4 rounded-full mb-4">
                <Signal className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t('error_loading_instances_title')}</h3>
            <p className="text-muted-foreground mb-6">{t('error_loading_instances_desc')}</p>
            <Button onClick={() => window.location.reload()} variant="outline">{t('retry_connection_btn')}</Button>
        </div>
    );
  }

  const hasInstances = instanceList && instanceList.length > 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
             <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">{t('connections_title')}</h1>
                <p className="text-muted-foreground mt-1">{t('connections_desc')}</p>
             </div>
             
             <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                    <Button size="lg" className="shadow-sm">
                        <Plus className="h-5 w-5 mr-2"/> {t('add_connection_btn')}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">{t('connect_new_instance_title')}</DialogTitle>
                        <DialogDescription>
                            {t('connect_new_instance_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <ConnectInstanceForm
                        onSuccess={() => { mutate(); setIsAddModalOpen(false); }}
                        onCancel={() => setIsAddModalOpen(false)}
                    />
                </DialogContent>
             </Dialog>
        </div>

        {/* Meta Webhook Configuration Card */}
        <div className="max-w-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-xl p-3.5 shadow-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {t('meta_configuration_title') || 'Meta Configuration'}
              </h3>
              <p className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 leading-normal">
                {t('meta_configuration_desc') || 'Configure the Webhook in the Meta dashboard:'}
              </p>
            </div>
          </div>
          
          <div className="bg-background dark:bg-zinc-950/40 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20 divide-y divide-border/40 overflow-hidden font-mono text-[10.5px]">
            <div className="flex items-center justify-between p-2 gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-muted-foreground shrink-0 w-24">Callback URL:</span>
                <span className="truncate text-foreground select-all font-medium">{callbackUrl}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                onClick={() => handleCopy(callbackUrl, 'url')}
              >
                {copiedUrl ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="flex items-center justify-between p-2 gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-muted-foreground shrink-0 w-24">Verify Token:</span>
                <span className="truncate text-foreground select-all font-medium">{verifyToken}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                onClick={() => handleCopy(verifyToken, 'token')}
              >
                {copiedToken ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>

        {hasInstances ? (
            <div className="flex flex-wrap gap-6">
                {instanceList.map((instance) => (
                    <InstanceCard key={instance.dbId} details={instance} mutateDetails={mutate} allInstances={instanceList} />
                ))}
            </div>
        ) : (
             <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
                 <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                    <Zap className="h-8 w-8 text-primary" />
                 </div>
                 <h3 className="text-xl font-semibold text-foreground">{t('no_connections_yet_title')}</h3>
                 <p className="text-muted-foreground max-w-md mt-2 mb-8">
                    {t('no_connections_yet_desc')}
                 </p>
                 <Button onClick={() => setIsAddModalOpen(true)} size="lg">
                     <Plus className="h-5 w-5 mr-2"/> {t('connect_first_instance_btn')}
                 </Button>
             </div>
        )}
    </div>
  );
}