'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, BarChart3, Settings, Bot, Megaphone, Users, LayoutTemplate, Phone, Crown, Shield, Sun, Moon, Monitor } from 'lucide-react';
import Logo from './Logo';
import useSWR from 'swr';
import { useTheme } from 'next-themes';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const navItems = [
  { href: '/dashboard', label: 'Chat', icon: MessageCircle },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/automation', label: 'Automation', icon: Bot },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/pricing', label: 'Plans', icon: Crown },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-primary/30 bg-primary/5 shrink-0" />
    );
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center justify-center h-9 w-9 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shrink-0"
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: teamData } = useSWR('/api/team', fetcher, { refreshInterval: 60000 });
  const { data: userData } = useSWR('/api/user', fetcher, { refreshInterval: 60000 });
  const planName = teamData?.planName;
  const isAdmin = userData?.role === 'admin';

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

      <div className="p-2 border-t space-y-2">
        {/* Admin Panel Link */}
        {isAdmin && (
          <Link href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <Shield className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">Admin Panel</span>
          </Link>
        )}

        {/* Plan Widget + Theme Toggle */}
        <div className="flex items-center gap-2">
          <Link href="/pricing"
            className="flex-1 flex items-center gap-3 px-3 py-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 hover:from-primary/20 hover:to-primary/10 transition-all"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-primary shrink-0">
              <Crown className="h-4 w-4" />
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-[10px] text-muted-foreground">Current Plan</span>
              <span className="text-sm font-bold text-foreground">
                {planName || 'Free'}
              </span>
            </div>
          </Link>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
