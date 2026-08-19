'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOut() {
  const router = useRouter();

  async function onClick() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <a
      href="/login"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="ml-1 shrink-0 whitespace-nowrap rounded-md border border-line px-2 py-1.5 font-display text-[0.76rem] font-semibold uppercase tracking-[0.1em] text-muted transition hover:border-steel/60 hover:text-ink sm:px-2.5 sm:text-[0.78rem]"
    >
      Sign out
    </a>
  );
}
