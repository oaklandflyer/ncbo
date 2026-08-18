/* ============================================================================
   NCBO — test/core.test.js
   The member gate's rules, checked without a browser.

     node test/core.test.js

   assets/ncbo-auth-core.js is deliberately free of DOM, network and Supabase,
   so the decisions that matter — who is approved on the spot, who waits for an
   admin, which panel a given state shows — can be run here in a second.

   The status rules mirror `public.handle_new_user()` in
   app/supabase/migrations/. Postgres is the authority; if a migration changes,
   change the core and these tests with it.
   ========================================================================== */
'use strict';

const assert = require('assert');
const Core = require('../assets/ncbo-auth-core.js');

let checks = 0;
let failures = 0;
let group = '';

function section(name) { group = name; console.log('\n  ' + name); }

function check(what, fn) {
  checks++;
  try {
    fn();
    console.log('    ok   ' + what);
  } catch (err) {
    failures++;
    console.log('    FAIL ' + what);
    console.log('         ' + String(err.message).split('\n').join('\n         '));
  }
}

/* Two chapter schools plus a subdomain that is a school in its own right —
   enough to tell "exact match" apart from "longest parent match". */
const SCHOOLS = [
  { domain: 'pitt.edu', slug: 'pitt' },
  { domain: 'psu.edu', slug: 'penn-state' },
  { domain: 'medschool.pitt.edu', slug: 'pitt-med' }
];

const ALLOWED = [{ email: 'Coach@Example.com', note: 'Advisory board' }];

/* ── addresses ────────────────────────────────────────────────────────── */
section('email addresses');

check('normalizeEmail trims and lowercases', () =>
  assert.strictEqual(Core.normalizeEmail('  Alex@Pitt.EDU '), 'alex@pitt.edu'));

check('normalizeEmail turns null into an empty string', () =>
  assert.strictEqual(Core.normalizeEmail(null), ''));

check('isEmail accepts an ordinary address', () =>
  assert.strictEqual(Core.isEmail('alex@pitt.edu'), true));

check('isEmail rejects a string with no @', () =>
  assert.strictEqual(Core.isEmail('alex-at-pitt.edu'), false));

check('isEmail rejects a bare hostname with no dot', () =>
  assert.strictEqual(Core.isEmail('alex@localhost'), false));

check('isEmail rejects an address with a space in it', () =>
  assert.strictEqual(Core.isEmail('alex smith@pitt.edu'), false));

check('domainOf returns the normalized domain', () =>
  assert.strictEqual(Core.domainOf('A@CS.Pitt.EDU'), 'cs.pitt.edu'));

check('domainOf returns nothing for a non-address', () =>
  assert.strictEqual(Core.domainOf('garbage'), ''));

/* ── .edu ─────────────────────────────────────────────────────────────── */
section('.edu detection');

check('isEduDomain accepts pitt.edu', () =>
  assert.strictEqual(Core.isEduDomain('pitt.edu'), true));

check('isEduDomain accepts a subdomain of a .edu', () =>
  assert.strictEqual(Core.isEduDomain('cs.pitt.edu'), true));

check('isEduDomain rejects a lookalike that only contains .edu', () =>
  assert.strictEqual(Core.isEduDomain('pitt.edu.evil.com'), false));

check('isEduDomain rejects a plain commercial domain', () =>
  assert.strictEqual(Core.isEduDomain('example.com'), false));

check('isEduEmail accepts a school address', () =>
  assert.strictEqual(Core.isEduEmail('alex@pitt.edu'), true));

check('isEduEmail rejects a personal address', () =>
  assert.strictEqual(Core.isEduEmail('alex@example.com'), false));

/* ── schools ──────────────────────────────────────────────────────────── */
section('school lookup');

check('an exact domain match resolves to that school', () =>
  assert.strictEqual(Core.schoolForDomain('pitt.edu', SCHOOLS).slug, 'pitt'));

