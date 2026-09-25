import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { BottomNav, TopNav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Race Performance Intelligence',
  description: 'Onde estou, quanto falta para a vaga no Mundial e onde estão os minutos.',
};

export const viewport: Viewport = {
  themeColor: '#f4f5f7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
                <rect width="32" height="32" rx="8" fill="#0b0d12" />
                <path d="M7 21 L13 13 L18 18 L25 9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="25" cy="9" r="2.4" fill="#4a3aa7" stroke="#fff" strokeWidth="1.2" />
              </svg>
              <span className="text-sm font-semibold tracking-tight">
                Race<span className="hidden text-muted sm:inline"> Performance Intelligence</span>
              </span>
            </Link>
            <TopNav />
            <div className="flex gap-1.5 md:hidden">
              <Link href="/atletas" className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">Rivais</Link>
              <Link href="/perfil" className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">Perfil</Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
