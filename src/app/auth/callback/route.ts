import { NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/generate';

  if (code) {
    const supabase = await createClientServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectPath = next.startsWith('/') ? next : '/generate';
  return NextResponse.redirect(new URL(redirectPath, url.origin));
}
