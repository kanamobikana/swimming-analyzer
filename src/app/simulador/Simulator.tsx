'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardHeader, Select, Stat } from '@/components/ui';
import { formatBRL, formatLives, formatPct } from '@/lib/format';
import {
  buildPriceMatrix,
  realizedMargin,
} from '@/lib/pricing/calc';
import type {
  GlobalConfig,
  PricingPackage,
  Specialty,
} from '@/lib/pricing/types';

type MarginView = 'sell' | 'real';

export function Simulator({
  packages,
  specialties,
  config,
}: {
  packages: PricingPackage[];
  specialties: Specialty[];
  config: GlobalConfig;
}) {
  const specMap = useMemo(
    () => new Map(specialties.map((s) => [s.id, s])),
    [specialties],
  );
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');
  const [marginView, setMarginView] = useState<MarginView>('sell');

  const pkg = packages.find((p) => p.id === packageId) ?? packages[0];

  const matrix = useMemo(() => {
    if (!pkg) return null;
    try {
      return buildPriceMatrix(pkg, specMap, config);
    } catch {
      return null;
    }
  }, [pkg, specMap, config]);

  // Reference realized-margin scenario controls.
  const maxBandCap = config.utilizationBands.length
    ? Math.max(...config.utilizationBands)
    : 0.1;
  const [scenarioUtil, setScenarioUtil] = useState(0.126);
  const [primaryShare, setPrimaryShare] = useState(0.9); // share in first package

  const realized = useMemo(() => {
    if (packages.length === 0) return null;
    const primary = pkg ?? packages[0];
    const secondary = packages.find((p) => p.id !== primary.id) ?? primary;
    const mix =
      secondary.id === primary.id
        ? [{ pkg: primary, livesShare: 1 }]
        : [
            { pkg: primary, livesShare: primaryShare },
            { pkg: secondary, livesShare: 1 - primaryShare },
          ];
    try {
      return {
        secondary,
        result: realizedMargin({
          packages: mix,
          specialties: specMap,
          cfg: config,
          utilization: scenarioUtil,
          maxBandCap,
        }),
      };
    } catch {
      return null;
    }
  }, [packages, pkg, primaryShare, scenarioUtil, specMap, config, maxBandCap]);

  if (!pkg) {
    return (
      <Card>
        <div className="p-6 text-sm text-muted">
          Cadastre especialidades e pelo menos um pacote para simular preços.
        </div>
      </Card>
    );
  }

  const configInvalid = 1 - config.targetMargin - config.taxRate <= 0;
  if (!matrix) {
    return (
      <Card>
        <div className="space-y-2 p-6 text-sm">
          {configInvalid ? (
            <>
              <p className="font-medium text-warning">
                Parâmetros inválidos: margem-alvo ({formatPct(config.targetMargin)})
                + imposto ({formatPct(config.taxRate)}) somam 100% ou mais, então
                não é possível precificar.
              </p>
              <p className="text-muted">
                Ajuste os valores em{' '}
                <Link href="/configuracoes/parametros" className="text-brand underline">
                  Parâmetros
                </Link>
                . Dica: digite os percentuais com vírgula (ex.: 11,25).
              </p>
            </>
          ) : (
            <p className="text-muted">
              Não foi possível calcular a matriz com a configuração atual. Revise
              os pacotes e parâmetros.
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Simulador de preço por vida"
          description="Matriz linhas = faixas de utilização · colunas = faixas de volume (desconto já aplicado)."
          action={
            <div className="flex items-center gap-2">
              <Select
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                className="mt-0 w-44"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Link href={`/api/export/matrix?packageId=${pkg.id}`}>
                <Button variant="secondary">Exportar Excel</Button>
              </Link>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <Stat label="Consulta média (venda)" value={formatBRL(matrix.avgSellConsult)} />
          <Stat
            label="Consulta média (custo real)"
            value={formatBRL(matrix.avgRealConsult)}
            tone="positive"
          />
          <Stat
            label="Fator no-show"
            value={matrix.noShowFactor.toFixed(4)}
            hint={`divisor ${matrix.divisor.toFixed(4)}`}
          />
          <Stat
            label="Consulta excedente"
            value={formatBRL(matrix.excedentePrice)}
            hint="preço médio ÷ divisor (sem no-show)"
            tone="brand"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Matriz de preço — ${pkg.name}`}
          description="Valor por vida/mês. Passe o mouse para ver a margem de cada célula."
          action={
            <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
              <button
                onClick={() => setMarginView('sell')}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  marginView === 'sell' ? 'bg-brand text-white' : 'text-muted'
                }`}
              >
                Margem de Venda
              </button>
              <button
                onClick={() => setMarginView('real')}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  marginView === 'real' ? 'bg-brand text-white' : 'text-muted'
                }`}
              >
                Margem Real
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 text-left">Utilização ↓ / Volume →</th>
                {matrix.volumeBands.map((b, i) => (
                  <th key={i} className="px-3 py-2 text-right">
                    <div>{b.label ?? formatLives(b.maxLives)}</div>
                    {b.discountPct > 0 ? (
                      <div className="font-normal text-warning">
                        −{formatPct(b.discountPct, 0)}
                      </div>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.cells.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {formatPct(matrix.utilizationBands[ri])}
                  </td>
                  {row.map((cell, ci) => {
                    const margin =
                      marginView === 'sell' ? cell.saleMargin : cell.realMargin;
                    return (
                      <td
                        key={ci}
                        className="px-3 py-2 text-right tabnum"
                        title={`Margem venda ${formatPct(cell.saleMargin)} · Margem real ${formatPct(cell.realMargin)}`}
                      >
                        <div className="font-semibold">{formatBRL(cell.price)}</div>
                        <div
                          className={`text-xs ${
                            marginView === 'real' ? 'text-positive' : 'text-muted'
                          }`}
                        >
                          {formatPct(margin)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {realized ? (
        <Card>
          <CardHeader
            title="Margem Real vs. Margem de Venda"
            description="Cenário populacional: utilização observada e mix de vidas entre pacotes. Consumo acima da faixa máxima é cobrado como excedente."
          />
          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="text-sm font-medium">
                  Utilização observada: {formatPct(scenarioUtil)}
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.2}
                  step={0.001}
                  value={scenarioUtil}
                  onChange={(e) => setScenarioUtil(Number(e.target.value))}
                  className="mt-2 w-full accent-[color:var(--brand)]"
                />
                <p className="text-xs text-muted">
                  Faixa máxima da matriz: {formatPct(maxBandCap)}.{' '}
                  {scenarioUtil > maxBandCap
                    ? 'Excedente aplicado acima do teto.'
                    : 'Dentro da faixa (sem excedente).'}
                </p>
              </div>
              {realized.secondary.id !== pkg.id ? (
                <div>
                  <label className="text-sm font-medium">
                    {formatPct(primaryShare, 0)} em {pkg.name} ·{' '}
                    {formatPct(1 - primaryShare, 0)} em {realized.secondary.name}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={primaryShare}
                    onChange={(e) => setPrimaryShare(Number(e.target.value))}
                    className="mt-2 w-full accent-[color:var(--brand)]"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <Stat
                label="Margem de venda (nominal)"
                value={formatPct(realized.result.saleMargin)}
                hint="usada para precificar"
              />
              <Stat
                label="Margem real (operacional)"
                value={formatPct(realized.result.realMargin)}
                tone="positive"
                hint="mix real de duração"
              />
              <div className="col-span-2">
                <Badge tone="positive">
                  Ganho operacional de{' '}
                  {formatPct(
                    realized.result.realMargin - realized.result.saleMargin,
                  )}{' '}
                  não repassado ao preço
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
