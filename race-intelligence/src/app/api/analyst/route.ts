import Anthropic from '@anthropic-ai/sdk';
import { getDataset } from '@/lib/data/repository';
import { buildAnalystContext } from '@/lib/ai/context';
import { localAnalyst } from '@/lib/ai/local-analyst';
import { claudeConfigured, streamAnalyst } from '@/lib/ai/claude';
import { requireAuth } from '@/lib/auth/guard';

interface Body {
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return new Response('Não autenticado.', { status: 401 });
  }
  const body = (await request.json()) as Body;
  const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return new Response('Mensagem vazia.', { status: 400 });
  const ds = await getDataset();

  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

  if (!claudeConfigured()) {
    return new Response(localAnalyst(ds, last.content), { headers: { ...headers, 'X-Analyst-Mode': 'local' } });
  }

  const stream = streamAnalyst(buildAnalystContext(ds), messages.map((m) => ({ role: m.role, content: m.content })));
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));
      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode('\n\n_(O modelo recusou esta pergunta. Resposta do analista local:)_\n\n' + localAnalyst(ds, last.content)));
        if (final.stop_reason === 'max_tokens') controller.enqueue(encoder.encode('\n\n_(resposta truncada)_'));
      } catch (e) {
        const msg =
          e instanceof Anthropic.AuthenticationError
            ? 'Chave da API inválida.'
            : e instanceof Anthropic.RateLimitError
              ? 'Limite de requisições atingido — tente em instantes.'
              : e instanceof Anthropic.APIError
                ? `Erro da API (${e.status}).`
                : 'Falha de conexão com a API.';
        controller.enqueue(encoder.encode(`\n\n_${msg} Resposta do analista local:_\n\n${localAnalyst(ds, last.content)}`));
      }
      controller.close();
    },
  });
  return new Response(readable, { headers: { ...headers, 'X-Analyst-Mode': 'claude' } });
}
