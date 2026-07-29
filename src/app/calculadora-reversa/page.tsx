import { getConfig, getPackages, getSpecialties } from '@/lib/data';
import { ReverseCalculator } from './ReverseCalculator';

export const dynamic = 'force-dynamic';

export default async function ReverseCalculatorPage() {
  const [packages, specialties, config] = await Promise.all([
    getPackages(),
    getSpecialties(),
    getConfig(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calculadora Reversa</h1>
        <p className="mt-1 text-sm text-muted">
          Da margem desejada ao preço por vida necessário.
        </p>
      </div>
      <ReverseCalculator
        packages={packages}
        specialties={specialties}
        config={config}
      />
    </div>
  );
}
