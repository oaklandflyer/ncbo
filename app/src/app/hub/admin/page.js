import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview, canManageRoles, reviewScope } from '@/lib/review';
import MemberRow from './member-row';
import PendingRow from './pending-row';

export default async function Admin() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');
  if (!canReview(profile)) redirect('/hub');

  const scope = reviewScope(profile);
  const manages = canManageRoles(profile);

  // A club lead's queue is their own school. The `.eq` is what shapes the
  // page; the policy is what makes it true — a lead who removed the filter by
  // hand would still be refused by Postgres on the decision itself.
  let pendingQuery = supabase.from('profiles')
    .select('id, display_name, schools(name), created_at')
    .eq('status', 'pending')
    .order('created_at');
  if (scope.kind === 'school') pendingQuery = pendingQuery.eq('school_id', scope.schoolId);

  const [{ data: members }, { data: clubs }, { data: waiting }] = await Promise.all([
    manages
      ? supabase.from('profiles')
          .select('id, display_name, role, club_id, schools(name)')
          .eq('status', 'approved')
          .order('display_name')
      : Promise.resolve({ data: null }),
    manages
      ? supabase.from('clubs').select('id, name, schools(name)').order('name')
      : Promise.resolve({ data: null }),
    pendingQuery,
  ]);

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">{manages ? 'Admin' : 'Club lead'}</p>
        <h1>{manages ? <>Members &amp; roles.</> : <>Your school&rsquo;s queue.</>}</h1>
        <p>
          {manages
            ? 'Club leads review their own school. Advisors and admins answer questions on the Q&A board. Admins can do everything, including this page.'
            : 'People waiting to join at your school. Approving someone lets them into the board; declining tells them the answer. Roles and clubs are set by an NCBO admin.'}
        </p>
      </div>

      <div className="notice" style={{ marginBottom: '1.4rem' }}>
        Email addresses aren&rsquo;t shown here — they live in the auth system, not the member
        directory, so they can&rsquo;t leak through the app. Look one up in the Supabase dashboard
        if you need it.
      </div>

      {waiting?.length > 0 ? (
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
      ) : (
        <p className="lead" style={{ fontSize: '0.94rem', marginBottom: '2rem' }}>
          Nobody is waiting{scope.kind === 'school' ? ' at your school' : ''} right now.
        </p>
      )}

      {manages && (
        <>
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
        </>
      )}
    </main>
  );
}
