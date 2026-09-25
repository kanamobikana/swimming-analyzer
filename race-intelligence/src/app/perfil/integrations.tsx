'use client';

import { useActionState, useState, useTransition } from 'react';
import { logout, setSampleData, stravaDisconnect, stravaSync, uploadActivity } from '@/app/actions';
import { Badge, Button, Card } from '@/components/ui';

export function IntegrationsPanel(props: {
  message?: string;
  strava: { configured: boolean; connected: boolean; athleteName?: string; lastSyncAt?: string };
  claude: boolean;
  auth: boolean;
  showSample: boolean;
  realActivities: number;
  seedSource?: string;
}) {
  const [pending, start] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string>();
  const [upload, uploadAction, uploading] = useActionState(uploadActivity, {});

  return (
    <Card eyebrow="Integrações e dados" title="Fontes de dados">
      {props.message && <div className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm">{props.message}</div>}
      {props.seedSource && (
        <div className="mb-4 rounded-xl border border-line px-3 py-2.5 text-xs text-ink-2">
          <span className="font-semibold text-ink">Snapshot real carregado:</span> {props.seedSource}. Para manter atualizado sem depender do Claude, conecte o app ao Strava abaixo.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Strava</span>
            {props.strava.connected ? <Badge kind="official">Conectado</Badge> : <Badge kind="mock">Desconectado</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Corrida, bike, rolo, natação, força. Importa FC, potência, NP, cadência, elevação, zonas, voltas e best efforts; TSS/IF/VI/EF são calculados.
          </p>
          {props.strava.connected ? (
            <>
              <p className="mt-2 text-xs text-muted">{props.strava.athleteName} · {props.realActivities} atividades{props.strava.lastSyncAt ? ` · última sync ${new Date(props.strava.lastSyncAt).toLocaleString('pt-BR')}` : ''}</p>
              <div className="mt-3 flex gap-2">
                <Button disabled={pending} onClick={() => start(async () => setSyncMsg((await stravaSync()).message))}>{pending ? 'Sincronizando…' : 'Sincronizar agora'}</Button>
                <Button variant="ghost" onClick={() => start(() => stravaDisconnect())}>Desconectar</Button>
              </div>
              {syncMsg && <p className="mt-2 text-xs text-ink-2">{syncMsg}</p>}
            </>
          ) : props.strava.configured ? (
            <a href="/api/strava/connect" className="mt-3 inline-flex rounded-xl bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white">Conectar com Strava</a>
          ) : (
            <p className="mt-3 text-xs text-muted">Defina <code>STRAVA_CLIENT_ID</code> e <code>STRAVA_CLIENT_SECRET</code> (app em strava.com/settings/api, callback <code>/api/strava/callback</code>).</p>
          )}
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="font-semibold">Arquivos de atividade</div>
          <p className="mt-1 text-xs text-ink-2">GPX e TCX (Garmin, Wahoo, Coros). FIT: interface pronta, decoder na próxima fase.</p>
          <form action={uploadAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input name="file" type="file" accept=".gpx,.tcx,.fit" className="max-w-full text-xs" />
            <Button variant="ghost" disabled={uploading}>{uploading ? 'Importando…' : 'Importar'}</Button>
          </form>
          {upload.message && <p className="mt-2 text-xs text-ink-2">{upload.message}</p>}
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">AI Analyst</span>
            {props.claude ? <Badge kind="official">Claude ativo</Badge> : <Badge kind="manual">Modo local</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink-2">{props.claude ? 'Perguntas abertas respondidas pelo Claude com o snapshot do dashboard.' : 'Defina ANTHROPIC_API_KEY para respostas abertas. Sem ela, o analista local responde às perguntas-chave com os mesmos números.'}</p>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="font-semibold">Dados de exemplo</div>
          <p className="mt-1 text-xs text-ink-2">Provas e treinos fictícios para explorar o produto. Desligue quando tiver dados reais.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => start(() => setSampleData(!props.showSample))}>{props.showSample ? 'Ocultar exemplos' : 'Mostrar exemplos'}</Button>
            {props.auth && <Button variant="ghost" onClick={() => start(() => logout())}>Sair</Button>}
          </div>
        </div>
      </div>
    </Card>
  );
}