check('a subdomain resolves to its parent school', () =>
  assert.strictEqual(Core.schoolForDomain('cs.pitt.edu', SCHOOLS).slug, 'pitt'));

check('an exact match beats a parent match', () =>
  assert.strictEqual(Core.schoolForDomain('medschool.pitt.edu', SCHOOLS).slug, 'pitt-med'));

check('the longest parent match wins', () =>
  assert.strictEqual(Core.schoolForDomain('lab.medschool.pitt.edu', SCHOOLS).slug, 'pitt-med'));

check('a suffix that is not on a dot boundary is not a match', () =>
  assert.strictEqual(Core.schoolForDomain('notpitt.edu', SCHOOLS), null));

check('an unknown school resolves to nothing', () =>
  assert.strictEqual(Core.schoolForDomain('iowa.edu', SCHOOLS), null));

check('schoolForEmail goes through the address', () =>
  assert.strictEqual(Core.schoolForEmail('alex@cs.pitt.edu', SCHOOLS).slug, 'pitt'));

/* ── staff allowlist ──────────────────────────────────────────────────── */
section('staff allowlist');

check('an allowlisted address matches regardless of case', () =>
  assert.strictEqual(Core.isAllowedEmail(' coach@example.com ', ALLOWED), true));

check('a plain list of strings works too', () =>
  assert.strictEqual(Core.isAllowedEmail('coach@example.com', ['coach@example.com']), true));

check('an address that is not on the list does not match', () =>
  assert.strictEqual(Core.isAllowedEmail('stranger@example.com', ALLOWED), false));

/* ── who is approved on the spot ──────────────────────────────────────── */
section('signup decision');

check('a .edu at a chapter school is approved immediately', () => {
  const out = Core.decideStatus('alex@pitt.edu', { schools: SCHOOLS, allowed: ALLOWED });
  assert.strictEqual(out.status, 'approved');
  assert.strictEqual(out.reason, 'known-school');
});

check('the resolved school comes back with the decision', () =>
  assert.strictEqual(
    Core.decideStatus('alex@cs.pitt.edu', { schools: SCHOOLS }).school.slug, 'pitt'));

check('a .edu at a school we do not know waits for an admin', () => {
  const out = Core.decideStatus('alex@iowa.edu', { schools: SCHOOLS, allowed: ALLOWED });
  assert.strictEqual(out.status, 'pending');
  assert.strictEqual(out.reason, 'unknown-school');
});

check('a non-school address waits for an admin', () => {
  const out = Core.decideStatus('alex@gmail.com', { schools: SCHOOLS, allowed: ALLOWED });
  assert.strictEqual(out.status, 'pending');
  assert.strictEqual(out.reason, 'not-edu');
});

check('an allowlisted staff address is approved immediately', () => {
  const out = Core.decideStatus('coach@example.com', { schools: SCHOOLS, allowed: ALLOWED });
  assert.strictEqual(out.status, 'approved');
  assert.strictEqual(out.reason, 'allowlisted');
});

check('the allowlist wins over an unrecognised school', () =>
  assert.strictEqual(
    Core.decideStatus('dean@iowa.edu',
      { schools: SCHOOLS, allowed: ['dean@iowa.edu'] }).reason, 'allowlisted'));

check('a malformed address is invalid, not pending', () =>
  assert.strictEqual(Core.decideStatus('not-an-address', { schools: SCHOOLS }).status, 'invalid'));

check('the decision carries the normalized address', () =>
  assert.strictEqual(Core.decideStatus(' Alex@Pitt.edu ', { schools: SCHOOLS }).email, 'alex@pitt.edu'));

/* ── roles ────────────────────────────────────────────────────────────── */
section('roles and status');

check('the role order matches the user_role enum', () =>
  assert.deepStrictEqual(Core.ROLES, ['member', 'club_lead', 'advisor', 'admin']));

check('normalizeRole tidies whitespace and case', () =>
  assert.strictEqual(Core.normalizeRole(' ADMIN '), 'admin'));

