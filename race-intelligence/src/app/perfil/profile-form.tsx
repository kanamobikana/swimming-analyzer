'use client';

import { useActionState } from 'react';
import { saveProfile } from '@/app/actions';
import type { Athlete } from '@/lib/domain/types';
import { formatDuration } from '@/lib/domain/time';
import { Button, Card, Field, inputCls } from '@/components/ui';

export function ProfileForm({ athlete: a }: { athlete: Athlete }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action}>
      <Card eyebrow="Dados do atleta" title="Perfil e fisiologia"
        action={<div className="flex items-center gap-3">{state.ok && <span className="text-xs text-good">Salvo</span>}{state.error && <span className="text-xs text-bad">{state.error}</span>}<Button disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button></div>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome"><input name="name" defaultValue={a.name} className={inputCls} /></Field>
          <Field label="Apelido"><input name="nickname" defaultValue={a.nickname} className={inputCls} /></Field>
          <Field label="Nascimento"><input name="birthDate" type="date" defaultValue={a.birthDate} className={inputCls} /></Field>
          <Field label="Sexo">
            <select name="sex" defaultValue={a.sex} className={inputCls}><option value="M">Masculino</option><option value="F">Feminino</option></select>
          </Field>
          <Field label="Peso (kg)"><input name="weightKg" inputMode="decimal" defaultValue={a.weightKg} className={inputCls} /></Field>
          <Field label="Altura (cm)"><input name="heightCm" inputMode="numeric" defaultValue={a.heightCm} className={inputCls} /></Field>
          <Field label="FTP (W)"><input name="ftpW" inputMode="numeric" defaultValue={a.ftpW} className={inputCls} /></Field>
          <Field label="VO₂ Max"><input name="vo2max" inputMode="decimal" defaultValue={a.vo2max} className={inputCls} /></Field>
          <Field label="FC máxima"><input name="hrMax" inputMode="numeric" defaultValue={a.hrMax} className={inputCls} /></Field>
          <Field label="FC limiar (LTHR)"><input name="lthr" inputMode="numeric" defaultValue={a.lthr} className={inputCls} /></Field>
          <Field label="Pace de limiar (/km)"><input name="thresholdPace" defaultValue={formatDuration(a.thresholdPaceSecPerKm)} className={inputCls} /></Field>
          <Field label="CSS (/100m)"><input name="css" defaultValue={formatDuration(a.cssSecPer100m)} className={inputCls} /></Field>
          <Field label="Horas/semana (média)"><input name="avgWeeklyHours" inputMode="decimal" defaultValue={a.avgWeeklyHours} className={inputCls} /></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Objetivo principal"><input name="mainGoal" defaultValue={a.mainGoal} className={inputCls} /></Field></div>
          <div className="sm:col-span-2"><Field label="Prova-alvo"><input name="targetRaceName" defaultValue={a.targetRaceName} className={inputCls} /></Field></div>
          <Field label="Data da prova-alvo"><input name="targetRaceDate" type="date" defaultValue={a.targetRaceDate} className={inputCls} /></Field>
          <Field label="Distância-alvo">
            <select name="targetRaceDistance" defaultValue={a.targetRaceDistance} className={inputCls}><option value="70.3">70.3</option><option value="full">Full IRONMAN</option><option value="olympic">Olímpico</option><option value="sprint">Sprint</option></select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Histórico de lesões" hint='Uma por linha: "AAAA-MM-DD - descrição"'>
              <textarea name="injuries" rows={2} defaultValue={a.injuries.map((i) => `${i.date} - ${i.description}`).join('\n')} className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>
    </form>
  );
}
