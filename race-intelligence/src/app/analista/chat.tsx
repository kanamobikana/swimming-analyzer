'use client';

import { useRef, useState } from 'react';
import { markdownToHtml } from '@/lib/ai/markdown';
import { Button, cx } from '@/components/ui';

const SUGGESTIONS = [
  'Por que perdi tempo em São Paulo?',
  'Compare Brasília com São Paulo',
  'Quanto preciso melhorar para Top 5?',
  'Minha bike está evoluindo?',
  'Onde estão meus 10 minutos mais fáceis?',
  'Compare minhas últimas três provas',
  'Qual modalidade está limitando minha evolução?',
  'Se eu correr 4:25/km, onde teria terminado?',
  'Qual foi minha melhor prova considerando a força do field?',
];

interface Msg { role: 'user' | 'assistant'; content: string }

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: q.trim() }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/analyst', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      setMode(res.headers.get('X-Analyst-Mode') ?? undefined);
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: 'assistant', content: acc }]);
        endRef.current?.scrollIntoView({ block: 'end' });
      }
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Erro: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="min-h-[320px] space-y-4 p-4 sm:p-5">
        {messages.length === 0 && (
          <div>
            <div className="eyebrow mb-3">Sugestões</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-ink-2 transition hover:border-ink hover:text-ink">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm text-white">{m.content}</div>
            ) : (
              <div className="prose-analyst w-full max-w-[95%] text-sm leading-relaxed text-ink">
                {m.content ? <div dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} /> : <span className="text-muted">Analisando…</span>}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-line p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex.: onde estão meus 10 minutos mais fáceis?" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
        <Button disabled={busy || !input.trim()}>{busy ? '…' : 'Perguntar'}</Button>
      </form>
      {mode && <div className="px-4 pb-3 text-[11px] text-muted">Modo: {mode === 'claude' ? 'Claude' : 'analista local (determinístico)'}</div>}
    </div>
  );
}
