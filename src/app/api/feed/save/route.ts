import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const clientResult: any = await createClientServer();
  const supabase = clientResult?.supabase ?? clientResult; 
  const applyPendingCookies = clientResult?.applyPendingCookies ?? ((res: any) => res);
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user || ids.length === 0) {
    const res = NextResponse.json({ saved: [] });
    return applyPendingCookies(res);
  }

  const { data, error } = await supabase
    .from('saves')
    .select('image_id')
    .eq('user_id', userData.user.id)
    .in('image_id', ids);

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    return applyPendingCookies(res);
  }

  const saved = (data || []).map((r: any) => r.image_id);
  const res = NextResponse.json({ saved });
  return applyPendingCookies(res);
}


export async function POST(req: NextRequest) {
  const clientResult: any = await createClientServer();
  const supabase = clientResult?.supabase ?? clientResult; 
  const applyPendingCookies = clientResult?.applyPendingCookies ?? ((res: any) => res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return applyPendingCookies(res);
  }

  const body = await req.json().catch(() => ({}));
  const image_id = body?.image_id as string | undefined;
  if (!image_id) {
    const res = NextResponse.json({ error: 'Missing image_id' }, { status: 400 });
    return applyPendingCookies(res);
  }

  const ins = await supabase
    .from('saves')
    .insert({ user_id: userData.user.id, image_id })
    .select('image_id')
    .single();

  if (ins.error) {
    const msg = String(ins.error.message || '');
    if (ins.error.code === '23505' || /duplicate key|Unique/i.test(msg)) {
      const res = NextResponse.json({ image_id, saved: true }, { status: 200 });
      return applyPendingCookies(res);
    }
    const res = NextResponse.json({ error: ins.error.message }, { status: 500 });
    return applyPendingCookies(res);
  }

  const res = NextResponse.json({ image_id: ins.data.image_id, saved: true }, { status: 201 });
  return applyPendingCookies(res);
}


export async function DELETE(req: NextRequest) {
  const clientResult: any = await createClientServer();
  const supabase = clientResult?.supabase ?? clientResult; 
  const applyPendingCookies = clientResult?.applyPendingCookies ?? ((res: any) => res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return applyPendingCookies(res);
  }

  const body = await req.json().catch(() => ({}));
  const image_id = body?.image_id as string | undefined;
  if (!image_id) {
    const res = NextResponse.json({ error: 'Missing image_id' }, { status: 400 });
    return applyPendingCookies(res);
  }

  const del = await supabase
    .from('saves')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('image_id', image_id);

  if (del.error) {
    const res = NextResponse.json({ error: del.error.message }, { status: 500 });
    return applyPendingCookies(res);
  }

  const res = NextResponse.json({ image_id, saved: false }, { status: 200 });
  return applyPendingCookies(res);
}