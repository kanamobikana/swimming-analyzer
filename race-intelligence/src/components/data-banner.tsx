import Link from 'next/link';
import type { Dataset } from '@/lib/data/repository';

/** Aviso honesto quando a tela usa dados de exemplo. */
export function DataBanner({ ds }: { ds: Dataset }) {
  const parts: string[] = [];
  if (ds.meta.activitiesSource === 'mock') parts.push('treinos');
  if (ds.meta.sampleRaces > 0) parts.push(`${ds.meta.sampleRaces} provas`);
  if (ds.meta.profileIsSample) parts.push('perfil');
  if (!parts.length) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-surface px-3.5 py-2.5 text-xs text-ink-2">
      <span>
        <span className="font-semibold text-ink">Dados de exemplo</span> em uso: {parts.join(', ')}. Números ilustrativos até conectar Strava e importar suas provas.
      </span>
      <Link href="/perfil#integracoes" className="font-medium text-accent underline-offset-2 hover:underline">
        Conectar dados reais →
      </Link>
    </div>
  );
}
