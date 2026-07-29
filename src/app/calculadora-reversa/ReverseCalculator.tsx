'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, Input, Label, Select, Stat } from '@/components/ui';
import { formatBRL, formatPct } from '@/lib/format';
import {
  averageConsultPrice,
  noShowFactor,
  reversePricePerLife,
} from '@/lib/pricing/calc';
import type {
  GlobalConfig,
  PricingPackage,
  Specialty,
} from '@/lib/pricing/types';

export function ReverseCalculator({
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
  const [marginPct, setMarginPct] = useState(40);
  const [utilPct, setUtilPct] = useState(10);
  const [volumeIdx, setVolumeIdx] = useState(0);

  const pkg = packages.find((p) => p.id === packageId) ?? packages[0];

  const output = useMemo(() => {
    if (!pkg) return null;
    const ns = noShowFactor(config);
    const avgSell = averageConsultPrice(pkg, specMap, 'sell');
    const avgReal = averageConsultPrice(pkg, specMap, 'real');
    const discount = config.volumeBands[volumeIdx]?.discountPct ?? 0;
    try {
      const common = {
        desiredMargin: marginPct / 100,
        taxRate: config.taxRate,
        utilization: utilPct / 100,
        recurrence: pkg.recurrence,
        noShowFactor: ns,
        volumeDiscountPct: discount,
      };
      return {
        discount,
        sell: reversePricePerLife({ ...common, avgConsultCost: avgSell }),
        real: reversePricePerLife({ ...common, avgConsultCost: avgReal }),
        avgSell,
        avgReal,
      };
    } catch {
      return null;
    }
  }, [pkg, specMap, config, marginPct, utilPct, volumeIdx]);

  if (!pkg) {
    return (
      <Card>
        <div className="p-6 text-sm text-muted">Cadastre pacotes primeiro.</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Calculadora reversa (margem → preço)"
        description="Informe a margem desejada e a ferramenta devolve o preço por vida necessário, nas duas bases de custo."
      />
      <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Pacote</Label>
            <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · recorrência {p.recurrence}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="marginPct" hint="(%)">
              Margem desejada
            </Label>
            <Input
              id="marginPct"
              type="number"
              step="0.5"
              value={marginPct}
              onChange={(e) => setMarginPct(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="utilPct" hint="(%)">
              Utilização
            </Label>
            <Input
              id="utilPct"
              type="number"
              step="0.1"
              value={utilPct}
              onChange={(e) => setUtilPct(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label>Faixa de volume (desconto)</Label>
            <Select
              value={volumeIdx}
              onChange={(e) => setVolumeIdx(Number(e.target.value))}
            >
              {config.volumeBands.map((b, i) => (
                <option key={i} value={i}>
                  {b.label ?? `Faixa ${i + 1}`} · desconto {formatPct(b.discountPct, 0)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {output ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Stat
                  label="Preço necessário (base venda)"
                  value={formatBRL(output.sell)}
                  hint={`consulta média ${formatBRL(output.avgSell)}`}
                />
                <Stat
                  label="Preço necessário (base real)"
                  value={formatBRL(output.real)}
                  tone="positive"
                  hint={`consulta média ${formatBRL(output.avgReal)}`}
                />
              </div>
              <p className="text-sm text-muted">
                Para uma margem líquida de{' '}
                <strong>{formatPct(marginPct / 100)}</strong> com utilização de{' '}
                {formatPct(utilPct / 100)}
                {output.discount > 0
                  ? ` e desconto de volume de ${formatPct(output.discount, 0)}`
                  : ''}
                , cobrar o preço da <strong>base de venda</strong> preserva a
                margem mesmo no pior caso de duração. A base real mostra o piso
                teórico dado o mix de duração observado.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-warning">
              Combinação inválida: margem + imposto ({formatPct(config.taxRate)})
              não pode chegar a 100%.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
