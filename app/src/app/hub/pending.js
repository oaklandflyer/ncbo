/**
 * Shown to an account that exists but hasn't been approved.
 *
 * This is a courtesy, not the gate: row-level security already returns
 * nothing to an unapproved account, so a pending user who skipped this
 * screen would simply find every page empty.
 */
export default function Pending({ profile }) {
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Almost in</p>
        <h1>Waiting on<br />approval.</h1>
        <p className="lead" style={{ marginTop: '1rem', fontSize: '0.98rem' }}>
          Your account is created, {profile.display_name || 'and ready'} — an NCBO admin needs to approve it
          before the board opens up.
        </p>
        <div className="notice" style={{ marginTop: '1.4rem', textAlign: 'left' }}>
          Accounts with a school email at a club we already run are approved automatically.
          Yours needs a look because it&rsquo;s either a personal address — advisors and exec
          team — or a school we haven&rsquo;t added yet. Either way, someone will get to it.
        </div>
        <p className="fineprint">
          Think this is a mistake? Email <a href="mailto:thencbo@gmail.com">thencbo@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
