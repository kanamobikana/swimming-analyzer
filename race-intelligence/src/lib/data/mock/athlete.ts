import type { Athlete } from '../../domain/types';

/**
 * Perfil de exemplo. Valores fisiológicos são PLACEHOLDERS editáveis em /perfil
 * e serão substituídos por dados reais (Strava/Garmin/testes) quando conectados.
 */
export const MOCK_ATHLETE: Athlete = {
  id: 'me',
  name: 'Cristiano Kanashiro',
  nickname: 'Kana',
  birthDate: '1978-09-20',
  sex: 'M',
  weightKg: 72,
  heightCm: 175,
  ftpW: 268,
  vo2max: 55,
  hrMax: 181,
  lthr: 163,
  restingHr: 48,
  thresholdPaceSecPerKm: 4 * 60 + 18,
  cssSecPer100m: 60 + 47,
  injuries: [
    { date: '2024-10-01', description: 'Fascite plantar (pé esquerdo)', weeksOff: 3 },
  ],
  avgWeeklyHours: 11.5,
  mainGoal: 'Vaga no Mundial IRONMAN 70.3 (categoria M45-49)',
  targetRaceName: 'IRONMAN 70.3 Florianópolis',
  targetRaceDate: '2026-11-29',
  targetRaceDistance: '70.3',
  goals: [
    { id: 'g-swim', label: 'Natação em águas abertas', discipline: 'swim', metric: 'swim_pace_100m', target: 60 + 42, context: '1:40–1:45/100m em águas abertas' },
    { id: 'g-bike', label: 'Bike de prova', discipline: 'bike', metric: 'bike_speed_kmh', target: 37, context: 'média de prova ~37 km/h' },
    { id: 'g-run', label: 'Maratona do IRONMAN', discipline: 'run', metric: 'run_pace_km', target: 4 * 60 + 50, context: 'pace de 4:50/km no full' },
    { id: 'g-rank', label: 'Top 5 da categoria em 70.3', discipline: 'overall', metric: 'category_position', target: 5 },
  ],
  history: [
    { date: '2025-01-15', ftpW: 245, vo2max: 51, weightKg: 75, thresholdPaceSecPerKm: 4 * 60 + 32, cssSecPer100m: 60 + 56 },
    { date: '2025-05-10', ftpW: 252, vo2max: 52, weightKg: 74, thresholdPaceSecPerKm: 4 * 60 + 28, cssSecPer100m: 60 + 54 },
    { date: '2025-09-20', ftpW: 258, vo2max: 53, weightKg: 73.5, thresholdPaceSecPerKm: 4 * 60 + 25, cssSecPer100m: 60 + 51 },
    { date: '2026-01-20', ftpW: 262, vo2max: 54, weightKg: 73, thresholdPaceSecPerKm: 4 * 60 + 22, cssSecPer100m: 60 + 50 },
    { date: '2026-05-15', ftpW: 265, vo2max: 54, weightKg: 72.5, thresholdPaceSecPerKm: 4 * 60 + 20, cssSecPer100m: 60 + 48 },
    { date: '2026-09-10', ftpW: 268, vo2max: 55, weightKg: 72, thresholdPaceSecPerKm: 4 * 60 + 18, cssSecPer100m: 60 + 47 },
  ],
};