check('an unknown role falls back to member', () =>
  assert.strictEqual(Core.normalizeRole('wizard'), 'member'));

check('normalizeStatus tidies case', () =>
  assert.strictEqual(Core.normalizeStatus('APPROVED'), 'approved'));

check('an unknown status falls back to pending, not approved', () =>
  assert.strictEqual(Core.normalizeStatus('whatever'), 'pending'));

check('roleAtLeast lets an admin through an advisor gate', () =>
  assert.strictEqual(Core.roleAtLeast('admin', 'advisor'), true));

check('roleAtLeast holds a member at an advisor gate', () =>
  assert.strictEqual(Core.roleAtLeast('member', 'advisor'), false));

check('roleAtLeast is inclusive of the gate itself', () =>
  assert.strictEqual(Core.roleAtLeast('advisor', 'advisor'), true));

/* ── what a signed-in account may do ──────────────────────────────────── */
section('capabilities');

check('isAdmin recognises an admin', () =>
  assert.strictEqual(Core.isAdmin({ role: 'admin' }), true));

check('isAdmin says no to a missing profile', () =>
  assert.strictEqual(Core.isAdmin(null), false));

check('an advisor is a moderator', () =>
  assert.strictEqual(Core.isModerator({ role: 'advisor' }), true));

check('a club lead is not a moderator', () =>
  assert.strictEqual(Core.isModerator({ role: 'club_lead' }), false));

check('an approved member may read the hub', () =>
  assert.strictEqual(Core.canReadHub({ status: 'approved' }), true));

check('a pending member may not read the hub', () =>
  assert.strictEqual(Core.canReadHub({ status: 'pending' }), false));

check('a missing profile may not read the hub', () =>
  assert.strictEqual(Core.canReadHub(null), false));

check('an approved admin may review members', () =>
  assert.strictEqual(Core.canReviewMembers({ role: 'admin', status: 'approved' }), true));

check('an admin who is not approved may not review members', () =>
  assert.strictEqual(Core.canReviewMembers({ role: 'admin', status: 'pending' }), false));

check('an approved advisor may not review members', () =>
  assert.strictEqual(Core.canReviewMembers({ role: 'advisor', status: 'approved' }), false));

/* ── configuration ────────────────────────────────────────────────────── */
section('supabase configuration');

const REAL = { url: 'https://abcdefghijklm.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.body.sig' };

check('the shipped placeholders are not a configuration', () =>
  assert.strictEqual(Core.isConfigured({
    url: Core.PLACEHOLDERS.url, anonKey: Core.PLACEHOLDERS.anonKey }), false));

check('the placeholder url is named in the problems', () =>
  assert.ok(Core.configProblems({ url: Core.PLACEHOLDERS.url, anonKey: REAL.anonKey })
    .join(' ').indexOf('url') !== -1));

check('a placeholder key alone is still not configured', () =>
  assert.strictEqual(Core.isConfigured({ url: REAL.url, anonKey: Core.PLACEHOLDERS.anonKey }), false));

check('an empty config is not configured', () =>
  assert.strictEqual(Core.isConfigured({}), false));

check('real-looking values are configured', () =>
  assert.strictEqual(Core.isConfigured(REAL), true));

check('a good config reports no problems', () =>
  assert.deepStrictEqual(Core.configProblems(REAL), []));

/* ── which panel is on screen ─────────────────────────────────────────── */
section('panel selection');

const base = { configured: true, ready: true, session: null, profile: null, linkSent: false, error: '' };
const state = extra => Object.assign({}, base, extra);

check('every panel viewFor can return exists in VIEWS', () =>
  assert.deepStrictEqual(Core.VIEWS.slice().sort(),
    ['approved', 'error', 'link-sent', 'loading', 'pending', 'signed-out', 'suspended', 'unconfigured']));

check('an unconfigured project shows the unconfigured panel first', () =>
  assert.strictEqual(Core.viewFor(state({ configured: false, session: {}, profile: { status: 'approved' } })),
    'unconfigured'));

