import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { getPackages, getSpecialties, specialtiesToMap } from '@/lib/data';
import { formatBRL, formatPct } from '@/lib/format';
import { averageConsultPrice } from '@/lib/pricing/calc';
import { deletePackage } from '../actions';
import { PackageForm, PackageRowEditor } from './PackageForm';

export const dynamic = 'force-dynamic';

export default async function PackagesPage() {
  const [packages, specialties] = await Promise.all([
    getPackages(),
    getSpecialties(),
  ]);
  const specMap = specialtiesToMap(specialties);
  const nameOf = (id: string) => specMap.get(id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pacotes (planos)</h1>
        <p className="mt-1 text-sm text-muted">
          Cada pacote combina especialidades por um mix de uso e uma recorrência
          real (consultas/mês por usuário). O preço médio da consulta é a média
          ponderada pelo mix.
        </p>
      </div>

      {specialties.length === 0 ? (
        <Card>
          <EmptyState>
            Cadastre ao menos uma especialidade antes de criar pacotes.
          </EmptyState>
        </Card>
      ) : null}

      {packages.map((pkg) => {
        const avgSell = averageConsultPrice(pkg, specMap, 'sell');
        const avgReal = averageConsultPrice(pkg, specMap, 'real');
        return (
          <Card key={pkg.id}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {pkg.name}
                  <Badge tone="brand">recorrência {pkg.recurrence}/mês</Badge>
                </span>
              }
              description={
                <span>
                  Consulta média — venda {formatBRL(avgSell)} · custo real{' '}
                  <span className="text-positive">{formatBRL(avgReal)}</span>
                </span>
              }
              action={
                <div className="flex items-center gap-2">
                  <PackageRowEditor specialties={specialties} pkg={pkg} />
                  <form action={deletePackage}>
                    <input type="hidden" name="id" value={pkg.id} />
                    <Button variant="danger" type="submit">
                      Excluir
                    </Button>
                  </form>
                </div>
              }
            />
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {pkg.specialties.map((ps) => (
                <Badge key={ps.specialtyId}>
                  {nameOf(ps.specialtyId)} · {formatPct(ps.mixShare)}
                </Badge>
              ))}
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHeader title="Novo pacote" />
        <div className="p-5">
          {specialties.length > 0 ? (
            <PackageForm specialties={specialties} />
          ) : (
            <p className="text-sm text-muted">Cadastre especialidades primeiro.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
