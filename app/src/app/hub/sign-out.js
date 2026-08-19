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
      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] bg-brand px-[1.3rem] py-[0.6rem] font-display text-[0.86rem] font-bold uppercase tracking-[0.12em] text-white transition duration-200 hover:-translate-y-px hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light"
    >
      Sign out
    </a>
  );
}
