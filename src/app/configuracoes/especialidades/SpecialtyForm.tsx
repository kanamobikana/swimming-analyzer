'use client';

import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { formatDecimal } from '@/lib/format';
import type { Specialty } from '@/lib/pricing/types';
import { saveSpecialty } from '../actions';

export function SpecialtyForm({
  specialty,
  onDone,
}: {
  specialty?: Specialty;
  onDone?: () => void;
}) {
  const [allowsDouble, setAllowsDouble] = useState(specialty?.allowsDouble ?? false);

  return (
    <form
      action={async (fd) => {
        await saveSpecialty(fd);
        onDone?.();
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {specialty ? <input type="hidden" name="id" value={specialty.id} /> : null}
      <div className="sm:col-span-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={specialty?.name}
          placeholder="Ex: Psicologia"
        />
      </div>
      <div>
        <Label htmlFor="costPerCredit" hint="(R$)">
          Custo por crédito
        </Label>
        <Input
          id="costPerCredit"
          name="costPerCredit"
          type="text"
          inputMode="decimal"
          required
          defaultValue={specialty ? formatDecimal(specialty.costPerCredit) : ''}
          placeholder="ex: 25,00"
        />
      </div>
      <div>
        <Label htmlFor="creditDurationMin" hint="(min)">
          Duração do crédito
        </Label>
        <Input
          id="creditDurationMin"
          name="creditDurationMin"
          type="text"
          inputMode="numeric"
          required
          defaultValue={specialty?.creditDurationMin ?? 30}
          placeholder="ex: 30"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="allowsDouble"
            checked={allowsDouble}
            onChange={(e) => setAllowsDouble(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Permite sessão dupla (1 ou 2 créditos)
        </label>
      </div>
      {allowsDouble ? (
        <div className="sm:col-span-2">
          <Label htmlFor="realLongShare" hint="(% das sessões em 2 créditos)">
            Mix real de duração longa
          </Label>
          <Input
            id="realLongShare"
            name="realLongShare"
            type="text"
            inputMode="decimal"
            defaultValue={
              specialty ? formatDecimal(Math.round(specialty.realLongShare * 1000) / 10) : '24'
            }
            placeholder="ex: 24"
          />
          <p className="mt-1 text-xs text-muted">
            O restante é considerado sessão curta (1 crédito). Usado no custo
            real, diferente do preço de venda.
          </p>
        </div>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">{specialty ? 'Salvar' : 'Adicionar especialidade'}</Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function SpecialtyRowEditor({ specialty }: { specialty: Specialty }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <SpecialtyForm specialty={specialty} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <Button variant="ghost" onClick={() => setEditing(true)}>
      Editar
    </Button>
  );
}
