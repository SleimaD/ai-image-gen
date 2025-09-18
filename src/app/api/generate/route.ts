import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt, negativePrompt, color, resolution, guidance, seed: inSeed } = await req.json();
  if (!prompt || !resolution) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [w, h] = resolution.split('x').map((n: string) => parseInt(n, 10));
  const seed = inSeed ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  // MOCK gratuit via picsum (free)
  const resp = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`);
  const buffer = Buffer.from(new Uint8Array(await resp.arrayBuffer()));

  // Upload dans Storage/bucket 'images'
  const path = `${user.id}/${seed}.jpg`;
  const up = await supabaseAdmin.storage.from('images').upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  const pub = supabaseAdmin.storage.from('images').getPublicUrl(up.data.path);

  // Insert en DB
  const ins = await supabaseAdmin.from('images').insert({
    url: pub.data.publicUrl,
    prompt,
    negative_prompt: negativePrompt ?? null,
    resolution,
    color,
    guidance,
    seed,
    author_id: user.id
  }).select().single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({ image: ins.data });
}
