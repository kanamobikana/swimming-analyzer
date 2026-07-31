import Link from 'next/link';
import { Badge, Button, Card, CardHeader, EmptyState, Stat } from '@/components/ui';
import {
  getConfig,
  getPackages,
  getSpecialties,
  specialtiesToMap,
} from '@/lib/data';
import { formatBRL, formatPct } from '@/lib/format';
import { buildPriceMatrix } from '@/lib/pricing/calc';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [packages, specialties, config] = await Promise.all([
    getPackages(),
    getSpecialties(),
    getConfig(),
  ]);
  const specMap = specialtiesToMap(specialties);
  const topBand = config.utilizationBands.length
    ? Math.max(...config.utilizationBands)
    : 0.1;
  const configInvalid = 1 - config.targetMargin - config.taxRate <= 0;

  return (
    <div className="space-y-8">
      {configInvalid ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-warning">
          <strong>Parâmetros inválidos:</strong> margem-alvo (
          {formatPct(config.targetMargin)}) + imposto ({formatPct(config.taxRate)})
          somam 100% ou mais. Ajuste em{' '}
          <Link href="/configuracoes/parametros" className="underline">
            Parâmetros
          </Link>{' '}
          (digite os percentuais com vírgula, ex.: 11,25).
        </div>
      ) : null}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-white p-8">
        <Badge tone="brand">Plataforma interna</Badge>
        <h1 className="mt-3 text-3xl font-semibold">
          Precificação por vida elegível
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Selecione as variáveis de um pacote — especialidades, volume,
          utilização e margem-alvo — e a plataforma calcula o preço por vida a
          cobrar, já validando a margem real por trás desse preço.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/simulador">
            <Button>Abrir simulador</Button>
          </Link>
          <Link href="/calculadora-reversa">
            <Button variant="secondary">Calculadora reversa</Button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Especialidades" value={specialties.length} />
        <Stat label="Pacotes" value={packages.length} />
        <Stat label="Margem-alvo" value={formatPct(config.targetMargin)} tone="brand" />
        <Stat label="Imposto" value={formatPct(config.taxRate)} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pacotes e preço de referência</h2>
          <Link href="/configuracoes/pacotes">
            <Button variant="ghost">Gerenciar pacotes</Button>
          </Link>
        </div>
        {packages.length === 0 ? (
          <Card>
            <EmptyState>
              Nenhum pacote ainda. Rode o seed (<code>npm run db:seed</code>) ou
              cadastre em Configurações.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {packages.map((pkg) => {
              let priceTopBand = 0;
              let excedente = 0;
              try {
                const m = buildPriceMatrix(pkg, specMap, config);
                const rowIdx = m.utilizationBands.indexOf(topBand);
                priceTopBand = m.cells[rowIdx]?.[0]?.price ?? 0;
                excedente = m.excedentePrice;
              } catch {
                /* invalid config */
              }
              return (
                <Card key={pkg.id}>
                  <CardHeader
                    title={pkg.name}
                    description={`Recorrência ${pkg.recurrence} consultas/mês`}
                    action={<Badge tone="brand">{pkg.specialties.length} especialidades</Badge>}
                  />
                  <div className="grid grid-cols-2 gap-4 p-5">
                    <Stat
                      label={`Preço/vida @ ${formatPct(topBand, 0)}`}
                      value={formatBRL(priceTopBand)}
                      hint="sem desconto de volume"
                    />
                    <Stat
                      label="Consulta excedente"
                      value={formatBRL(excedente)}
                      tone="brand"
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Configuração</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: '/configuracoes/especialidades', title: 'Especialidades', desc: 'Custo por crédito, sessão dupla e mix real.' },
            { href: '/configuracoes/pacotes', title: 'Pacotes', desc: 'Especialidades, mix e recorrência.' },
            { href: '/configuracoes/parametros', title: 'Parâmetros', desc: 'Margem, imposto, no-show e faixas.' },
          ].map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="h-full transition hover:border-brand">
                <div className="p-5">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted">{c.desc}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
