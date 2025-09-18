'use client';

import { useEffect, useState } from 'react';

type ColItem = {
  id: string;
  url: string;
  prompt: string;
  negative_prompt: string | null;
  resolution: string | null;
  color: string | null;
  guidance: number | null;
  seed: string | null;
  author_id: string;
  author_name?: string | null;
  author_avatar_url?: string | null;
  created_at: string;
  saved_at: string;
};

type ApiResp = {
  items: ColItem[];
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
} | null;

function ordinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatDate(d: string) {
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) throw new Error('invalid date');
    const day = date.getDate();
    const suffix = ordinalSuffix(day);
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day}${suffix} ${month} ${year}`;
  } catch {
    return d;
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function parseResolution(input?: string | null) {
  if (!input) return null;
  const match = input.trim().match(/^(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) return null;
  return { width, height };
}

function formatResolution(input?: string | null) {
  if (!input) return '—';
  if (input.includes('(')) return input;
  const parsed = parseResolution(input);
  if (!parsed) return input;
  const ratioBase = gcd(parsed.width, parsed.height);
  const ratio = `${parsed.width / ratioBase}:${parsed.height / ratioBase}`;
  return `${parsed.width} × ${parsed.height} (${ratio})`;
}

const PAGE_SIZE = 12;

export default function CollectionPage() {
  const [items, setItems] = useState<ColItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);


  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ColItem | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({}); 
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [me, setMe] = useState<CurrentUser>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const u = data?.user;
        if (!u) return;
        const name = u.user_metadata?.user_name || u.user_metadata?.name || u.email || u.id;
        const avatar_url = u.user_metadata?.avatar_url || null;
        if (!cancelled) {
          setMe({ id: u.id, name, email: u.email ?? null, avatar_url });
        }
      } catch {
        
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const url = new URL('/api/collection', window.location.origin);
      url.searchParams.set('page', '1');
      url.searchParams.set('limit', String(PAGE_SIZE));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data: ApiResp = await res.json();
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to load collection');
      setItems(data.items);
      if (selectedId) {
        const nextSelected = data.items.find((itm) => itm.id === selectedId) ?? null;
        setDetails(nextSelected);
        if (!nextSelected) setSelectedId(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (busy[id]) return;
    setBusy(s => ({ ...s, [id]: true }));
    try {
      const res = await fetch('/api/feed/save', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to remove');
      }
      setItems(list => list.filter(x => x.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDetails(null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setBusy(s => ({ ...s, [id]: false }));
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelectedId(null); }
    if (selectedId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
      return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    const next = items.find((item) => item.id === selectedId) ?? null;
    setDetails(next);
  }, [selectedId, items]);

  const parsedResolution = details?.resolution ? parseResolution(details.resolution) : null;

  async function handleDownload(image: ColItem | null) {
    if (!image || downloading) return;
    try {
      setDownloading(true);
      const response = await fetch(image.url, { headers: { Accept: 'image/*' } });
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        const urlObject = new URL(image.url, window.location.href);
        const cleanName = urlObject.pathname.split('/').filter(Boolean).pop() || '';
        const candidate = cleanName.split('?')[0].split('#')[0];
        const fallback = `image-${image.id}.png`;
        link.download = candidate && candidate.includes('.') ? candidate : fallback;
      } catch {
        link.download = `image-${image.id}.png`;
      }
      link.href = blobUrl;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while downloading image';
      alert(message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete(image: ColItem | null) {
    if (!image || deleting) return;
    const confirmed = window.confirm('Delete this image permanently?');
    if (!confirmed) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/image/${image.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to delete image');
      }

      setItems((prev) => prev.filter((item) => item.id !== image.id));
      setSelectedId(null);
      setDetails(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while deleting image';
      alert(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">My Collection</h1>
      </header>

      {err && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {err}
        </div>
      )}

      <section className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4" style={{ columnGap: '20px' }}>
        {items.map((it) => {
          const isBusy = !!busy[it.id];
          const displayName = me?.name || 'You';
          const avatar = me?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(me?.id || 'me')}`;

          return (
            <article key={it.id} className="space-y-2 break-inside-avoid inline-block w-full align-top mb-5">
              <button
                onClick={() => setSelectedId(it.id)}
                className="block w-full rounded-xl overflow-hidden border-[6px] border-[#121826] cursor-pointer"
                aria-label={`Open details for ${it.prompt}`}
              >
                <img src={it.url} alt={it.prompt} className="w-full h-auto object-cover" />
              </button>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={avatar}
                    alt={displayName || 'author avatar'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs opacity-80 truncate max-w-[140px]">{displayName}</span>
                </div>

                <button
                  onClick={() => remove(it.id)}
                  disabled={isBusy}
                  className={`w-7 h-7 rounded-md inline-flex items-center justify-center transition ${isBusy ? 'opacity-40 cursor-not-allowed' : 'bg-[#7C71FF]'}`}
                  aria-pressed={true}
                  title={isBusy ? 'Removing…' : 'Remove from collection'}
                >
                  <img src="/icons/bookmark.svg" alt="bookmark" className="w-4 h-4 filter brightness-0 invert" />
                </button>
              </div>
            </article>
          );
        })}

        {!loading && items.length === 0 && (
          <div className="inline-block w-full py-16 text-center text-sm opacity-70">No saved images yet.</div>
        )}
      </section>

      {selectedId && (
        <div
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 md:items-center"
          onClick={() => setSelectedId(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-[min(1040px,95vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#0f1422] shadow-[0_40px_120px_rgba(6,12,24,0.7)]">
              <div className="max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] cursor-pointer"
                  aria-label="Close details"
                >
                  <img src="/icons/Close-1.svg" alt="" className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="grid gap-8 p-6 sm:gap-10 sm:p-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <div className="flex h-full flex-col">
                  <div
                    className="relative mx-auto flex w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[#121a2b] md:mx-0 md:max-w-none"
                    style={{ aspectRatio: parsedResolution ? `${parsedResolution.width} / ${parsedResolution.height}` : '1' }}
                  >
                    {details ? (
                      <img src={details.url} alt={details.prompt} className="h-full w-full object-contain" />
                    ) : (
                      <div className="h-3/4 w-3/4 animate-pulse rounded-2xl bg-white/10" />
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={!details || downloading}
                      onClick={() => handleDownload(details)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-[#121a2b] px-4 text-sm font-semibold text-white/90 transition hover:border-white/20 hover:bg-[#152032] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
                    >
                      <img src="/icons/down-arrow.svg" alt="" className="h-4 w-4" aria-hidden="true" />
                      {downloading ? 'Downloading…' : 'Download'}
                    </button>
                    <button
                      type="button"
                      disabled={!details || deleting}
                      onClick={() => handleDelete(details)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-red-500/40 bg-[#1d1320] px-4 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-[#2a1a2f] hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
                    >
                      <img src="/icons/trash.svg" alt="" className="h-4 w-4" aria-hidden="true" />
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                  <div className="flex h-full flex-col">
                  <div className="space-y-6 text-sm text-white/60">
                    <div>
                      <div className="text-sm font-medium text-white/50">Prompt details</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{details?.prompt ?? '—'}</p>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/50">Negative prompt</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{details?.negative_prompt || 'Null'}</p>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/50">Created on</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{details ? formatDate(details.created_at) : '—'}</p>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/50">Saved on</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{details ? formatDate(details.saved_at) : '—'}</p>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/50">Input Resolution</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{formatResolution(details?.resolution)}</p>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/50">Seed</div>
                      <p className="mt-2 text-base leading-6 text-white/90">{details?.seed || '—'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!details}
                    onClick={() => {
                      if (!details) return;
                      const u = new URL('/generate', window.location.origin);
                      u.searchParams.set('prompt', details.prompt);
                      if (details.negative_prompt) u.searchParams.set('negative', details.negative_prompt);
                      if (details.resolution) u.searchParams.set('resolution', details.resolution);
                      if (details.color) u.searchParams.set('color', details.color);
                      if (details.guidance != null) u.searchParams.set('guidance', String(details.guidance));
                      if (details.seed) u.searchParams.set('seed', details.seed);
                      window.location.assign(u.toString());
                    }}
                    className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(93deg,#7C71FF_0%,#9F7CFF_100%)] text-base font-semibold text-white shadow-[0_22px_48px_rgba(124,113,255,0.35)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F7CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <img src="/icons/Magic.svg" alt="" className="h-5 w-5" aria-hidden="true" />
                    Generate with this settings
                  </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
