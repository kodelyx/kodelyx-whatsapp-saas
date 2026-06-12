'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Activity, TrendingUp } from 'lucide-react';

// --- Funnel Line Chart ---
type FunnelItem = { name: string; value: number };

export function FunnelLineChart({ data }: { data?: FunnelItem[] }) {
  const items = data || [];
  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <Card className="col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Funnel Overview</CardTitle>
        </div>
        <CardDescription>Contacts per funnel stage</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No funnel data yet. Create stages and assign contacts.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted-foreground font-mono">{item.value}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max((item.value / max) * 100, 2)}%`,
                      background: `hsl(${220 + i * 25}, 70%, ${50 + i * 5}%)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Funnel Radar Chart (displayed as donut-like segments) ---
export function FunnelRadarChart({ data }: { data?: FunnelItem[] }) {
  const items = data || [];
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#ec4899'];

  return (
    <Card className="col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Stage Distribution</CardTitle>
        </div>
        <CardDescription>Percentage breakdown by stage</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No distribution data available.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => {
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                  <span className="text-sm flex-1 truncate">{item.name}</span>
                  <span className="text-sm font-mono text-muted-foreground">{pct}%</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{item.value}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-2 border-t mt-2">
              <div className="w-3 h-3 rounded-full shrink-0 bg-foreground/20" />
              <span className="text-sm font-semibold flex-1">Total</span>
              <span className="text-sm font-mono font-semibold">{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Agent List ---
type AgentItem = { name: string; total: number; funnels: Record<string, number> };

export function AgentList({ data }: { data?: AgentItem[] }) {
  const agents = data || [];

  return (
    <Card className="col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Agent Performance</CardTitle>
        </div>
        <CardDescription>Contacts assigned per agent</CardDescription>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No agents assigned yet.
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {agent.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {Object.entries(agent.funnels).slice(0, 3).map(([stage, count]) => (
                      <Badge key={stage} variant="outline" className="text-[10px] px-1.5 py-0">
                        {stage}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">{agent.total}</span>
                  <p className="text-[10px] text-muted-foreground">contacts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Traffic Heatmap ---
type TrafficItem = { date: string; count: number; weekday: number };

export function TrafficHeatmap({ data }: { data?: TrafficItem[] }) {
  const items = data || [];
  const max = Math.max(...items.map(i => i.count), 1);

  // Group by weeks (7 days per row)
  const weeks: TrafficItem[][] = [];
  for (let i = 0; i < items.length; i += 7) {
    weeks.push(items.slice(i, i + 7));
  }

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const intensity = Math.min(count / max, 1);
    if (intensity < 0.25) return 'bg-emerald-200 dark:bg-emerald-900/40';
    if (intensity < 0.5) return 'bg-emerald-400 dark:bg-emerald-700/60';
    if (intensity < 0.75) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card className="col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Message Activity</CardTitle>
        </div>
        <CardDescription>Last 90 days message traffic</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No message data yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-0.5 items-start">
              <div className="flex flex-col gap-0.5 mr-1 pt-0">
                {dayLabels.map((d, i) => (
                  <div key={i} className="h-3 w-3 flex items-center justify-center text-[8px] text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`h-3 w-3 rounded-[2px] ${getColor(day.count)} transition-colors`}
                      title={`${day.date}: ${day.count} messages`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400 dark:bg-emerald-700/60" />
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
              <span>More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
