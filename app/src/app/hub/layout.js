import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import SignOut from './sign-out';

export default async function HubLayout({ children }) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  // The middleware already redirects anonymous visitors; this covers the case
  // where a user exists but their profile row doesn't (a failed signup).
  if (!profile) redirect('/login');

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <Link className="brand" href="/hub">NCBO</Link>
          <span className={`rolechip ${profile.role}`}>{profile.role.replace('_', ' ')}</span>
          <nav className="appnav">
            <Link href="/hub">Home</Link>
            <Link href="/hub/topics">Topics</Link>
            <Link href="/hub/qa">Q&amp;A</Link>
            {profile.role === 'admin' && <Link href="/hub/admin">Admin</Link>}
            <SignOut />
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
