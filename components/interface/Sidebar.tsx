'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, BarChart3, Settings, Bot, Megaphone, Users, LayoutTemplate, Phone, Coins } from 'lucide-react';
import Logo from './Logo';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const navItems = [
  { href: '/dashboard', label: 'Chat', icon: MessageCircle },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/automation', label: 'Automation', icon: Bot },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/pricing', label: 'Buy Credits', icon: Coins },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: creditsData } = useSWR('/api/message-credits', fetcher, { refreshInterval: 30000 });
  const balance = creditsData?.balance ?? 0;

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-56 border-r bg-card h-screen shrink-0">
      <div className="flex items-center justify-center lg:justify-start p-4 border-b h-[60px]">
        <Link href="/dashboard"><Logo /></Link>
      </div>
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname.includes(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {/* Credit Balance Widget */}
      <div className="p-2 border-t">
        <Link href="/pricing"
          className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:from-amber-500/20 hover:to-orange-500/20 transition-all group"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-500/20 text-amber-600 shrink-0">
            <Coins className="h-4 w-4" />
          </div>
          <div className="hidden lg:flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Message Credits</span>
            <span className="text-sm font-bold text-foreground tabular-nums">
              {balance.toLocaleString('en-IN')}
            </span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
