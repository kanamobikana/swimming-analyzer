'use client';

import { useActionState } from 'react';
import { saveSlots } from '@/app/actions';
import type { SlotAllocation } from '@/lib/domain/types';
import { Button, Field, inputCls } from '@/components/ui';

export function SlotsForm({ raceId, slots }: { raceId: string; slots?: SlotAllocation }) {
  const [state, action, pending] = useActionState(saveSlots, {});
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-xs font-medium text-accent">{slots ? 'Editar vagas' : 'Cadastrar vagas'}</summary>
      <form action={action} className="mt-3 grid grid-cols-2 gap-3">
        <input type="hidden" name="raceId" value={raceId} />
        <Field label="Campeonato">
          <select name="championship" defaultValue={slots?.championship ?? 'IRONMAN 70.3 World Championship'} className={inputCls}>
            <option>IRONMAN 70.3 World Championship</option>
            <option>IRONMAN World Championship</option>
          </select>
        </Field>
        <Field label="Fonte">
          <select name="provenance" defaultValue={slots?.provenance ?? 'estimate'} className={inputCls}>
            <option value="official">Oficial (lista publicada)</option>
            <option value="estimate">Estimativa</option>
          </select>
        </Field>
        <Field label="Vagas totais"><input name="totalSlots" inputMode="numeric" defaultValue={slots?.totalSlots} className={inputCls} /></Field>
        <Field label="Vagas na categoria"><input name="categorySlots" inputMode="numeric" defaultValue={slots?.categorySlots} className={inputCls} /></Field>
        <Field label="Última posição com vaga" hint="Inclui rolldown"><input name="lastQualifierRank" inputMode="numeric" defaultValue={slots?.lastQualifierRank} className={inputCls} /></Field>
        <Field label="Critério de alocação"><input name="allocationRule" defaultValue={slots?.allocationRule} className={inputCls} /></Field>
        <div className="col-span-2"><Field label="Nota / fonte"><input name="sourceNote" defaultValue={slots?.sourceNote} className={inputCls} /></Field></div>
        <div className="col-span-2 flex items-center gap-3">
          <Button disabled={pending}>{pending ? 'Salvando…' : 'Salvar vagas'}</Button>
          {state.ok && <span className="text-xs text-good">Salvo.</span>}
          {state.error && <span className="text-xs text-bad">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}
