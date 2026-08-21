import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  navModel, sumBadges, badgeLabel, badgeAriaLabel, mobileTabs,
} from '../src/lib/nav/navModel.js';
import { resolveClubScope } from '../src/lib/scope.js';

/* The four roles the nav has to serve. Written as fixtures rather than built
   inline so each test says which role it is about in one word. */
const member = { isAdmin: false, isClubLead: false, canModerateContent: false, ledClubIds: [] };
const lead = { isAdmin: false, isClubLead: true, canModerateContent: false, ledClubIds: ['club-a'] };
const advisor = { isAdmin: false, isClubLead: false, canModerateContent: true, ledClubIds: [] };
const admin = { isAdmin: true, isClubLead: false, canModerateContent: true, ledClubIds: [] };

const counts = { pendingEntries: 3, pendingQuestions: 4, allPendingQuestions: 7 };
const ids = (nav) => nav.flatMap((g) => g.items.map((i) => i.id));
const groupIds = (nav) => nav.map((g) => g.id);

test('a member gets the main group and their profile, and nothing gated', () => {
  const nav = navModel(member, counts);
  assert.deepEqual(groupIds(nav), ['main', 'account']);
  assert.ok(ids(nav).includes('log'));
  assert.ok(!ids(nav).includes('club-entries'));
  assert.ok(!ids(nav).includes('moderate-questions'));
  assert.ok(!ids(nav).includes('admin-users'));
});

test('a member has no badges at all, so the More tab shows nothing', () => {
  const nav = navModel(member, counts);
  assert.equal(sumBadges(nav), 0);
  assert.equal(badgeLabel(sumBadges(nav)), null);
});

test('a lead gets the club group, badged with their own pending entries', () => {
  const nav = navModel(lead, counts);
  assert.deepEqual(groupIds(nav), ['main', 'club', 'account']);
  const entries = nav.flatMap((g) => g.items).find((i) => i.id === 'club-entries');
  assert.equal(entries.badge, 3);
  assert.equal(sumBadges(nav), 3);
});

test('an advisor gets moderation scoped to their own queue', () => {
  const nav = navModel(advisor, counts);
  assert.deepEqual(groupIds(nav), ['main', 'moderation', 'account']);
  const q = nav.flatMap((g) => g.items).find((i) => i.id === 'moderate-questions');
  assert.equal(q.badge, 4);
  assert.equal(sumBadges(nav), 4);
});

test('an admin does NOT get the moderation group, only the admin one', () => {
  /* The double count this exists to prevent: an admin is also a moderator, so
     without the exclusion they got both groups, both linking to
     /moderate/questions, both badged for the same queue — and the More tab
     showed twice the work that existed. */
  const nav = navModel(admin, counts);
  assert.deepEqual(groupIds(nav), ['main', 'club', 'admin', 'account']);
  assert.ok(!groupIds(nav).includes('moderation'));

  const questionItems = nav.flatMap((g) => g.items).filter((i) => i.href === '/moderate/questions');
  assert.equal(questionItems.length, 1, 'the questions queue appears exactly once');
  assert.equal(questionItems[0].badge, 7, 'and carries the org-wide count');
});

test('the admin aggregate counts each queue once', () => {
  const nav = navModel(admin, counts);
  // 3 pending entries + 7 org-wide questions. Not 3 + 4 + 7.
  assert.equal(sumBadges(nav), 10);
});

test('badge display caps at 99+ and disappears at zero', () => {
  assert.equal(badgeLabel(0), null);
  assert.equal(badgeLabel(null), null);
  assert.equal(badgeLabel(1), '1');
  assert.equal(badgeLabel(99), '99');
  assert.equal(badgeLabel(100), '99+');
  assert.equal(badgeLabel(4000), '99+');
});

test('the badge reads as words to a screen reader, and is absent at zero', () => {
  assert.equal(badgeAriaLabel(0), undefined);
  assert.equal(badgeAriaLabel(1, 'result'), '1 result needing attention');
  assert.equal(badgeAriaLabel(5, 'result'), '5 results needing attention');
});

test('the mobile tab bar is always five, with More last', () => {
  for (const viewer of [member, lead, advisor, admin]) {
    const tabs = mobileTabs(navModel(viewer, counts));
    assert.equal(tabs.length, 5, 'six across a 390px screen is narrower than a fingertip');
    assert.equal(tabs[4].id, 'more');
    assert.ok(tabs.every(Boolean));
  }
});

test('counts default to zero rather than rendering undefined', () => {
  const nav = navModel(lead);
  assert.equal(sumBadges(nav), 0);
  assert.equal(nav.flatMap((g) => g.items).find((i) => i.id === 'club-entries').badge, 0);
});

test('a lead cannot scope a club screen to somebody else\'s chapter', () => {
  assert.deepEqual(resolveClubScope(lead, 'club-b'), {
    clubId: 'club-a', canSwitch: false, reason: 'denied',
  });
  assert.deepEqual(resolveClubScope(lead, 'club-a'), {
    clubId: 'club-a', canSwitch: false, reason: 'own',
  });
});

test('an admin can, and gets the switcher', () => {
  assert.deepEqual(resolveClubScope(admin, 'club-b'), {
    clubId: 'club-b', canSwitch: true, reason: 'requested',
  });
});

test('an admin with no request and no clubs of their own scopes to nothing', () => {
  /* Never "the first club in the table": that would silently show somebody a
     page about a chapter they did not choose. */
  assert.deepEqual(resolveClubScope(admin, null), {
    clubId: null, canSwitch: true, reason: 'none',
  });
});
