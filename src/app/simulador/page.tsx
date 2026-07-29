import { getConfig, getPackages, getSpecialties } from '@/lib/data';
import { Simulator } from './Simulator';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  const [packages, specialties, config] = await Promise.all([
    getPackages(),
    getSpecialties(),
    getConfig(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Simulador</h1>
        <p className="mt-1 text-sm text-muted">
          Preço por vida em tempo real, com a matriz completa e a comparação
          entre margem de venda e margem real.
        </p>
      </div>
      <Simulator packages={packages} specialties={specialties} config={config} />
    </div>
  );
}
