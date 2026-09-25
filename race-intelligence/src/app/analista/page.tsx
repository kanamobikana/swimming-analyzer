import { getDataset } from '@/lib/data/repository';
import { claudeConfigured, ANALYST_MODEL } from '@/lib/ai/claude';
import { PageHeader } from '@/components/ui';
import { DataBanner } from '@/components/data-banner';
import { Chat } from './chat';

export default async function AnalystPage() {
  const ds = await getDataset();
  const llm = claudeConfigured();
  return (
    <div>
      <DataBanner ds={ds} />
      <PageHeader eyebrow="AI Coach / Performance Analyst" title="Pergunte aos seus dados"
        subtitle={llm ? `Respostas do Claude (${ANALYST_MODEL}) usando exclusivamente os números do dashboard.` : 'Modo local: respostas calculadas direto dos números do dashboard. Defina ANTHROPIC_API_KEY para respostas abertas com o Claude.'} />
      <Chat />
    </div>
  );
}
