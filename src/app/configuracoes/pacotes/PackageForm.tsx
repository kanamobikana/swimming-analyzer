'use client';

import { useState } from 'react';
import { Button, Input, Label, Select } from '@/components/ui';
import { formatDecimal, parseNumber } from '@/lib/format';
import type { PricingPackage, Specialty } from '@/lib/pricing/types';
import { savePackage } from '../actions';

type Line = { specialtyId: string; mix: string; credits: string };

export function PackageForm({
  specialties,
  pkg,
  onDone,
}: {
  specialties: Specialty[];
  pkg?: PricingPackage;
  onDone?: () => void;
}) {
  const [recurrence, setRecurrence] = useState(
    pkg ? formatDecimal(pkg.recurrence) : '2',
  );
  const [lines, setLines] = useState<Line[]>(
    pkg
      ? pkg.specialties.map((ps) => ({
          specialtyId: ps.specialtyId,
          mix: formatDecimal(Math.round(ps.mixShare * 1000) / 10),
          credits: String(ps.contractedCredits ?? ''),
        }))
      : [{ specialtyId: specialties[0]?.id ?? '', mix: '100', credits: '' }],
  );

  const mixTotal = lines.reduce((a, l) => a + parseNumber(l.mix), 0);
  const mixOk = Math.abs(mixTotal - 100) < 0.05;

  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <form
      action={async (fd) => {
        await savePackage(fd);
        onDone?.();
      }}
      className="space-y-4"
    >
      {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome do pacote</Label>
          <Input id="name" name="name" required defaultValue={pkg?.name} placeholder="Ex: TP2/TP3" />
        </div>
        <div>
          <Label htmlFor="recurrence">Recorrência real esperada</Label>
          <Input
            id="recurrence"
            name="recurrence"
            type="text"
            inputMode="decimal"
            required
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            placeholder="ex: 2"
          />
          <p className="mt-1 text-xs text-muted">
            Média de <strong>consultas/mês por usuário</strong> que realmente
            acontece — vem do histórico da plataforma, não do teto do plano.
            Ex.: mesmo ofertando 4 consultas, a recorrência real costuma ser ~2.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label>Especialidades incluídas</Label>
          <span className={`text-xs font-medium ${mixOk ? 'text-positive' : 'text-warning'}`}>
            Soma do mix: {formatDecimal(mixTotal)}%{mixOk ? '' : ' (deve somar 100%)'}
          </span>
        </div>
        <p className="mb-2 text-xs text-muted">
          O <strong>mix de uso</strong> é a fatia das consultas do pacote que vai
          para cada especialidade (deve somar 100%). <strong>Créditos
          contratados</strong> é o teto do plano por mês para aquela
          especialidade (usado como referência).
        </p>

        <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
          <div className="col-span-5">Especialidade</div>
          <div className="col-span-3">Mix de uso (%)</div>
          <div className="col-span-3">Créditos contratados/mês</div>
          <div className="col-span-1" />
        </div>

        <div className="mt-1 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-5">
                <Select
                  name="specialtyId"
                  value={line.specialtyId}
                  onChange={(e) => update(i, { specialtyId: e.target.value })}
                >
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-3">
                <Input
                  name="mixShare"
                  type="text"
                  inputMode="decimal"
                  aria-label="Mix de uso (%)"
                  value={line.mix}
                  onChange={(e) => update(i, { mix: e.target.value })}
                  placeholder="ex: 90"
                />
              </div>
              <div className="col-span-3">
                <Input
                  name="contractedCredits"
                  type="text"
                  inputMode="numeric"
                  aria-label="Créditos contratados/mês"
                  value={line.credits}
                  onChange={(e) => update(i, { credits: e.target.value })}
                  placeholder="ex: 4"
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { specialtyId: specialties[0]?.id ?? '', mix: '', credits: '' },
            ])
          }
        >
          + Adicionar especialidade
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="submit">{pkg ? 'Salvar' : 'Criar pacote'}</Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function PackageRowEditor({
  specialties,
  pkg,
}: {
  specialties: Specialty[];
  pkg: PricingPackage;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-background p-4">
        <PackageForm specialties={specialties} pkg={pkg} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <Button variant="ghost" onClick={() => setEditing(true)}>
      Editar
    </Button>
  );
}
