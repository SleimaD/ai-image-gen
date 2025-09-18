'use client';

import { useEffect, useState } from 'react';

type FeedItem = {
  id: string;
  url: string;
  prompt: string;
  created_at: string;
  author_id: string;
  author_name?: string | null;
  author_avatar_url?: string | null;
  saved?: boolean;
};

type ImageDetails = {
  id: string;
  url: string;
  prompt: string;
  negative_prompt: string | null;
  resolution: string;
  color: string | null;
  guidance: number | null;
  seed: string | null;
  author_id: string;
  created_at: string;
};

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

type FeedResponse = {
  items: FeedItem[];
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

function savedKeyFor(userId: string) {
  return `feed:saved:${userId}`;
}

function rehydrateSavedFromStorage(userId?: string | null) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(savedKeyFor(userId));
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return map;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 12;

function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function FeedPage() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [me, setMe] = useState<CurrentUser>(null);
  const [savedHydrated, setSavedHydrated] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ImageDetails | null>(null);

  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({}); 
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const parsedResolution = details?.resolution ? parseResolution(details.resolution) : null;

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
        const current: CurrentUser = { id: u.id, name, email: u.email ?? null, avatar_url };
        if (!cancelled) {
          setMe(current);
          const m = rehydrateSavedFromStorage(u.id);
          if (m) setSaved(m);
          setSavedHydrated(true);
        }
      } finally {
        
      }
    })();
    return () => { cancelled = true; };
  }, []);

  
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const url = new URL('/api/feed', window.location.origin);
        url.searchParams.set('q', dq);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(PAGE_SIZE));

        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: FeedResponse = await res.json();

        if (!res.ok) throw new Error((data as any)?.error || 'Failed to fetch feed');
        if (cancelled) return;

        setItems(data.items);
        setCount(data.count);
        setHasMore(data.hasMore);
        if (Array.isArray(data.items)) setSaved((prev) => ({ ...prev, ...Object.fromEntries(data.items.filter((x:any)=>x.saved).map((x:any)=>[x.id, true])) }));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dq, page]);

 
  useEffect(() => {
    let cancelled = false;
    async function checkSaved() {
      if (!me?.id) { return; }
      const ids = items.map(i => i.id);
      if (ids.length === 0) { return; }
      const url = new URL('/api/feed/save', window.location.origin);
      url.searchParams.set('ids', ids.join(','));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json(); 
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      for (const id of data.saved ?? []) map[id] = true;
      setSaved(map);
      if (me?.id) {
        try { sessionStorage.setItem(savedKeyFor(me.id), JSON.stringify(map)); } catch {}
      }
    }
    checkSaved();
    return () => { cancelled = true; };
  }, [items, me?.id]);

  
  useEffect(() => {
    function onFocus() {
      if (!me?.id) return;
      const m = rehydrateSavedFromStorage(me.id);
      if (m) setSaved(m);
    }
    function onVisibility() {
      if (document.visibilityState !== 'visible' || !me?.id) return;
      const m = rehydrateSavedFromStorage(me.id);
      if (m) setSaved(m);
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me?.id]);

  
  useEffect(() => {
    let cancelled = false;
    async function loadDetails(id: string) {
      try {
        setDetails(null);
        const res = await fetch(`/api/image/${id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load image');
        if (!cancelled) setDetails(data.image as ImageDetails);
      } catch {
        if (!cancelled) setDetails(null);
      }
    }
    if (selectedId) loadDetails(selectedId);
    return () => { cancelled = true; };
  }, [selectedId]);

  
  useEffect(() => {
    setPage(1);
  }, [dq]);

  
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedId(null);
    }
    if (selectedId) {
      window.addEventListener('keydown', onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [selectedId]);

  async function toggleSave(id: string) {
    if (saving[id]) return;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      if (saved[id]) {
        const res = await fetch('/api/feed/save', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: id }),
        });
        const ok = res.ok;
        setSaved(m => {
          const nm = { ...m, [id]: ok ? false : m[id] };
          if (me?.id) try { sessionStorage.setItem(savedKeyFor(me.id), JSON.stringify(nm)); } catch {}
          return nm;
        });
      } else {
        const res = await fetch('/api/feed/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: id }),
        });
        const ok = res.ok;
        setSaved(m => {
          const nm = { ...m, [id]: ok ? true : m[id] };
          if (me?.id) try { sessionStorage.setItem(savedKeyFor(me.id), JSON.stringify(nm)); } catch {}
          return nm;
        });
      }
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  }

  async function handleDownload(image: ImageDetails | null) {
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

  async function handleDelete(image: ImageDetails | null) {
    if (!image || deleting) return;
    const confirmDelete = window.confirm('Delete this image permanently?');
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/image/${image.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to delete image');
      }

      setItems((prev) => prev.filter((item) => item.id !== image.id));
      setSaved((prev) => {
        if (!(image.id in prev)) return prev;
        const { [image.id]: _remove, ...rest } = prev;
        return rest;
      });
      setCount((c) => Math.max(0, c - 1));
      setDetails(null);
      setSelectedId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while deleting image';
      alert(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-start">
        <div className="w-full sm:w-[420px] relative">
          <img src="/icons/Search.svg" alt="" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search images by keywords"
            className="w-full rounded-lg bg-[#121a2b] pl-9 pr-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/20 placeholder:opacity-60"
          />
        </div>
      </header>

      
      <section className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4" style={{ columnGap: '20px' }}>
        {items.map((it) => {
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
                    src={me?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(me?.id || 'me')}`}
                    alt={me?.name || 'me'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs opacity-80 truncate max-w-[140px]">{me?.name || 'You'}</span>
                </div>

                
                <button
                  onClick={() => toggleSave(it.id)}
                  disabled={!!saving[it.id]}
                  className={`w-7 h-7 rounded-md inline-flex items-center justify-center transition ${saved[it.id] ? 'bg-[#7C71FF]' : 'ring-1 ring-white/15 hover:bg-white/10'}`}
                  aria-pressed={!!saved[it.id]}
                  title={saved[it.id] ? 'Remove from collection' : 'Save to collection'}
                >
                  <img src="/icons/bookmark.svg" alt="bookmark" className="w-4 h-4 filter brightness-0 invert" />
                </button>
              </div>
            </article>
          );
        })}
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
                    className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(93deg,#7C71FF_0%,#9F7CFF_100%)] text-base font-semibold text-white shadow-[0_22px_48px_rgba(124,113,255,0.35)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F7CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
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
