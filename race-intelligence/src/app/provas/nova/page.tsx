import Link from 'next/link';
import { getDataset } from '@/lib/data/repository';
import { PageHeader } from '@/components/ui';
import { RaceForm } from './race-form';

export default async function NewRacePage() {
  const ds = await getDataset();
  return (
    <div>
      <div className="mb-2 text-xs text-muted"><Link href="/provas" className="hover:text-ink">← Provas</Link></div>
      <PageHeader eyebrow="Cadastro de prova" title="Nova prova"
        subtitle="Informe a URL oficial de resultados (ou cole a tabela copiada do site). O app extrai o field inteiro, encontra você pelo nome ou nº de peito e monta a análise da categoria." />
      <RaceForm athleteName={ds.athlete.name} />
    </div>
  );
}
