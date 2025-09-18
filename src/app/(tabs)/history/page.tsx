'use client';

import { useEffect, useState } from 'react';

type HistoryItem = {
  id: string;
  url: string;
  prompt: string;
  negative_prompt: string | null;
  resolution: string;
  color: string | null;
  guidance: number | null;
  seed: string | null;
  created_at: string;
};

type HistoryResponse = {
  items: HistoryItem[];
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return d; }
}

const PAGE_SIZE = 8; 

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [page] = useState(1); 

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true); setErr(null);
      try {
        const url = new URL('/api/history', window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(PAGE_SIZE));
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: HistoryResponse = await res.json();
        if (!res.ok) throw new Error((data as any)?.error ?? 'Failed to load');
        if (cancel) return;
        setItems(data.items);
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Unexpected error');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [page]);

  return (
    <main className="max-w-6xl mx-auto px-6 pt-6">
      
      <h1 className="text-[18px] font-semibold mb-8">Generation History</h1>

      {err && <p className="text-sm text-red-400 mb-4">{err}</p>}

      
      <section>
        {items.map((it, idx) => (
          <div key={it.id}>
            <article className="grid gap-6 py-8 md:grid-cols-[minmax(260px,320px)_1fr] md:items-start md:gap-8 md:py-10">
              
              <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-[#121826] bg-[#0f1422] md:mx-0 md:w-[320px] md:max-w-none">
                <img src={it.url} alt={it.prompt} className="block h-auto w-full" />
              </div>

              
              <div className="grid gap-y-4 text-[13px] sm:grid-cols-2 sm:gap-x-10">
                <div className="sm:col-span-2">
                  <div className="text-xs text-white/60 mb-1">Prompt details</div>
                  <div className="leading-relaxed text-white/90">{it.prompt}</div>
                </div>

                <div>
                  <div className="text-xs text-white/60 mb-1">Negative prompt</div>
                  <div className="text-white/90">{it.negative_prompt || 'Null'}</div>
                </div>

                <div>
                  <div className="text-xs text-white/60 mb-1">Created on</div>
                  <div className="text-white/90">{fmtDate(it.created_at)}</div>
                </div>

                <div>
                  <div className="text-xs text-white/60 mb-1">Input Resolution</div>
                  <div className="text-white/90">{it.resolution || '—'}</div>
                </div>

                <div>
                  <div className="text-xs text-white/60 mb-1">Seed</div>
                  <div className="text-white/90">{it.seed || '—'}</div>
                </div>
              </div>
            </article>

            
            {idx < items.length - 1 && (
              <div className="my-6 border-t border-white/10" />
            )}
          </div>
        ))}

        {!loading && items.length === 0 && (
          <p className="opacity-70">No generations yet.</p>
        )}
      </section>
    </main>
  );
}
