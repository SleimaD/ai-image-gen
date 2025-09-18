import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('images')
      .select('id,url,prompt,resolution,color,guidance,seed,created_at,author_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      query = query.textSearch('prompt', q, { type: 'websearch' });
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      url: row.url,
      prompt: row.prompt,
      created_at: row.created_at,
      author_id: row.author_id,
    }));

    const total = count ?? 0;
    const hasMore = from + items.length < total;

    return NextResponse.json({ items, page, limit, count: total, hasMore });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}