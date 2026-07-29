import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { getSpecialties } from '@/lib/data';
import { formatBRL, formatPct } from '@/lib/format';
import {
  realCostPerConsult,
  sellCostPerConsult,
} from '@/lib/pricing/calc';
import { deleteSpecialty } from '../actions';
import { SpecialtyForm, SpecialtyRowEditor } from './SpecialtyForm';

export const dynamic = 'force-dynamic';

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Especialidades</h1>
        <p className="mt-1 text-sm text-muted">
          A unidade de custo é o <strong>crédito</strong> (tempo mínimo de
          atendimento). Especialidades com sessão dupla têm custo de venda
          (duração cheia) diferente do custo real (mix observado).
        </p>
      </div>

      <Card>
        <CardHeader
          title="Cadastradas"
          description={`${specialties.length} especialidade(s)`}
        />
        {specialties.length === 0 ? (
          <EmptyState>Nenhuma especialidade cadastrada ainda.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Custo/crédito</th>
                  <th className="px-5 py-3">Duração</th>
                  <th className="px-5 py-3">Sessão dupla</th>
                  <th className="px-5 py-3">Custo venda</th>
                  <th className="px-5 py-3">Custo real</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {specialties.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">{s.name}</td>
                    <td className="px-5 py-3 tabnum">{formatBRL(s.costPerCredit)}</td>
                    <td className="px-5 py-3 tabnum">{s.creditDurationMin} min</td>
                    <td className="px-5 py-3">
                      {s.allowsDouble ? (
                        <Badge tone="brand">
                          {formatPct(s.realLongShare)} em 2 créditos
                        </Badge>
                      ) : (
                        <span className="text-muted">Não</span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabnum">
                      {formatBRL(sellCostPerConsult(s))}
                    </td>
                    <td className="px-5 py-3 tabnum text-positive">
                      {formatBRL(realCostPerConsult(s))}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <SpecialtyRowEditor specialty={s} />
                        <form action={deleteSpecialty}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button variant="danger" type="submit">
                            Excluir
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Nova especialidade" />
        <div className="p-5">
          <SpecialtyForm />
        </div>
      </Card>
    </div>
  );
}
