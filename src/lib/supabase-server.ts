import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClientServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookieEntries) {
          cookieEntries.forEach(({ name, value, options }) => {
            if (value === '') {
              if (options) {
                cookieStore.delete({ name, ...options });
              } else {
                cookieStore.delete(name);
              }
            } else {
              if (options) {
                cookieStore.set({ name, value, ...options });
              } else {
                cookieStore.set(name, value);
              }
            }
          });
        },
      },
    }
  );
};
