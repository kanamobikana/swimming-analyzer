/**
 * Métricas calculadas a partir de séries por segundo (streams do Strava,
 * arquivos FIT/TCX): NP, VI, melhores médias móveis e desacoplamento.
 */

/** Média móvel de janela fixa (amostras de 1 Hz). */
function rolling(values: number[], window: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out.push(sum / window);
  }
  return out;
}

/** Normalized Power: média de 30s elevada à 4ª, média, raiz 4ª. */
export function normalizedPower(watts: number[]): number {
  const r = rolling(watts, 30);
  if (r.length === 0) return NaN;
  const m4 = r.reduce((a, x) => a + x ** 4, 0) / r.length;
  return Math.round(Math.pow(m4, 0.25));
}

/** Melhor média de `seconds` segundos (curva de potência). */
export function bestAverage(values: number[], seconds: number): number {
  const r = rolling(values, seconds);
  return r.length ? Math.round(Math.max(...r)) : NaN;
}

/**
 * Desacoplamento (Pw:HR ou Pa:HR): compara a razão saída/FC da 1ª metade com a 2ª.
 * < 5% em treino longo aeróbico = boa durabilidade.
 */
export function decoupling(output: number[], hr: number[]): number {
  const n = Math.min(output.length, hr.length);
  if (n < 600) return NaN;
  const half = Math.floor(n / 2);
  const ratio = (from: number, to: number) => {
    let o = 0;
    let h = 0;
    for (let i = from; i < to; i++) {
      o += output[i];
      h += hr[i];
    }
    return h > 0 ? o / h : NaN;
  };
  const first = ratio(0, half);
  const second = ratio(half, n);
  return (first - second) / first;
}

/** Tempo em cada zona dado limites superiores (ex.: FC [Z1max, Z2max, Z3max, Z4max]). */
export function timeInZones(values: number[], upperBounds: [number, number, number, number]): [number, number, number, number, number] {
  const z: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const v of values) {
    const idx = upperBounds.findIndex((u) => v <= u);
    z[idx === -1 ? 4 : idx]++;
  }
  return z;
}

/** Zonas de FC por LTHR (modelo Friel simplificado em 5 zonas). */
export function hrZonesFromLthr(lthr: number): [number, number, number, number] {
  return [Math.round(lthr * 0.81), Math.round(lthr * 0.89), Math.round(lthr * 0.93), Math.round(lthr * 1.0)];
}
