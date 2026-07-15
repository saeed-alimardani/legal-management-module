'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  canManageUsers,
  canOffboard,
  canViewActivityLogs,
  roleLabel,
} from '@/lib/rbac';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/cases', label: 'Cases' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/notices', label: 'Notices' },
  { href: '/deadlines', label: 'Deadlines' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/documents', label: 'Documents' },
  { href: '/discussions', label: 'Discussions' },
  { href: '/financial-records', label: 'Financial Records' },
  { href: '/activity-logs', label: 'Activity Logs', adminOnly: true },
  { href: '/users', label: 'Users', adminOnly: true },
  { href: '/offboarding', label: 'Offboarding', adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && user && !canManageUsers(user.role)) return false;
    if (item.href === '/activity-logs' && user && !canViewActivityLogs(user.role)) {
      return false;
    }
    if (item.href === '/offboarding' && user && !canOffboard(user.role)) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h1 className="text-lg font-bold text-brand-700">Legal Ops</h1>
          {user && (
            <p className="mt-1 text-xs text-slate-500">
              {user.fullName} · {roleLabel(user.role)}
            </p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
