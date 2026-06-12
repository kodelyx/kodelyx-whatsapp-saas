'use client';
import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  type Connection,
  type Node,
  type Edge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Save, Loader2, Power, PowerOff, Plus, MessageCircle, Clock, GitBranch, Zap, Trash2 } from 'lucide-react';
import { saveAutomation, toggleAutomationStatus } from '@/app/[locale]/(dashboard)/automation/actions';
import { toast } from 'sonner';

// Custom Node Components
function StartNode({ data }: { data: any }) {
  return (
    <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg border-2 border-green-600 min-w-[120px] text-center">
      <div className="font-bold text-sm">⚡ Start</div>
      <div className="text-[10px] opacity-80">Trigger</div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-700 !w-3 !h-3" />
    </div>
  );
}

function MessageNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className={`bg-white dark:bg-[#1f2c34] rounded-xl shadow-md border-2 min-w-[200px] ${selected ? 'border-primary' : 'border-border'}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="bg-blue-500 text-white px-3 py-1.5 rounded-t-lg flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Send Message</span>
      </div>
      <div className="p-3">
        <p className="text-xs text-foreground truncate">{data.message || 'Click to edit...'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

function DelayNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className={`bg-white dark:bg-[#1f2c34] rounded-xl shadow-md border-2 min-w-[160px] ${selected ? 'border-primary' : 'border-border'}`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="bg-amber-500 text-white px-3 py-1.5 rounded-t-lg flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Delay</span>
      </div>
      <div className="p-3">
        <p className="text-xs text-foreground">{data.delay || '5'} {data.unit || 'seconds'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}

function ConditionNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className={`bg-white dark:bg-[#1f2c34] rounded-xl shadow-md border-2 min-w-[180px] ${selected ? 'border-primary' : 'border-border'}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="bg-purple-500 text-white px-3 py-1.5 rounded-t-lg flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Condition</span>
      </div>
      <div className="p-3">
        <p className="text-xs text-foreground">{data.condition || 'If keyword...'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-green-500 !w-3 !h-3 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  delay: DelayNode,
  condition: ConditionNode,
};

interface FlowBuilderProps {
  automationId: number;
  initialNodes: Node[];
  initialEdges: Edge[];
  initialActive: boolean;
  integration: string;
}

export default function FlowBuilder({ automationId, initialNodes, initialEdges, initialActive, integration }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isSaving, setIsSaving] = useState(false);
  const [isActive, setIsActive] = useState(initialActive);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const lastNode = nodes[nodes.length - 1];
    const newNode: Node = {
      id,
      type,
      position: { x: lastNode ? lastNode.position.x : 250, y: lastNode ? lastNode.position.y + 150 : 100 },
      data: type === 'message' ? { message: '' } : type === 'delay' ? { delay: '5', unit: 'seconds' } : type === 'condition' ? { condition: '' } : { label: 'Start' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...newData } } : null);
  };

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && selectedNode.type !== 'start') {
      deleteNode(selectedNode.id);
    }
  }, [selectedNode, deleteNode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveAutomation(automationId, nodes, edges);
      toast.success('Flow saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      await toggleAutomationStatus(automationId, !isActive);
      setIsActive(!isActive);
      toast.success(isActive ? 'Automation paused' : 'Automation activated!');
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  return (
    <div className="flex h-full" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/30"
        >
          <Controls className="!bg-background !border-border !shadow-md" />
          <MiniMap className="!bg-background !border-border" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />

          <Panel position="top-left" className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addNode('message')} className="bg-background shadow-sm">
              <MessageCircle className="h-4 w-4 mr-1 text-blue-500" /> Message
            </Button>
            <Button size="sm" variant="outline" onClick={() => addNode('delay')} className="bg-background shadow-sm">
              <Clock className="h-4 w-4 mr-1 text-amber-500" /> Delay
            </Button>
            <Button size="sm" variant="outline" onClick={() => addNode('condition')} className="bg-background shadow-sm">
              <GitBranch className="h-4 w-4 mr-1 text-purple-500" /> Condition
            </Button>
          </Panel>

          <Panel position="top-right" className="flex gap-2">
            <Button size="sm" variant={isActive ? 'destructive' : 'default'} onClick={handleToggle}>
              {isActive ? <><PowerOff className="h-4 w-4 mr-1" /> Pause</> : <><Power className="h-4 w-4 mr-1" /> Activate</>}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Properties Panel */}
      {selectedNode && selectedNode.type !== 'start' && (
        <div className="w-72 border-l bg-background p-4 overflow-y-auto space-y-4">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Node Properties
          </h3>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 w-full justify-start" onClick={() => deleteNode(selectedNode.id)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Node
          </Button>

          {selectedNode.type === 'message' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Message Text</Label>
                <Textarea
                  value={String(selectedNode.data?.message || '')}
                  onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                  placeholder="Type your message..."
                  className="min-h-[120px] text-sm"
                />
              </div>
            </div>
          )}

          {selectedNode.type === 'delay' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duration</Label>
                <Input
                  type="number"
                  value={String(selectedNode.data?.delay || '5')}
                  onChange={(e) => updateNodeData(selectedNode.id, { delay: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={String(selectedNode.data?.unit || 'seconds')} onValueChange={(v) => updateNodeData(selectedNode.id, { unit: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedNode.type === 'condition' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Keyword / Condition</Label>
                <Input
                  value={String(selectedNode.data?.condition || '')}
                  onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
                  placeholder="e.g. contains 'yes'"
                  className="h-8"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Green output = match, Red output = no match
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
