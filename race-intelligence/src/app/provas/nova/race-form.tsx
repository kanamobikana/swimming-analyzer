'use client';

import { startTransition, useActionState, useRef } from 'react';
import { createRace, previewResults, type PreviewState } from '@/app/actions';
import { Button, Card, Field, inputCls } from '@/components/ui';
import { formatDuration } from '@/lib/domain/time';

export function RaceForm({ athleteName }: { athleteName: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, create, creating] = useActionState(createRace, {});
  const [preview, runPreview, previewing] = useActionState(previewResults, {} as PreviewState);

  return (
    <form ref={formRef} action={create} className="space-y-4">
      <Card eyebrow="1 · Prova">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Nome *"><input name="name" required placeholder="IRONMAN 70.3 Florianópolis" className={inputCls} /></Field></div>
          <Field label="Data *"><input name="date" type="date" required className={inputCls} /></Field>
          <Field label="Local"><input name="location" placeholder="Florianópolis, SC" className={inputCls} /></Field>
          <Field label="Distância">
            <select name="distance" defaultValue="70.3" className={inputCls}>
              <option value="sprint">Sprint</option>
              <option value="olympic">Olímpico</option>
              <option value="70.3">70.3</option>
              <option value="full">Full IRONMAN</option>
              <option value="half_marathon">Meia maratona</option>
              <option value="marathon">Maratona</option>
              <option value="run_10k">10 km</option>
              <option value="run_5k">5 km</option>
            </select>
          </Field>
          <Field label="Marca">
            <select name="brand" defaultValue="IRONMAN 70.3" className={inputCls}>
              <option>IRONMAN</option>
              <option>IRONMAN 70.3</option>
              <option>Challenge</option>
              <option>T100</option>
              <option>Independente</option>
            </select>
          </Field>
          <Field label="Categoria" hint="Vazio = calculada pela data de nascimento"><input name="category" placeholder="M45-49" className={inputCls} /></Field>
          <Field label="Nº de peito"><input name="bibNumber" className={inputCls} /></Field>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-accent">Condições e percurso real</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Clima"><input name="weather" placeholder="Sol, vento" className={inputCls} /></Field>
            <Field label="Temp. ar (°C)"><input name="airTempC" inputMode="decimal" className={inputCls} /></Field>
            <Field label="Vento (km/h)"><input name="windKmh" inputMode="decimal" className={inputCls} /></Field>
            <Field label="Temp. água (°C)"><input name="waterTempC" inputMode="decimal" className={inputCls} /></Field>
            <Field label="Wetsuit">
              <select name="wetsuit" defaultValue="" className={inputCls}><option value="">—</option><option value="yes">Permitido</option><option value="no">Proibido</option></select>
            </Field>
            <Field label="Sua potência média (W)" hint="Calibra o simulador"><input name="myBikePowerW" inputMode="numeric" className={inputCls} /></Field>
            <Field label="Natação real (m)"><input name="swimM" inputMode="numeric" placeholder="nominal" className={inputCls} /></Field>
            <Field label="Bike real (km)"><input name="bikeKm" inputMode="decimal" placeholder="nominal" className={inputCls} /></Field>
            <Field label="Corrida real (km)"><input name="runKm" inputMode="decimal" placeholder="nominal" className={inputCls} /></Field>
            <div className="sm:col-span-3"><Field label="Observações"><input name="notes" className={inputCls} /></Field></div>
          </div>
        </details>
      </Card>

      <Card eyebrow="2 · Resultados oficiais">
        <div className="grid gap-3">
          <Field label="URL oficial de resultados" hint="Tabelas HTML, CSV e JSON são lidos automaticamente. Sites que carregam via JavaScript (ex.: IRONMAN) pedem colar a tabela abaixo.">
            <input name="resultsUrl" type="url" placeholder="https://…" className={inputCls} />
          </Field>
          <Field label="…ou cole a tabela de resultados" hint="Selecione a tabela no site (com o cabeçalho) e cole aqui. Aceita CSV/TSV.">
            <textarea name="resultsText" rows={5} className={`${inputCls} font-mono text-xs`} placeholder={'Pos\tNome\tCategoria\tSwim\tT1\tBike\tT2\tRun\tTotal'} />
          </Field>
          <Field label="Seu nome como aparece no resultado"><input name="myName" defaultValue={athleteName} className={inputCls} /></Field>
          <div className="flex flex-wrap items-center gap-3">
            {/* Chamada manual (não formAction): o React 19 resetaria o formulário após a ação. */}
            <Button type="button" variant="ghost" disabled={previewing} onClick={() => formRef.current && startTransition(() => runPreview(new FormData(formRef.current!)))}>{previewing ? 'Lendo…' : 'Pré-visualizar importação'}</Button>
            {preview.outcome && <span className={`text-xs ${preview.outcome.ok ? 'text-good' : 'text-bad'}`}>{preview.outcome.message}</span>}
          </div>
          {preview.outcome?.ok && (
            <div className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
              <div>Colunas: {Object.entries(preview.outcome.columns).map(([k, v]) => `${k}←“${v}”`).join(' · ')}</div>
              <div className="mt-1">Categorias: {preview.categories?.slice(0, 8).map((c) => `${c.category} (${c.count})`).join(' · ')}</div>
              <div className="mt-1 font-medium text-ink">
                {preview.me ? `Você: ${preview.me.name} · ${preview.me.category ?? '—'} · ${preview.me.total ? formatDuration(preview.me.total) : '—'}` : 'Não encontrei você — confira o nome/nº de peito ou preencha o resultado manual abaixo.'}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card eyebrow="3 · Resultado manual (opcional)">
        <p className="mb-3 text-xs text-muted">Use se não houver tabela oficial ou se você não for encontrado nela. Sem o field, não há análise de categoria.</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          <Field label="Swim"><input name="manualSwim" placeholder="36:50" className={inputCls} /></Field>
          <Field label="T1"><input name="manualT1" placeholder="3:20" className={inputCls} /></Field>
          <Field label="Bike"><input name="manualBike" placeholder="2:28:30" className={inputCls} /></Field>
          <Field label="T2"><input name="manualT2" placeholder="2:05" className={inputCls} /></Field>
          <Field label="Run"><input name="manualRun" placeholder="1:37:20" className={inputCls} /></Field>
          <Field label="Total"><input name="manualTotal" placeholder="4:48:05" className={inputCls} /></Field>
          <Field label="Pos. cat."><input name="manualCategoryRank" inputMode="numeric" className={inputCls} /></Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={creating}>{creating ? 'Importando…' : 'Salvar prova'}</Button>
        {createState.error && <span className="text-sm text-bad">{createState.error}</span>}
      </div>
    </form>
  );
}
