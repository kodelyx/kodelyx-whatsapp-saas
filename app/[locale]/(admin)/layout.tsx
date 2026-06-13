import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { AdminSidebar, AdminMobileHeader } from './AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminSidebar />
      <main className="flex flex-1 flex-col min-w-0 sm:pl-64">
        <AdminMobileHeader />
        <div className="p-4 sm:p-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}