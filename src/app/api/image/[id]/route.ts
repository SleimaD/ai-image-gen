import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClientServer } from '@/lib/supabase-server';

function extractStoragePath(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const bucketIndex = parts.findIndex((part) => part === 'images');
    if (bucketIndex === -1) return null;
    return decodeURIComponent(parts.slice(bucketIndex + 1).join('/')) || null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { data, error } = await supabaseAdmin
      .from('images')
      .select('id,url,prompt,negative_prompt,resolution,color,guidance,seed,author_id,created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ image: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClientServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const { data: image, error } = await supabaseAdmin
      .from('images')
      .select('id, url, author_id')
      .eq('id', id)
      .single();

    if (error || !image) {
      return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }

    if (image.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storagePath = image.url ? extractStoragePath(image.url) : null;

    const { error: savesError } = await supabaseAdmin.from('saves').delete().eq('image_id', id);
    if (savesError) {
      return NextResponse.json({ error: savesError.message }, { status: 500 });
    }

    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage.from('images').remove([storagePath]);
      if (storageError) {
        return NextResponse.json({ error: storageError.message }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabaseAdmin.from('images').delete().eq('id', id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
