import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const USE_MOCK = process.env.MOCK_GENERATION === 'true';
const PROVIDER = process.env.GENERATOR_PROVIDER ?? 'hf'; 
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const HF_TOKEN = process.env.HF_TOKEN;

async function genWithHF(opts: {
  prompt: string;
  negativePrompt?: string | null;
  width: number;
  height: number;
  guidance?: number;
  seed?: number;
}) {
  if (!HF_TOKEN) throw new Error('HF_TOKEN missing');

 
  const body = {
    inputs: opts.prompt,
    parameters: {
      negative_prompt: opts.negativePrompt ?? undefined,
      width: opts.width,
      height: opts.height,
      guidance_scale: opts.guidance ?? 5,
      num_inference_steps: 25,
      
      seed: opts.seed,
    },
  };

  const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'image/png', 
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HF request failed ${res.status}: ${text}`);
  }

  const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
  return { buffer: buf, contentType: res.headers.get('content-type') || 'image/png' };
}

async function genWithPollinations(opts: {
  prompt: string;
  negativePrompt?: string | null;
  color?: string | null;
  width: number;
  height: number;
  seed: string;
}) {
  const parts = [
    'ultra realistic, highly detailed, 4k',
    opts.prompt.trim(),
  ];
  if (opts.color) parts.push(`dominant color: ${opts.color}`);
  const full = parts.join(', ');

  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(full)}`);
  url.searchParams.set('width', String(opts.width));
  url.searchParams.set('height', String(opts.height));
  url.searchParams.set('seed', opts.seed);
  url.searchParams.set('model', 'flux-schnell');
  if (opts.negativePrompt) url.searchParams.set('negative_prompt', opts.negativePrompt);

  const resp = await fetch(url.toString(), { headers: { Accept: 'image/jpeg' }, cache: 'no-store' });
  if (!resp.ok) throw new Error(`Pollinations ${resp.status}`);
  const buf = Buffer.from(new Uint8Array(await resp.arrayBuffer()));
  return { buffer: buf, contentType: 'image/jpeg' };
}

async function genWithMock(w: number, h: number, seed: string) {
  const r = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`);
  const buf = Buffer.from(new Uint8Array(await r.arrayBuffer()));
  return { buffer: buf, contentType: 'image/jpeg' };
}

export async function POST(req: NextRequest) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt, negativePrompt, color, resolution, guidance, seed: inSeed } = await req.json();
  if (!prompt || !resolution) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const [w, h] = resolution.split('x').map((n: string) => parseInt(n, 10));
  const seedStr = inSeed ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const seedNum = Math.abs([...seedStr].reduce((a, c) => a + c.charCodeAt(0), 0)) % 2_147_483_647;

  let out: { buffer: Buffer; contentType: string };

  try {
    if (USE_MOCK) {
      out = await genWithMock(w, h, seedStr);
    } else if (PROVIDER === 'hf') {
      out = await genWithHF({
        prompt,
        negativePrompt,
        width: w,
        height: h,
        guidance,
        seed: seedNum,
      });
    } else {
      out = await genWithPollinations({
        prompt,
        negativePrompt,
        color,
        width: w,
        height: h,
        seed: seedStr,
      });
    }
  } catch (e) {
    console.error('Primary provider failed, fallback → Pollinations. Reason:', e);
    try {
      out = await genWithPollinations({
        prompt,
        negativePrompt,
        color,
        width: w,
        height: h,
        seed: seedStr,
      });
    } catch {
      
      out = await genWithMock(w, h, seedStr);
    }
  }

  
  const path = `${user.id}/${seedStr}.${out.contentType.includes('png') ? 'png' : 'jpg'}`;
  const up = await supabaseAdmin.storage.from('images').upload(path, out.buffer, {
    contentType: out.contentType,
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const pub = supabaseAdmin.storage.from('images').getPublicUrl(up.data.path);

  
  const ins = await supabaseAdmin.from('images').insert({
    url: pub.data.publicUrl,
    prompt,
    negative_prompt: negativePrompt ?? null,
    resolution,
    color,
    guidance,
    seed: seedStr,
    author_id: user.id,
  }).select().single();

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ image: ins.data });
}