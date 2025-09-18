import { NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClientServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (error.name === 'AuthSessionMissingError') {
        return NextResponse.json({ user: null }, { status: 200 });
      }

      return NextResponse.json(
        { error: error.message ?? 'Unable to retrieve user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: user ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
