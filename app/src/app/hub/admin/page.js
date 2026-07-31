import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import MemberRow from './member-row';

export default async function Admin() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (profile.role !== 'admin') redirect('/hub');

  const [{ data: members }, { data: clubs }] = await Promise.all([
    supabase.from('profiles')
      .select('id, display_name, role, club_id, schools(name)')
      .order('display_name'),
    supabase.from('clubs').select('id, name, schools(name)').order('name'),
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