check('an error outranks a signed-in session', () =>
  assert.strictEqual(Core.viewFor(state({ error: 'boom', session: {}, profile: { status: 'approved' } })), 'error'));

check('before the first answer comes back, it is loading', () =>
  assert.strictEqual(Core.viewFor(state({ ready: false })), 'loading'));

check('no session shows the sign-in panel', () =>
  assert.strictEqual(Core.viewFor(state({})), 'signed-out'));

check('a sent link shows the check-your-inbox panel', () =>
  assert.strictEqual(Core.viewFor(state({ linkSent: true })), 'link-sent'));

check('a session with no profile row yet keeps loading', () =>
  assert.strictEqual(Core.viewFor(state({ session: {} })), 'loading'));

check('an approved profile opens the hub', () =>
  assert.strictEqual(Core.viewFor(state({ session: {}, profile: { status: 'approved' } })), 'approved'));

check('a pending profile gets the waiting panel', () =>
  assert.strictEqual(Core.viewFor(state({ session: {}, profile: { status: 'pending' } })), 'pending'));

check('a suspended profile gets the suspended panel', () =>
  assert.strictEqual(Core.viewFor(state({ session: {}, profile: { status: 'suspended' } })), 'suspended'));

check('an unrecognised status never opens the hub', () =>
  assert.strictEqual(Core.viewFor(state({ session: {}, profile: { status: 'nonsense' } })), 'pending'));

/* ── presentation ─────────────────────────────────────────────────────── */
section('names, errors and the queue');

check('a display name is used when there is one', () =>
  assert.strictEqual(Core.displayNameFor({ display_name: 'Alex Swanson' }, 'a@pitt.edu'), 'Alex Swanson'));

check('without one, the local part of the address stands in', () =>
  assert.strictEqual(Core.displayNameFor(null, 'Alex.Swanson@pitt.edu'), 'alex.swanson'));

check('firstNameOf takes the first word', () =>
  assert.strictEqual(Core.firstNameOf({ display_name: 'Alex Swanson' }, ''), 'Alex'));

check('a rate-limit error is put in plain words', () =>
  assert.ok(/wait a minute/i.test(Core.authErrorMessage({ message: 'Email rate limit exceeded' }))));

check('an expired link is explained, with a way forward', () =>
  assert.ok(/expired/i.test(Core.authErrorMessage({ message: 'Token has expired or is invalid' }))));

check('an empty error still says something useful', () =>
  assert.ok(Core.authErrorMessage(null).length > 0));

check('the pending queue is oldest first', () =>
  assert.deepStrictEqual(
    Core.sortPending([
      { id: 'b', created_at: '2026-08-02T00:00:00Z' },
      { id: 'a', created_at: '2026-08-01T00:00:00Z' }
    ]).map(r => r.id), ['a', 'b']));

check('a row with no timestamp sorts last rather than jumping the queue', () =>
  assert.strictEqual(
    Core.sortPending([{ id: 'x' }, { id: 'a', created_at: '2026-08-01T00:00:00Z' }])[0].id, 'a'));

check('sortPending does not mutate what it is given', () => {
  const rows = [{ id: 'b', created_at: '2026-08-02T00:00:00Z' },
                { id: 'a', created_at: '2026-08-01T00:00:00Z' }];
  Core.sortPending(rows);
  assert.strictEqual(rows[0].id, 'b');
});

check('the queue label reads naturally for one account', () =>
  assert.strictEqual(Core.pendingCountLabel(1), '1 account waiting.'));

check('and for none', () =>
  assert.strictEqual(Core.pendingCountLabel(0), 'Nobody is waiting.'));

/* ── result ───────────────────────────────────────────────────────────── */
console.log('\n' + (failures ? '  ' + failures + ' of ' + checks + ' assertions FAILED'
                             : '  ' + checks + ' assertions passed') + '\n');
process.exit(failures ? 1 : 0);
