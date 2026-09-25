'use client';

import { useMemo, useState } from 'react';
import type { Benchmark, RaceResult, Splits } from '@/lib/domain/types';
import { calibrateModel, DEFAULT_BIKE_MODEL, placeInField, simulateSplits, speedForPower } from '@/lib/analytics/simulator';
import { formatDuration, formatGap, formatPace100, formatPaceKm, formatSpeed, parseDuration, paceSecPer100m, paceSecPerKm, speedKmh } from '@/lib/domain/time';
import { Badge, Card, cx, Stat } from '@/components/ui';

interface Props {
  race: { id: string; name: string; course: { swimM: number; bikeM: number; runM: number }; myBikePowerW?: number };
  me: { splits: Splits; totalS: number; rank: number; pace: { swim100: number; bikeKmh: number; runKm: number } };
  field: RaceResult[];
  p5?: Splits;
  lastSlot?: Benchmark;
  goals: { swim?: number; bike?: number; run?: number };
  weightKg: number;
}

function Slider({ label, value, min, max, step, onChange, display, invert, sub }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string; invert?: boolean; sub?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="num text-lg font-semibold">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--ink)]" style={invert ? { direction: 'rtl' } : undefined} aria-label={label} />
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function Simulator({ race, me, field, p5, lastSlot, goals, weightKg }: Props) {
  const model = useMemo(() => (race.myBikePowerW ? calibrateModel(me.pace.bikeKmh, race.myBikePowerW, { ...DEFAULT_BIKE_MODEL, massKg: weightKg + 9 }) : { ...DEFAULT_BIKE_MODEL, massKg: weightKg + 9 }), [race.myBikePowerW, me.pace.bikeKmh, weightKg]);
  const initial = {
    // Valores exatos: "Meu real" reproduz o tempo real ao segundo.
    swim: me.pace.swim100,
    bikeKmh: me.pace.bikeKmh,
    watts: race.myBikePowerW ?? 200,
    t1: me.splits.t1,
    t2: me.splits.t2,
    run: me.pace.runKm,
  };
  const [s, setS] = useState(initial);
  const [bikeMode, setBikeMode] = useState<'speed' | 'watts'>('speed');
  const set = (k: keyof typeof s) => (v: number) => setS((x) => ({ ...x, [k]: v }));

  const splits = simulateSplits(
    { swimPaceSecPer100: s.swim, bikeSpeedKmh: bikeMode === 'speed' ? s.bikeKmh : undefined, bikeWatts: bikeMode === 'watts' ? s.watts : undefined, t1S: s.t1, t2S: s.t2, runPaceSecPerKm: s.run },
    race.course,
    model,
  );
  const place = placeInField(splits, field);
  const delta = place.totalS - me.totalS;
  const slotGap = lastSlot ? place.totalS - lastSlot.totalS : undefined;

  const preset = (name: 'real' | 'goals' | 'p5' | 'slot') => {
    if (name === 'real') return setS(initial);
    if (name === 'goals') return setS((x) => ({ ...x, swim: goals.swim ?? x.swim, bikeKmh: goals.bike ?? x.bikeKmh, run: goals.run ?? x.run }));
    const src = name === 'p5' ? p5 : lastSlot?.splits;
    if (!src) return;
    setS({ swim: paceSecPer100m(src.swim, race.course.swimM), bikeKmh: speedKmh(src.bike, race.course.bikeM), watts: s.watts, t1: src.t1, t2: src.t2, run: paceSecPerKm(src.run, race.course.runM) });
    setBikeMode('speed');
  };

  const PRESETS: [Parameters<typeof preset>[0], string][] = [['real', 'Meu real'], ['goals', 'Minhas metas'], ['p5', 'Splits do P5'], ['slot', 'Splits da última vaga']];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2" eyebrow="Premissas" title={race.name}>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map(([k, l]) => (k !== 'slot' || lastSlot) && (k !== 'p5' || p5) && (
            <button key={k} type="button" onClick={() => preset(k)} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-ink">{l}</button>
          ))}
        </div>
        <div className="space-y-5">
          <Slider label="Swim pace /100m" value={s.swim} min={80} max={160} step={1} onChange={set('swim')} display={formatPace100(s.swim)} invert sub={`real ${formatPace100(me.pace.swim100)}`} />
          <div>
            <div className="mb-2 inline-flex rounded-lg border border-line p-0.5 text-xs">
              {(['speed', 'watts'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setBikeMode(m)} className={cx('rounded-md px-2.5 py-1', bikeMode === m ? 'bg-ink text-white' : 'text-ink-2')}>{m === 'speed' ? 'Velocidade' : 'Watts'}</button>
              ))}
            </div>
            {bikeMode === 'speed' ? (
              <Slider label="Bike" value={s.bikeKmh} min={28} max={45} step={0.1} onChange={set('bikeKmh')} display={formatSpeed(s.bikeKmh)} sub={`real ${formatSpeed(me.pace.bikeKmh)}`} />
            ) : (
              <Slider label="Bike (potência média)" value={s.watts} min={140} max={320} step={1} onChange={set('watts')} display={`${s.watts} W · ${(s.watts / weightKg).toFixed(2)} W/kg`} sub={`→ ${formatSpeed(speedForPower(s.watts, model))} · modelo ${race.myBikePowerW ? `calibrado com seus ${race.myBikePowerW} W nesta prova` : 'genérico (sem potência da prova)'}`} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Slider label="T1" value={s.t1} min={60} max={420} step={5} onChange={set('t1')} display={formatDuration(s.t1)} invert />
            <Slider label="T2" value={s.t2} min={30} max={300} step={5} onChange={set('t2')} display={formatDuration(s.t2)} invert />
          </div>
          <Slider label="Run pace /km" value={s.run} min={200} max={420} step={1} onChange={set('run')} display={formatPaceKm(s.run)} invert sub={`real ${formatPaceKm(me.pace.runKm)}`} />
          <label className="block text-xs text-ink-2">
            Ou digite um pace de corrida
            <input className="mt-1 w-full rounded-xl border border-line px-3 py-1.5 text-sm" placeholder="4:25" onBlur={(e) => { const v = parseDuration(e.target.value); if (Number.isFinite(v) && v > 120) set('run')(v); }} />
          </label>
        </div>
      </Card>

      <div className="space-y-4 lg:col-span-3">
        <Card eyebrow="Resultado estimado">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Stat label="Tempo" value={formatDuration(place.totalS)} size="lg" sub={<span className={delta < 0 ? 'text-good' : delta > 0 ? 'text-bad' : ''}>{formatGap(delta)} vs real ({formatDuration(me.totalS)})</span>} />
            <Stat label="Categoria" value={<>P{place.rank}<span className="text-base font-normal text-muted">/{place.fieldSize}</span></>} size="lg" sub={`real P${me.rank} · Top ${Math.round(place.percentile * 100)}%`} />
            {lastSlot && slotGap != null && (
              <Stat label={<span className="flex items-center gap-1.5">vs última vaga</span>} value={formatGap(slotGap)} size="lg" tone={slotGap <= 0 ? 'good' : undefined} sub={slotGap <= 0 ? 'no nível da vaga desta edição' : `precisa de mais ${formatDuration(slotGap)}`} />
            )}
          </div>
          <p className="mt-4 text-sm text-ink-2">
            Com essa performance você teria terminado em <b className="text-ink">P{place.rank}</b>
            {place.ahead && <> — logo atrás de {place.ahead.athleteName} ({formatDuration(place.ahead.totalS)})</>}
            {place.behind && <> e à frente de {place.behind.athleteName} ({formatDuration(place.behind.totalS)})</>}.
          </p>
          {bikeMode === 'watts' && <div className="mt-2"><Badge kind="estimate">bike por modelo de potência</Badge></div>}
        </Card>

        <Card eyebrow="Splits simulados">
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 font-medium">Split</th><th className="py-2 text-right font-medium">Real</th><th className="py-2 text-right font-medium">Simulado</th><th className="py-2 text-right font-medium">Δ</th><th className="py-2 text-right font-medium">Rank do split</th>
                </tr>
              </thead>
              <tbody className="num">
                {(['swim', 't1', 'bike', 't2', 'run'] as const).map((k) => {
                  const d = splits[k] - me.splits[k];
                  const rank = k === 'swim' || k === 'bike' || k === 'run' ? place.splitRanks[k] : undefined;
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-2 font-sans font-medium uppercase">{k}</td>
                      <td className="py-2 text-right text-ink-2">{formatDuration(me.splits[k])}</td>
                      <td className="py-2 text-right font-semibold">{formatDuration(splits[k])}</td>
                      <td className={cx('py-2 text-right', d < 0 ? 'text-good' : d > 0 ? 'text-bad' : 'text-muted')}>{formatGap(d)}</td>
                      <td className="py-2 text-right text-ink-2">{rank ? `${rank}º` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
