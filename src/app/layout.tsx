import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Starbem · Precificação',
  description:
    'Plataforma interna de precificação por vida elegível — pacotes, matriz de preço e margem real vs. de venda.',
};

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/simulador', label: 'Simulador' },
  { href: '/calculadora-reversa', label: 'Calculadora Reversa' },
  { href: '/configuracoes/especialidades', label: 'Especialidades' },
  { href: '/configuracoes/pacotes', label: 'Pacotes' },
  { href: '/configuracoes/parametros', label: 'Parâmetros' },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
                  S
                </span>
                <span className="text-sm font-semibold">Starbem Precificação</span>
              </Link>
              <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-2.5 py-1.5 text-muted transition hover:bg-background hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-border py-4 text-center text-xs text-muted">
            Ferramenta interna · a lógica de cálculo é validada por testes
            unitários contra o cenário de referência.
          </footer>
        </div>
      </body>
    </html>
  );
}
