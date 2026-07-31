import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import MemberRow from './member-row';
import PendingRow from './pending-row';

export default async function Admin() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (profile.role !== 'admin') redirect('/hub');

  const [{ data: members }, { data: clubs }, { data: waiting }] = await Promise.all([
    supabase.from('profiles')
      .select('id, display_name, role, club_id, schools(name)')
      .eq('status', 'approved')
      .order('display_name'),
    supabase.from('clubs').select('id, name, schools(name)').order('name'),
    supabase.from('profiles')
      .select('id, display_name, schools(name), created_at')
      .eq('status', 'pending')
      .order('created_at'),
  ]);

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">Admin</p>
        <h1>Members &amp; roles.</h1>
        <p>
          Club leads manage their own club. Advisors and admins answer questions on the
          Q&amp;A board. Admins can do everything, including this page.
        </p>
      </div>

      <div className="notice" style={{ marginBottom: '1.4rem' }}>
        Email addresses aren&rsquo;t shown here — they live in the auth system, not the member
        directory, so they can&rsquo;t leak through the app. Look one up in the Supabase dashboard
        if you need it.
      </div>

      {waiting?.length > 0 && (
        <>
          <h2 style={{ marginBottom: '0.9rem' }}>Waiting for approval</h2>
          <p className="lead" style={{ fontSize: '0.94rem', marginBottom: '1rem' }}>
            School emails at clubs we already run are approved automatically — these are the
            ones that need a person: advisors, exec, and students at schools not yet in NCBO.
          </p>
          <div className="tablewrap" style={{ marginBottom: '2.4rem' }}>
            <table>
              <thead><tr><th>Name</th><th>School</th><th>Decision</th></tr></thead>
              <tbody>
                {waiting.map((m) => <PendingRow key={m.id} member={m} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: '0.9rem' }}>Approved members</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Member</th><th>School</th><th>Role &amp; club</th></tr>
          </thead>
          <tbody>
            {(members || []).map((m) => (
              <MemberRow key={m.id} member={m} clubs={clubs || []} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
