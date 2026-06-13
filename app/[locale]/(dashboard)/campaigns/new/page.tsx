'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, FileSpreadsheet, Send, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { WhatsAppPreview } from '@/components/templates/WhatsAppPreview';
import { extractTemplateVariables, bodyKey, headerKey, buttonKey } from '@/lib/whatsapp/template-params';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NewCampaignPage() {
    const t = useTranslations('NewCampaign');
    const router = useRouter();
    const { data: instances } = useSWR<any[]>('/api/instance/details', fetcher);
    const { data: templates } = useSWR<any[]>('/api/templates/list', fetcher);
    const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isCampaignsEnabled', fetcher);

    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [instanceId, setInstanceId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [pastedNumbers, setPastedNumbers] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [createContacts, setCreateContacts] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Per-variable fill config: key -> { mode: 'static' | 'column', value }
    const [varConfig, setVarConfig] = useState<Record<string, { mode: 'static' | 'column'; value: string }>>({});

    useEffect(() => {
        if (!isFeatureLoading && featureData && !featureData.hasAccess) {
            toast.error(t('toasts.no_access'));
            router.push('/dashboard');
        }
    }, [featureData, isFeatureLoading, router, t]);

    const wabaInstances = (Array.isArray(instances) ? instances : []).filter((i: any) => i.integration === 'WHATSAPP-BUSINESS');
    const selectedTemplate = Array.isArray(templates) ? templates.find((t: any) => t.id.toString() === selectedTemplateId) : undefined;

    // Columns available from the uploaded spreadsheet (excluding the phone column)
    const columns = leads.length > 0 ? Object.keys(leads[0].variables || {}).filter(k => k !== 'phone') : [];

    // Auto-detect every variable the selected template needs ({{n}} + url buttons)
    const detected = selectedTemplate
        ? extractTemplateVariables(selectedTemplate.components)
        : { body: [], header: [], buttons: [] };
    const varFields = [
        ...detected.header.map(n => ({ key: headerKey(n), label: `Header {{${n}}}`, num: n })),
        ...detected.body.map(n => ({ key: bodyKey(n), label: `Body {{${n}}}`, num: n })),
        ...detected.buttons.map(b => ({ key: buttonKey(b.index), label: `Button ${b.index + 1} link {{${b.param}}}`, num: b.param })),
    ];

    // When the template (or uploaded sheet) changes, rebuild the variable rows.
    // Smart default: if a column named like the body index exists, pre-map it.
    useEffect(() => {
        if (!selectedTemplate) { setVarConfig({}); return; }
        const det = extractTemplateVariables(selectedTemplate.components);
        const cols = leads.length > 0 ? Object.keys(leads[0].variables || {}).filter(k => k !== 'phone') : [];
        const next: Record<string, { mode: 'static' | 'column'; value: string }> = {};
        const setup = (key: string, preferredCol: string | null) => {
            if (preferredCol && cols.includes(preferredCol)) next[key] = { mode: 'column', value: preferredCol };
            else next[key] = { mode: 'static', value: '' };
        };
        det.header.forEach(n => setup(headerKey(n), String(n)));
        det.body.forEach(n => setup(bodyKey(n), String(n)));
        det.buttons.forEach(b => setup(buttonKey(b.index), null));
        setVarConfig(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTemplateId, leads]);

    const setVar = (key: string, patch: Partial<{ mode: 'static' | 'column'; value: string }>) => {
        setVarConfig(prev => ({ ...prev, [key]: { ...(prev[key] || { mode: 'static', value: '' }), ...patch } }));
    };

    // Resolve the value of one variable for a given lead row
    const resolveValue = (key: string, lead: any): string => {
        const cfg = varConfig[key];
        if (!cfg) return '';
        if (cfg.mode === 'static') return cfg.value;
        return String((lead?.variables || {})[cfg.value] ?? '');
    };

    // Live-preview values (uses the first lead as a sample for column-mapped vars)
    const previewVars: Record<string, string> = {};
    const sampleLead = leads[0];
    [...detected.body, ...detected.header].forEach(n => {
        const key = String(n);
        if (previewVars[key] === undefined) {
            previewVars[key] = resolveValue(bodyKey(n), sampleLead) || resolveValue(headerKey(n), sampleLead);
        }
    });

    // All detected variables must have a usable value before sending
    const allVarsFilled = varFields.every(f => {
        const cfg = varConfig[f.key];
        if (!cfg) return false;
        if (cfg.mode === 'static') return cfg.value.trim() !== '';
        return cfg.value !== '' && columns.includes(cfg.value);
    });

    const handleDownloadTemplate = () => {
        const data = [
            { phone: '5511999999999', '1': 'João', '2': 'Empresa ABC' },
            { phone: '5511888888888', '1': 'Maria', '2': 'Empresa XYZ' },
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cell = ws[XLSX.utils.encode_cell({ r: row, c: 0 })];
            if (cell) { cell.t = 's'; cell.z = '@'; }
        }
        if (!ws['!cols']) ws['!cols'] = [];
        ws['!cols'][0] = { wch: 18 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');
        XLSX.writeFile(wb, 'campaign_template.xlsx');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

            const parsed = rows.map((row: any) => {
                const phone = String(row.phone || row.telephone || row.celular || row.mobile || '').replace(/\D/g, '');
                return { phone, variables: row };
            }).filter((r: any) => r.phone);

            if (parsed.length === 0) {
                toast.error(t('leads.error_no_phone'));
            } else {
                setPastedNumbers('');
                setLeads(parsed);
                toast.success(t('leads.success_loaded', { count: parsed.length }));
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Parse phone numbers typed/pasted directly (one per line or separated by
    // spaces/commas/semicolons). Live-updates leads; no extra columns, so
    // template variables fall back to static values.
    const handlePasteNumbers = (text: string) => {
        setPastedNumbers(text);
        const seen = new Set<string>();
        const parsed = text
            .split(/[\s,;]+/)
            .map(tok => tok.replace(/\D/g, ''))
            .filter(phone => phone.length >= 8)
            .filter(phone => { if (seen.has(phone)) return false; seen.add(phone); return true; })
            .map(phone => ({ phone, variables: { phone } }));
        setLeads(parsed);
    };

    const handleSubmit = async () => {
        if (!allVarsFilled) {
            toast.error('Please fill in all template variables first.');
            return;
        }
        setIsSubmitting(true);
        try {
            // Resolve each lead's variables from the per-variable config
            // (static value applied to all, or pulled from the mapped column).
            const resolvedLeads = leads.map((lead: any) => {
                const vars: Record<string, string> = { phone: lead.phone };
                varFields.forEach(f => { vars[f.key] = resolveValue(f.key, lead); });
                return { phone: lead.phone, variables: vars };
            });

            const res = await fetch('/api/campaigns/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    instanceId,
                    scheduledAt,
                    templateId: selectedTemplateId,
                    leads: resolvedLeads,
                    createContacts
                })
            });

            if (!res.ok) throw new Error('Failed to create campaign');

            toast.success(t('toasts.created'));
            router.push('/campaigns');
        } catch (error) {
            toast.error(t('toasts.error_create'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isFeatureLoading || !featureData?.hasAccess) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-muted overflow-hidden">
            <header className="flex justify-between items-center px-6 py-4 bg-background border-b border-border shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
                    <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 min-h-0">
                <div className="max-w-5xl mx-auto w-full">
                    <div className="flex items-center justify-center mb-8">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`flex items-center ${s < 3 ? 'w-full' : ''}`}>
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {s}
                                </div>
                                {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
                            </div>
                        ))}
                    </div>

                    <Card className="p-6">
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-semibold">{t('details.title')}</h2>
                                <div className="space-y-2">
                                    <Label>{t('details.name_label')}</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('details.name_placeholder')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('details.instance_label')}</Label>
                                    <Select value={instanceId} onValueChange={setInstanceId}>
                                        <SelectTrigger><SelectValue placeholder={t('details.instance_placeholder')} /></SelectTrigger>
                                        <SelectContent>
                                            {wabaInstances.map((i: any) => (
                                                <SelectItem key={i.dbId} value={i.dbId.toString()}>{i.instanceName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('details.schedule_label')}</Label>
                                    <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                                    <p className="text-xs text-muted-foreground">{t('details.schedule_desc')}</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <Checkbox id="createContacts" checked={createContacts} onCheckedChange={(v) => setCreateContacts(v === true)} />
                                    <div className="space-y-1">
                                        <Label htmlFor="createContacts" className="cursor-pointer">{t('details.create_contacts_label')}</Label>
                                        <p className="text-xs text-muted-foreground">{t('details.create_contacts_desc')}</p>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button disabled={!name || !instanceId} onClick={() => setStep(2)}>{t('details.next_btn')}</Button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-semibold">{t('leads.title')}</h2>
                                <div className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center bg-muted hover:bg-muted/80 transition-colors cursor-pointer relative">
                                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-foreground">{t('leads.upload_text')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('leads.upload_hint')}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
                                    <Download className="h-4 w-4" />
                                    {t('leads.download_template')}
                                </Button>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase">{t('leads.or_divider')}</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                <div className="space-y-2">
                                    <Label>{t('leads.paste_label')}</Label>
                                    <Textarea
                                        value={pastedNumbers}
                                        onChange={(e) => handlePasteNumbers(e.target.value)}
                                        placeholder={t('leads.paste_placeholder')}
                                        rows={5}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">{t('leads.paste_hint')}</p>
                                </div>

                                {leads.length > 0 && (
                                    <div className="bg-primary/10 p-4 rounded-md flex items-center text-primary">
                                        <FileSpreadsheet className="h-5 w-5 mr-2" />
                                        <span className="font-medium">{t('leads.success_loaded', { count: leads.length })}</span>
                                    </div>
                                )}

                                <div className="flex justify-between">
                                    <Button variant="outline" onClick={() => setStep(1)}>{t('leads.back_btn')}</Button>
                                    <Button disabled={leads.length === 0} onClick={() => setStep(3)}>{t('leads.next_btn')}</Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-semibold">{t('content.title')}</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>{t('content.template_label')}</Label>
                                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                                <SelectTrigger><SelectValue placeholder={t('content.template_placeholder')} /></SelectTrigger>
                                                <SelectContent>
                                                    {templates?.filter((t: any) => t.status === 'APPROVED' && t.instanceId.toString() === instanceId).map((t: any) => (
                                                        <SelectItem key={t.id} value={t.id.toString()}>{t.name} ({t.language})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {selectedTemplate && varFields.length === 0 && (
                                            <div className="p-4 bg-primary/10 text-primary rounded-md text-sm">
                                                <p className="font-bold mb-1">{t('content.mapping_title')}</p>
                                                <p>This template has no variables to fill.</p>
                                            </div>
                                        )}

                                        {selectedTemplate && varFields.length > 0 && (
                                            <div className="space-y-3 rounded-md border border-border p-4">
                                                <div>
                                                    <p className="font-semibold text-sm">Fill template variables</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {varFields.length} variable{varFields.length > 1 ? 's' : ''} detected. Type a value for everyone, or map it to a spreadsheet column.
                                                    </p>
                                                </div>
                                                {varFields.map(f => {
                                                    const cfg = varConfig[f.key] || { mode: 'static', value: '' };
                                                    return (
                                                        <div key={f.key} className="space-y-1.5">
                                                            <Label className="text-xs font-medium">{f.label}</Label>
                                                            <div className="flex gap-2">
                                                                <Select
                                                                    value={cfg.mode}
                                                                    onValueChange={(v) => setVar(f.key, { mode: v as 'static' | 'column', value: '' })}
                                                                >
                                                                    <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="static">Static value</SelectItem>
                                                                        <SelectItem value="column" disabled={columns.length === 0}>From column</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {cfg.mode === 'static' ? (
                                                                    <Input
                                                                        value={cfg.value}
                                                                        onChange={(e) => setVar(f.key, { value: e.target.value })}
                                                                        placeholder={`Value for ${f.label}`}
                                                                    />
                                                                ) : (
                                                                    <Select value={cfg.value} onValueChange={(v) => setVar(f.key, { value: v })}>
                                                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                                                        <SelectContent>
                                                                            {columns.map(col => (
                                                                                <SelectItem key={col} value={col}>{col}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {!allVarsFilled && (
                                                    <p className="text-xs text-destructive">Fill every variable to continue.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-muted rounded-xl p-4 max-h-[450px] overflow-y-auto flex justify-center items-start w-full">
                                        {selectedTemplate ? (
                                            <div className="w-[300px]">
                                                <WhatsAppPreview data={selectedTemplate.components} variables={previewVars} />
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center text-muted-foreground w-full">{t('content.preview_placeholder')}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t">
                                    <Button variant="outline" onClick={() => setStep(2)}>{t('leads.back_btn')}</Button>
                                    <Button className="bg-primary hover:bg-primary/90" onClick={handleSubmit} disabled={isSubmitting || !selectedTemplate || !allVarsFilled}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                        {t('content.finish_btn')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}