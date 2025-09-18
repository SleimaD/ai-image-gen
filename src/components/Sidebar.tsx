'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase-browser';

type UserLite = {
  email: string | null;
  avatar_url?: string | null;
};

const NAV = [
  { href: '/generate', label: 'Generate', icon: '/icons/Magic.svg' },
  { href: '/feed', label: 'Feed', icon: '/icons/apps.svg' },
  { href: '/history', label: 'History', icon: '/icons/Time_atack_duotone.svg' },
  { href: '/collection', label: 'Collection', icon: '/icons/Folder_duotone_fill.svg' },
] as const;

const MOBILE_LABEL: Record<typeof NAV[number]['href'], string> = {
  '/generate': 'Generate Image',
  '/feed': 'Feed',
  '/history': 'Generation History',
  '/collection': 'My Collection',
};

function Icon({ name, className }: { name: typeof NAV[number]['icon'] | 'logo' | 'github'; className?: string }) {
  
  if (name === 'logo') {
    return <img src="/brand/Logo.svg" alt="Logo" className={className} />;
  }

  if (name === 'github') {
    return <img src="/icons/signin.svg" alt="GitHub" className={className} />;
  }

  return <img src={name as string} alt="" className={className} />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClientBrowser(), []);
  const [user, setUser] = useState<UserLite | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        const email = data.user?.email ?? null;
        const avatar_url = (data.user?.user_metadata as any)?.avatar_url ?? null;
        setUser(email ? { email, avatar_url } : null);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      const email = session?.user?.email ?? null;
      const avatar_url = (session?.user?.user_metadata as any)?.avatar_url ?? null;
      setUser(email ? { email, avatar_url } : null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  async function signIn() {
    const redirect = new URL('/auth/callback', window.location.origin);
    const nextPath = (pathname || '/generate') + (typeof window !== 'undefined' ? window.location.search : '');
    redirect.searchParams.set('next', nextPath);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: redirect.toString(), skipBrowserRedirect: true },
    });
    if (error) {
      console.error(error.message);
      return;
    }
    if (data?.url) window.location.assign(data.url);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAccountOpen(false);
    setMobileOpen(false);
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/generate' && pathname?.startsWith(href));

  const desktopNav = (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[72px] bg-[#0f1422] border-r border-white/5 flex-col items-center">
      <Link href="/generate" className="mt-5 mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10">
        <Icon name="logo" className="h-5 w-5" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-3">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            className={[
              'relative h-10 w-10 rounded-xl inline-flex items-center justify-center transition-colors',
              isActive(n.href) ? 'bg-[#7C71FF] text-white' : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10',
            ].join(' ')}
            aria-current={isActive(n.href) ? 'page' : undefined}
          >
            <Icon name={n.icon} className="h-5 w-5" />
          </Link>
        ))}
      </nav>

      <div className="mb-4 relative">
        {user ? (
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="h-10 w-10 rounded-full overflow-hidden border border-white/10 hover:border-white/30"
            aria-label="Account menu"
          >
            <img
              alt={user.email ?? 'avatar'}
              src={
                user.avatar_url ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email ?? 'user')}`
              }
              className="h-full w-full object-cover"
            />

          </button>

        ) : (
          <button
            onClick={signIn}
            className="h-10 w-10 rounded-xl inline-flex items-center justify-center bg-white/5 hover:bg-white/10"
            title="Sign in with GitHub"
            aria-label="Sign in"
          >
            <Icon name="github" className="h-5 w-5" />
          </button>
        )}

        {accountOpen && user && (
          <div
            className="absolute bottom-12 left-0 translate-x-12 min-w-[160px] rounded-lg border border-white/10 bg-[#0f1422] shadow-xl p-2"
            onMouseLeave={() => setAccountOpen(false)}
          >
            <div className="px-3 py-2 text-xs opacity-70 truncate max-w-[220px]">{user.email}</div>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  const mobileHeader = (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-white/5 bg-[#0f1422]/95 px-4 py-3 backdrop-blur">
      <Link href="/generate" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
        <Icon name="logo" className="h-5 w-5" />
      </Link>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#7C71FF] text-white shadow-[0_18px_30px_rgba(124,113,255,0.35)]"
        aria-label="Open navigation"
      >
        <img src="/icons/bars.svg" alt="" className="h-5 w-5" />
      </button>
    </header>
  );

  const mobileDrawer = !mobileOpen ? null : (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
      />
      <div className="relative ml-auto flex h-full w-[min(320px,85vw)] flex-col border-l border-white/10 bg-[#0f1422] px-6 pb-6 pt-8 shadow-[0_40px_120px_rgba(6,12,24,0.7)]">
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="self-end inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/15"
          aria-label="Close navigation"
        >
          <img src="/icons/Close.svg" alt="" className="h-4 w-4" />
        </button>

        <nav className="mt-12 flex flex-col gap-4">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={[
                  'inline-flex items-center gap-3 rounded-[16px] px-4 py-3 text-base font-medium transition',
                  active
                    ? 'bg-[linear-gradient(93deg,#7C71FF_0%,#9F7CFF_100%)] text-white shadow-[0_18px_40px_rgba(124,113,255,0.35)]'
                    : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
                ].join(' ')}
                onClick={() => setMobileOpen(false)}
              >
                <Icon name={n.icon} className="h-5 w-5" />
                <span>{MOBILE_LABEL[n.href]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[16px] bg-white/5 px-4 py-3">

                <img
                  src={
                    user.avatar_url ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email ?? 'user')}`
                  }
                  alt={user.email ?? 'avatar'}
                  className="h-10 w-10 rounded-full object-cover"
                />

                <div className="text-sm leading-tight text-white/80">
                  <div className="font-medium text-white">Signed in</div>
                  <div className="truncate opacity-70">{user.email}</div>
                </div>

              </div>
              
              <button
                onClick={signOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <Icon name="github" className="h-5 w-5" />
              <span>Sign in with GitHub</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {desktopNav}
      {mobileHeader}
      {mobileDrawer}
    </>
  );
}
