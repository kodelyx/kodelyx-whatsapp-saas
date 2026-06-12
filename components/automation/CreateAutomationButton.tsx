'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createAutomation } from '@/app/[locale]/(dashboard)/automation/actions';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type InstanceItem = {
  dbId: number;
  instanceName: string;
  integration: string;
};

export function CreateAutomationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: instances } = useSWR<InstanceItem[]>(open ? '/api/instance/details' : null, fetcher);
  const allInstances = Array.isArray(instances) ? instances : [];

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Enter automation name');
      return;
    }
    if (!instanceId) {
      toast.error('Select an instance');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createAutomation(name.trim(), parseInt(instanceId));
      if (result?.id) {
        toast.success('Automation created!');
        setOpen(false);
        setName('');
        setInstanceId('');
        router.push(`/automation/${result.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="h-4 w-4 mr-2" />New Automation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Automation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input 
              placeholder="e.g. Welcome Bot" 
              value={name} 
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp Instance</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select instance" />
              </SelectTrigger>
              <SelectContent>
                {allInstances.map(inst => (
                  <SelectItem key={inst.dbId} value={inst.dbId.toString()}>
                    {inst.instanceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
