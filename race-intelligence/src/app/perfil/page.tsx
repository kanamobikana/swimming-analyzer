import { getDataset } from '@/lib/data/repository';
import { currentCategory } from '@/lib/analytics/insights';
import { ageOn, categoryTimeline } from '@/lib/domain/race-meta';
import { formatDate } from '@/lib/domain/time';
import { stravaConfigured } from '@/lib/integrations/strava/client';
import { claudeConfigured } from '@/lib/ai/claude';
import { authEnabled } from '@/lib/auth/session';
import { Badge, Card, cx, PageHeader } from '@/components/ui';
import { ProfileForm } from './profile-form';
import { IntegrationsPanel } from './integrations';

const STRAVA_MSG: Record<string, string> = {
  connected: 'Strava conectado e primeira sincronização feita.',
  denied: 'Autorização negada no Strava.',
  bad_state: 'Falha de segurança no retorno do Strava (state). Tente de novo.',
  error: 'Erro ao trocar o código de autorização com o Strava.',
  not_configured: 'Defina STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no ambiente.',
  missing_code: 'O Strava não retornou o código de autorização.',
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataset();
  const a = ds.athlete;
  const cat = currentCategory(ds);
  const timeline = categoryTimeline(a.birthDate, a.sex, Number(ds.today.slice(0, 4)) - 2, 8);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Perfil do atleta" title={a.nickname ? `${a.name} (${a.nickname})` : a.name}
        subtitle={`${ageOn(a.birthDate, ds.today)} anos · categoria ${cat.now} · ${cat.next} a partir de ${cat.changesInYear}`}
        action={ds.meta.profileIsSample ? <Badge kind="mock">Perfil de exemplo</Badge> : undefined} />

      <Card eyebrow="Categoria por idade" title="Linha do tempo">
        <div className="flex flex-wrap gap-2">
          {timeline.map((t) => (
            <div key={t.year} className={cx('rounded-xl border px-3 py-2 text-center', t.changed ? 'border-accent bg-accent-soft' : 'border-line', String(t.year) === ds.today.slice(0, 4) && 'ring-1 ring-ink')}>
              <div className="num text-xs text-muted">{t.year}</div>
              <div className="text-sm font-semibold">{t.category}</div>
            </div>
          ))}
        </div>
      </Card>

      {a.estimates?.length ? (
        <Card eyebrow="Revisar" title="Valores estimados — confirme ou corrija abaixo" action={<Badge kind="estimate" />}>
          <ul className="list-disc space-y-1 pl-4 text-sm text-ink-2">{a.estimates.map((e) => <li key={e}>{e}</li>)}</ul>
        </Card>
      ) : null}

      <ProfileForm athlete={a} />

      {a.history.length > 0 && (
        <Card eyebrow="Histórico fisiológico" title="Testes e snapshots">
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-2 font-medium">Data</th><th className="py-2 text-right font-medium">FTP</th><th className="py-2 text-right font-medium">VO₂</th><th className="py-2 text-right font-medium">Peso</th><th className="py-2 text-right font-medium">Limiar</th><th className="py-2 text-right font-medium">CSS</th></tr></thead>
              <tbody className="num">
                {[...a.history].reverse().map((h) => (
                  <tr key={h.date} className="border-t border-line">
                    <td className="py-2">{formatDate(h.date)}</td>
                    <td className="py-2 text-right">{h.ftpW ?? '—'}</td>
                    <td className="py-2 text-right">{h.vo2max ?? '—'}</td>
                    <td className="py-2 text-right">{h.weightKg ?? '—'}</td>
                    <td className="py-2 text-right">{h.thresholdPaceSecPerKm ? `${Math.floor(h.thresholdPaceSecPerKm / 60)}:${String(h.thresholdPaceSecPerKm % 60).padStart(2, '0')}` : '—'}</td>
                    <td className="py-2 text-right">{h.cssSecPer100m ? `${Math.floor(h.cssSecPer100m / 60)}:${String(h.cssSecPer100m % 60).padStart(2, '0')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div id="integracoes">
        <IntegrationsPanel
          message={sp.strava ? STRAVA_MSG[sp.strava] : undefined}
          strava={{ configured: stravaConfigured(), connected: ds.meta.stravaConnected, athleteName: ds.meta.stravaAthleteName, lastSyncAt: ds.meta.lastSyncAt }}
          claude={claudeConfigured()}
          auth={authEnabled()}
          showSample={ds.meta.sampleRaces > 0 || ds.meta.activitiesSource === 'mock'}
          realActivities={ds.meta.activitiesSource !== 'mock' ? ds.activities.length : 0}
          seedSource={ds.meta.seedSource}
        />
      </div>
    </div>
  );
}
