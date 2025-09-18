'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientBrowser } from '@/lib/supabase-browser';

const RESOLUTIONS = [
  { value: '1024x1024', label: '1024 × 1024 (1:1)' },
  { value: '1152x896', label: '1152 × 896 (9:7)' },
  { value: '896x1152', label: '896 × 1152 (7:9)' },
  { value: '1344x768', label: '1344 × 768 (7:4)' },
  { value: '768x1344', label: '768 × 1344 (4:7)' },
];

const COLORS = ['#f04438', '#f97316', '#10b981', '#60a5fa', '#a855f7', '#e5e7eb'];


export default function GeneratePage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const sp = useSearchParams();

  
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [resolution, setResolution] = useState('1024x1024');
  const [guidance, setGuidance] = useState(5);

  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    fetch('/api/me', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user?.email) setUserEmail(d.user.email);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  
  useEffect(() => {
    const p = sp.get('prompt');
    const n = sp.get('negative');
    const r = sp.get('resolution');
    const c = sp.get('color');
    const g = sp.get('guidance');
    if (p) setPrompt(p);
    if (n) setNegativePrompt(n);
    if (r && RESOLUTIONS.some((option) => option.value === r)) setResolution(r);
    if (c) setColor(c);
    if (g && !Number.isNaN(+g)) setGuidance(Math.max(1, Math.min(10, +g)));
  }, [sp]);

  async function onGenerate() {
    if (!prompt || !userEmail) return;

    try {
      setError(null);
      setLoading(true);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negativePrompt, color, resolution, guidance })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? 'Unable to generate image');
      }
      if (!data?.image?.url) {
        throw new Error('No image URL returned by the API');
      }

      setImageUrl(data.image.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  
  const PANEL = 'bg-[#111b2d]';
  const RING = 'ring-1 ring-white/10';
  const FIELD = `${PANEL} ${RING} w-full rounded-2xl px-5 py-4 text-sm text-white placeholder-white/40 focus-visible:ring-2 focus-visible:ring-[#7C71FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]`;
  const sliderProgress = Math.max(0, Math.min(100, ((guidance - 1) / 9) * 100));

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 pb-16 pt-12 md:px-12">
      <div className="grid gap-10 md:grid-cols-[minmax(0,_520px)_minmax(0,_1fr)] lg:grid-cols-[minmax(0,_560px)_minmax(0,_1fr)] xl:gap-12">
        
        <section className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="prompt" className="text-sm font-medium text-white/70">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt"
              className={`${FIELD} min-h-[96px] resize-none mt-1 leading-relaxed`}
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="negativePrompt" className="text-sm font-medium text-white/70">
              Negative Prompt (Optional)
            </label>
            <input
              id="negativePrompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Enter the prompt"
              className={`${FIELD} mt-1`}
            />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-white/70">Colors</div>
            <div className="flex flex-wrap items-center gap-3">
              {COLORS.map((c) => {
                const active = color?.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`color ${c}`}
                    onClick={() => setColor(c)}
                    className={[
                      'h-10 w-10 rounded-full border transition-all',
                      active
                        ? 'border-[#7C71FF] shadow-[0_0_0_4px_rgba(124,113,255,0.25)]'
                        : 'border-white/15 hover:border-white/30',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => setColor(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/60 transition hover:border-white/30 hover:text-white"
                aria-label="clear color"
                title="Clear color"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-white/70">Resolution</div>
            <div className="flex flex-wrap gap-3">
              {RESOLUTIONS.map(({ value, label }) => {
                const active = value === resolution;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setResolution(value)}
                    className={[
                      'rounded-[14px] px-4 py-2.5 text-sm font-medium transition-all',
                      PANEL,
                      RING,
                      active
                        ? 'bg-[#7C71FF] text-white ring-transparent shadow-[0_18px_40px_rgba(124,113,255,0.35)]'
                        : 'text-white/70 hover:text-white hover:ring-white/10',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-white/70">
              <span>Guidance</span>
              <span>{guidance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={guidance}
              onChange={(e) => setGuidance(+e.target.value)}
              className="generate-slider h-3 w-full"
              style={{
                background: `linear-gradient(90deg, #7C71FF ${sliderProgress}%, rgba(255,255,255,0.08) ${sliderProgress}%)`,
              }}
            />
          </div>

          
          <div className="pt-2">
            <button
              disabled={loading || !prompt || !userEmail}
              onClick={onGenerate}
              className={[
                'relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-medium transition-colors',
                loading || !prompt || !userEmail
                  ? 'bg-[#7C71FF]/45 text-white/80 cursor-not-allowed'
                  : 'bg-[#7C71FF] text-white hover:bg-[#6b63ff]',
              ].join(' ')}
            >
              <img src="/icons/Magic.svg" alt="" width={18} height={18} className="opacity-90" />
              {loading ? 'Generating…' : 'Generate Image'}
            </button>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>
        </section>

        
        <section
          className={`${PANEL} ${RING} flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-[24px] p-10`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Generated result" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/60">
              <img
                src="/images/cube-placeholder.png"
                width={300}
                height={300}
                alt="Preview placeholder"
                className="pointer-events-none select-none"
              />
              {/* <p className="text-sm">Preview</p> */}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
