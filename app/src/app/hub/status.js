/**
 * The screen an account sees when it isn't approved.
 *
 * Three different situations that used to share one screen, because the
 * layout treated "not approved" as a single state:
 *
 *   pending    — nobody has looked at it yet
 *   rejected   — someone looked and said no
 *   suspended  — they were in, and that stopped
 *
 * Telling a declined applicant they are "waiting on approval" is a small lie
 * that wastes their time, and telling a suspended member the same thing tells
 * them nothing at all. Each gets its own words and its own way forward.
 */
const EMAIL = 'thencbo@gmail.com';

const SCREENS = {
  pending: {
    eyebrow: 'Almost in',
    title: ['Waiting on', 'approval.'],
    lead: (name) => `Your account is created${name ? `, ${name}` : ''} — an NCBO admin needs to approve it before the board opens up.`,
    note: `Accounts with a school email at a club we already run are approved automatically.
           Yours needs a look because it's either a personal address — advisors and exec team —
           or a school we haven't added yet. Either way, someone will get to it.`,
    fineprint: 'Think this is a mistake?',
  },
  rejected: {
    eyebrow: 'Decision made',
    title: ['Application', 'declined.'],
    lead: (name) => `${name ? `${name}, we` : 'We'}'ve reviewed this application and it hasn't been approved for NCBO membership.`,
    note: `Most declines come down to something we couldn't confirm — an address we couldn't tie
           to a member school, or a club that isn't running yet. If your situation has changed,
           or you think we've got this wrong, say so and a person will look again.`,
    fineprint: 'Want another look?',
  },
  suspended: {
    eyebrow: 'Account suspended',
    title: ['This account', 'is on hold.'],
    lead: (name) => `Access has been suspended${name ? ` for ${name}` : ''}, so the board and the club pages are closed for now.`,
    note: `A suspension is something an admin did deliberately, and it can be lifted the same way.
           If you don't know why this happened, ask — we would rather explain it than leave you
           guessing.`,
    fineprint: 'Think this is a mistake?',
  },
};

export default function AccountStatus({ status, profile }) {
  const screen = SCREENS[status] || SCREENS.pending;
  const name = profile?.display_name || profile?.full_name || '';

  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>{screen.eyebrow}</p>
        <h1>{screen.title[0]}<br />{screen.title[1]}</h1>
        <p className="lead" style={{ marginTop: '1rem', fontSize: '0.98rem' }}>
          {screen.lead(name)}
        </p>
        <div className="notice" style={{ marginTop: '1.4rem', textAlign: 'left' }}>
          {screen.note}
        </div>
        <p className="fineprint">
          {screen.fineprint} Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </div>
    </main>
  );
}
