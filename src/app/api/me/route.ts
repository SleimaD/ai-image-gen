import { NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClientServer();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data.user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
