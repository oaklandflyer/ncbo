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
    <a href="/login" onClick={(e) => { e.preventDefault(); onClick(); }}>Sign out</a>
  );
}
