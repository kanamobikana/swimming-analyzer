'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardHeader, Input, Label } from '@/components/ui';
import { formatDecimal, parseNumber } from '@/lib/format';
import type { GlobalConfig } from '@/lib/pricing/types';
import { saveConfig } from '../actions';

type VolumeRow = { maxLives: string; discount: string; label: string };

export function ParametersForm({ config }: { config: GlobalConfig }) {
  const pct = (f: number) => formatDecimal(Math.round(f * 1e6) / 1e4);

  const [margin, setMargin] = useState(pct(config.targetMargin));
  const [tax, setTax] = useState(pct(config.taxRate));
  const [noShow, setNoShow] = useState(pct(config.noShowRate));
  const [repasse, setRepasse] = useState(pct(config.noShowRepassePct));

  const [utilBands, setUtilBands] = useState<string[]>(
    config.utilizationBands.length
      ? config.utilizationBands.map((b) => pct(b))
      : ['1'],
  );
  const [volBands, setVolBands] = useState<VolumeRow[]>(
    config.volumeBands.length
      ? config.volumeBands.map((b) => ({
          maxLives: b.maxLives === null ? '' : String(b.maxLives),
          discount: pct(b.discountPct),
          label: b.label ?? '',
        }))
      : [{ maxLives: '', discount: '0', label: '' }],
  );

  // Live validity preview.
  const marginF = parseNumber(margin) / 100;
  const taxF = parseNumber(tax) / 100;
  const noShowF = parseNumber(noShow) / 100;
  const repasseF = parseNumber(repasse) / 100;
  const divisor = 1 - marginF - taxF;
  const noShowFactor = (1 - noShowF) * 1 + noShowF * repasseF;
  const invalid = divisor <= 0;

  return (
    <form action={saveConfig} className="space-y-6">
      <Card>
        <CardHeader
          title="Margem, imposto e no-show"
          description="Digite os percentuais com vírgula, ex.: 11,25 · 10,5. Não precisa do símbolo %."
          action={
            invalid ? (
              <Badge tone="warning">Inválido: margem + imposto ≥ 100%</Badge>
            ) : (
              <Badge tone="positive">
                Divisor {formatDecimal(divisor)} · Fator no-show {formatDecimal(noShowFactor)}
              </Badge>
            )
          }
        />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <DecimalField
            id="targetMargin"
            name="targetMargin"
            label="Margem-alvo (líquida)"
            value={margin}
            onChange={setMargin}
          />
          <DecimalField
            id="taxRate"
            name="taxRate"
            label="Imposto sobre receita"
            value={tax}
            onChange={setTax}
          />
          <DecimalField
            id="noShowRate"
            name="noShowRate"
            label="No-show"
            value={noShow}
            onChange={setNoShow}
          />
          <DecimalField
            id="noShowRepassePct"
            name="noShowRepassePct"
            label="Repasse no no-show"
            value={repasse}
            onChange={setRepasse}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Faixas de utilização"
          description="Linhas da matriz. % da base elegível que usa o benefício no mês."
        />
        <div className="space-y-2 p-5">
          {utilBands.map((band, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-40">
                <Input
                  name="utilBand"
                  type="text"
                  inputMode="decimal"
                  value={band}
                  aria-label={`Faixa de utilização ${i + 1} (%)`}
                  onChange={(e) =>
                    setUtilBands((p) => p.map((b, idx) => (idx === i ? e.target.value : b)))
                  }
                  placeholder="ex: 1,5"
                />
              </div>
              <span className="text-sm text-muted">%</span>
              <Button
                type="button"
                variant="danger"
                onClick={() => setUtilBands((p) => p.filter((_, idx) => idx !== i))}
                disabled={utilBands.length === 1}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setUtilBands((p) => [...p, ''])}
          >
            + Adicionar faixa
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Faixas de volume e desconto"
          description="Colunas da matriz. Cada faixa aplica um desconto progressivo ao preço final."
        />
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <div className="col-span-5">Teto de vidas (vazio = &quot;acima de&quot;)</div>
            <div className="col-span-3">Desconto (%)</div>
            <div className="col-span-3">Rótulo</div>
            <div className="col-span-1" />
          </div>
          {volBands.map((row, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-5">
                <Input
                  name="volMaxLives"
                  type="text"
                  inputMode="numeric"
                  value={row.maxLives}
                  aria-label="Teto de vidas"
                  onChange={(e) =>
                    setVolBands((p) =>
                      p.map((r, idx) => (idx === i ? { ...r, maxLives: e.target.value } : r)),
                    )
                  }
                  placeholder="ex: 1000000"
                />
              </div>
              <div className="col-span-3">
                <Input
                  name="volDiscount"
                  type="text"
                  inputMode="decimal"
                  value={row.discount}
                  aria-label="Desconto (%)"
                  onChange={(e) =>
                    setVolBands((p) =>
                      p.map((r, idx) => (idx === i ? { ...r, discount: e.target.value } : r)),
                    )
                  }
                  placeholder="0"
                />
              </div>
              <div className="col-span-3">
                <Input
                  name="volLabel"
                  value={row.label}
                  aria-label="Rótulo"
                  onChange={(e) =>
                    setVolBands((p) =>
                      p.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  placeholder="até 1MM"
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setVolBands((p) => p.filter((_, idx) => idx !== i))}
                  disabled={volBands.length === 1}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setVolBands((p) => [...p, { maxLives: '', discount: '0', label: '' }])
            }
          >
            + Adicionar faixa
          </Button>
          <p className="text-xs text-muted">
            Deixe o teto vazio em uma linha para representar &quot;acima de&quot;. O
            desconto aceita vírgula (ex.: 2,5).
          </p>
        </div>
      </Card>

      <div>
        <Button type="submit" disabled={invalid}>
          Salvar parâmetros
        </Button>
        {invalid ? (
          <span className="ml-3 text-sm text-warning">
            Ajuste a margem/imposto antes de salvar.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function DecimalField({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} hint="(%)">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex: 11,25"
      />
    </div>
  );
}
