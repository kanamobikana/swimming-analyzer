import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="eyebrow mb-1">Acesso pessoal</div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Entrar</h1>
      <LoginForm next={next ?? '/'} />
    </div>
  );
}
