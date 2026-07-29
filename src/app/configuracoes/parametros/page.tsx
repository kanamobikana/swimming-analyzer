import { Button, Card, CardHeader, Input, Label } from '@/components/ui';
import { getConfig } from '@/lib/data';
import { noShowFactor, pricingDivisor } from '@/lib/pricing/calc';
import { formatPct } from '@/lib/format';
import { saveConfig } from '../actions';

export const dynamic = 'force-dynamic';

const pct = (f: number) => Math.round(f * 10000) / 100; // fraction -> percent number

export default async function ParametersPage() {
  const cfg = await getConfig();
  let divisorLabel = '—';
  try {
    divisorLabel = pricingDivisor(cfg.targetMargin, cfg.taxRate).toFixed(4);
  } catch {
    divisorLabel = 'inválido';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parâmetros globais</h1>
        <p className="mt-1 text-sm text-muted">
          Margem-alvo (líquida de imposto), imposto sobre a receita, no-show e as
          faixas configuráveis de utilização e volume.
        </p>
      </div>

      <form action={saveConfig} className="space-y-6">
        <Card>
          <CardHeader
            title="Margem, imposto e no-show"
            description={`Divisor atual: 1 − margem − imposto = ${divisorLabel} · Fator no-show = ${noShowFactor(
              cfg,
            ).toFixed(4)}`}
          />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="targetMargin" hint="(%)">
                Margem-alvo (líquida)
              </Label>
              <Input id="targetMargin" name="targetMargin" type="number" step="0.01" defaultValue={pct(cfg.targetMargin)} />
            </div>
            <div>
              <Label htmlFor="taxRate" hint="(%)">
                Imposto sobre receita
              </Label>
              <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue={pct(cfg.taxRate)} />
            </div>
            <div>
              <Label htmlFor="noShowRate" hint="(%)">
                No-show
              </Label>
              <Input id="noShowRate" name="noShowRate" type="number" step="0.01" defaultValue={pct(cfg.noShowRate)} />
            </div>
            <div>
              <Label htmlFor="noShowRepassePct" hint="(%)">
                Repasse no no-show
              </Label>
              <Input id="noShowRepassePct" name="noShowRepassePct" type="number" step="0.01" defaultValue={pct(cfg.noShowRepassePct)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Faixas de utilização"
            description="Linhas da matriz. % da base elegível que usa o benefício no mês. Separe por vírgula."
          />
          <div className="p-5">
            <Label htmlFor="utilizationBands" hint="(%, separadas por vírgula)">
              Faixas
            </Label>
            <Input
              id="utilizationBands"
              name="utilizationBands"
              defaultValue={cfg.utilizationBands.map((b) => pct(b)).join(', ')}
              placeholder="1, 1.5, 2, 3, 4, 5, 6, 8, 10"
            />
            <p className="mt-1 text-xs text-muted">
              Atual: {cfg.utilizationBands.map((b) => formatPct(b, 1)).join(' · ')}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Faixas de volume e desconto"
            description="Colunas da matriz. Cada faixa aplica um desconto progressivo ao preço final."
          />
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <div className="col-span-5">Teto de vidas (vazio = acima)</div>
              <div className="col-span-4">Desconto (%)</div>
              <div className="col-span-3">Rótulo</div>
            </div>
            {[...cfg.volumeBands, { maxLives: 0, discountPct: 0, label: '' }, { maxLives: 0, discountPct: 0, label: '' }]
              .slice(0, Math.max(cfg.volumeBands.length + 1, 4))
              .map((band, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Input
                      name="volMaxLives"
                      type="number"
                      min="0"
                      defaultValue={
                        i < cfg.volumeBands.length
                          ? cfg.volumeBands[i].maxLives ?? ''
                          : ''
                      }
                      placeholder="ex: 1000000"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      name="volDiscount"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={i < cfg.volumeBands.length ? pct(cfg.volumeBands[i].discountPct) : ''}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      name="volLabel"
                      defaultValue={i < cfg.volumeBands.length ? cfg.volumeBands[i].label ?? '' : ''}
                      placeholder="até 1MM"
                    />
                  </div>
                </div>
              ))}
            <p className="text-xs text-muted">
              Deixe uma linha com o teto vazio para representar &quot;acima de&quot;. Linhas totalmente vazias são ignoradas.
            </p>
          </div>
        </Card>

        <div>
          <Button type="submit">Salvar parâmetros</Button>
        </div>
      </form>
    </div>
  );
}
