import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';


export async function GET(req: NextRequest) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  
  const { data, error, count } = await supabase
    .from('saves')
    .select(
      'image_id, created_at, image:images(id,url,prompt,negative_prompt,resolution,color,guidance,seed,author_id,created_at)',
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || [])
    .filter((row: any) => row.image)
    .map((row: any) => ({
      id: row.image.id as string,
      url: row.image.url as string,
      prompt: row.image.prompt as string,
      negative_prompt: row.image.negative_prompt as string | null,
      resolution: row.image.resolution as string,
      color: row.image.color as string | null,
      guidance: row.image.guidance as number | null,
      seed: row.image.seed as string | null,
      author_id: row.image.author_id as string,
      author_name: (row.image as any)?.author_name ?? null,
      author_avatar_url: (row.image as any)?.author_avatar_url ?? null,
      created_at: row.image.created_at as string,
      saved_at: row.created_at as string, 
    }));

  const total = count ?? items.length;
  const hasMore = from + items.length < (count ?? 0);

  return NextResponse.json({ items, page, limit, count: total, hasMore });
}
