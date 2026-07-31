import { getConfig } from '@/lib/data';
import { ParametersForm } from './ParametersForm';

export const dynamic = 'force-dynamic';

export default async function ParametersPage() {
  const cfg = await getConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parâmetros globais</h1>
        <p className="mt-1 text-sm text-muted">
          Margem-alvo (líquida de imposto), imposto sobre a receita, no-show e as
          faixas configuráveis de utilização e volume. Todos os percentuais
          aceitam vírgula.
        </p>
      </div>
      <ParametersForm config={cfg} />
    </div>
  );
}
