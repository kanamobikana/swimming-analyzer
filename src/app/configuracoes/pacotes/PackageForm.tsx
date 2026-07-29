'use client';

import { useState } from 'react';
import { Button, Input, Label, Select } from '@/components/ui';
import type { PricingPackage, Specialty } from '@/lib/pricing/types';
import { savePackage } from '../actions';

type Line = { specialtyId: string; mixPercent: number; contractedCredits: number };

export function PackageForm({
  specialties,
  pkg,
  onDone,
}: {
  specialties: Specialty[];
  pkg?: PricingPackage;
  onDone?: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(
    pkg
      ? pkg.specialties.map((ps) => ({
          specialtyId: ps.specialtyId,
          mixPercent: Math.round(ps.mixShare * 1000) / 10,
          contractedCredits: ps.contractedCredits,
        }))
      : [{ specialtyId: specialties[0]?.id ?? '', mixPercent: 100, contractedCredits: 0 }],
  );

  const mixTotal = lines.reduce((a, l) => a + (l.mixPercent || 0), 0);

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
          <Label htmlFor="recurrence" hint="(consultas/mês por usuário)">
            Recorrência real esperada
          </Label>
          <Input
            id="recurrence"
            name="recurrence"
            type="number"
            step="0.1"
            min="0"
            required
            defaultValue={pkg?.recurrence ?? 2}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Especialidades incluídas (mix de uso)</Label>
          <span
            className={`text-xs font-medium ${
              Math.abs(mixTotal - 100) < 0.05 ? 'text-positive' : 'text-warning'
            }`}
          >
            Soma do mix: {mixTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
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
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  aria-label="Mix %"
                  value={line.mixPercent}
                  onChange={(e) => update(i, { mixPercent: Number(e.target.value) })}
                  placeholder="Mix %"
                />
              </div>
              <div className="col-span-3">
                <Input
                  name="contractedCredits"
                  type="number"
                  step="1"
                  min="0"
                  aria-label="Créditos contratados"
                  value={line.contractedCredits}
                  onChange={(e) =>
                    update(i, { contractedCredits: Number(e.target.value) })
                  }
                  placeholder="Créditos/mês"
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
        <div className="mt-2 flex gap-3 text-xs text-muted">
          <span>Coluna 1: especialidade · Coluna 2: % do mix · Coluna 3: créditos contratados (teto)</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { specialtyId: specialties[0]?.id ?? '', mixPercent: 0, contractedCredits: 0 },
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
