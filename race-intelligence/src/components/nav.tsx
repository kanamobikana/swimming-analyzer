'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

export const NAV = [
  { href: '/', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { href: '/treinos', label: 'Treinos', icon: 'M3 17l5-6 4 4 8-9' },
  { href: '/provas', label: 'Provas', icon: 'M5 21V4h11l-2 4 2 4H5' },
  { href: '/worlds', label: 'Worlds', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c3 3 3 15 0 18m0-18c-3 3-3 15 0 18M3 12h18' },
  { href: '/simulador', label: 'What if', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
  { href: '/analista', label: 'Analyst', icon: 'M4 5h16v11H8l-4 4z' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {[...NAV, { href: '/atletas', label: 'Rivais', icon: '' }, { href: '/perfil', label: 'Perfil', icon: '' }].map((n) => (
        <Link key={n.href} href={n.href} className={cx('rounded-lg px-3 py-1.5 text-sm transition', isActive(path, n.href) ? 'bg-ink text-white' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-6">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} className={cx('flex flex-col items-center gap-0.5 py-2 text-[10px]', active ? 'text-ink' : 'text-muted')}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
