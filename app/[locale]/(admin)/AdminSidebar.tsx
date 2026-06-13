'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Users,
  Building,
  LogOut,
  ShieldAlert,
  CreditCard,
  Palette,
  MessageSquare,
  Phone,
  Radio,
  Menu,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { isPluginInstalled } from '@/lib/plugins/registry';

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/teams', label: 'Teams', icon: Building },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/branding', label: 'Branding', icon: Palette },
  { href: '/admin/gateways', label: 'Payments', icon: CreditCard },
  { href: '/admin/channels', label: 'Channels', icon: Radio },
  { href: '/admin/chat-theme', label: 'Chat Theme', icon: MessageSquare },
  { href: '/admin/voice', label: 'Voice Calls', icon: Phone, plugin: 'voice-call' },
];

/**
 * Shared admin navigation, rendered both in the fixed desktop sidebar and the
 * mobile drawer. `onNavigate` lets the mobile drawer close itself on tap.
 */
function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathnameWithoutLocale === href;
    return pathnameWithoutLocale.startsWith(href);
  }

  return (
    <>
      <nav className="flex flex-1 flex-col gap-2 p-4 overflow-y-auto">
        {navItems.filter(item => !item.plugin || isPluginInstalled(item.plugin)).map(({ href, label, icon: Icon, exact }) => (
          <Link key={href} href={href} onClick={onNavigate}>
            <Button
              variant={isActive(href, exact) ? 'secondary' : 'ghost'}
              className="w-full justify-start"
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
        <div className="mt-auto">
          <Link href="/dashboard" onClick={onNavigate}>
            <Button variant="outline" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Exit to App
            </Button>
          </Link>
        </div>
      </nav>
      <div className="flex items-center justify-between p-4 border-t">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </>
  );
}

/** Fixed sidebar for desktop (sm and up). */
export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
      <div className="flex h-16 items-center px-6 border-b shrink-0">
        <ShieldAlert className="h-6 w-6 text-orange-600 mr-2" />
        <span className="font-bold">Admin Panel</span>
      </div>
      <AdminNav />
    </aside>
  );
}

/** Sticky top bar + slide-in drawer for mobile (below sm). */
export function AdminMobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sm:hidden sticky top-0 z-20 flex items-center gap-2 px-3 h-14 border-b bg-background">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open admin menu">
        <Menu className="h-6 w-6" />
      </Button>
      <ShieldAlert className="h-5 w-5 text-orange-600" />
      <span className="font-bold">Admin Panel</span>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col gap-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex h-16 items-center px-6 border-b shrink-0">
            <ShieldAlert className="h-6 w-6 text-orange-600 mr-2" />
            <span className="font-bold">Admin Panel</span>
          </div>
          <AdminNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
