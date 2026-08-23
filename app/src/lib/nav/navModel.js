/**
 * One navigation model, rendered twice.
 *
 * The desktop sidebar and the mobile drawer are the same data in two shapes.
 * They diverged once already in this app — the phone's tab bar and the top bar
 * were built separately and disagreed about who could see the review queue —
 * so this is a pure function with no I/O, no `window`, and no role logic
 * anywhere else. Both surfaces render what it returns, and neither decides
 * anything on its own.
 *
 * Pure on purpose: it takes a viewer and a counts object and returns an array.
 * That is what makes it testable for all four roles without a database, and
 * what lets the server serialise the result straight into a client drawer.
 */

/**
 * The five the phone's tab bar can hold, in order, with the middle seat
 * reserved for an action rather than a destination.
 *
 * Six is one too many, so Rankings and Q&A moved behind More. What earns the
 * middle is the thing somebody opens the app standing up to do: start a
 * workout if they have the tracker, log a result if they do not. Both are a
 * plus sign, both are the only write on this bar, and neither is a place you
 * browse to.
 */
export const MOBILE_TABS = ['hub', 'calendar', 'center', 'network', 'more'];

/** What the middle button does, most specific first. */
export const CENTER_CANDIDATES = ['workout', 'log'];

/**
 * @param {object} viewer   from getViewerContext()
 * @param {object} counts   from get_viewer_nav_counts()
 */
export function navModel(viewer, counts = {}) {
  const pendingEntries = counts.pendingEntries || 0;
  const pendingQuestions = counts.pendingQuestions || 0;
  const allPendingQuestions = counts.allPendingQuestions || 0;

  const isAdmin = !!viewer?.isAdmin;
  const isLead = !!viewer?.isClubLead;
  const isModerator = !!viewer?.canModerateContent;

  const groups = [];

  /* Everything a member has. `log` is a route rather than a modal because
     logging a result on a phone deserves the whole screen, and because a
     modal cannot be linked to from a push notification or a lead's message. */
  groups.push({
    id: 'main',
    label: 'Hub',
    items: [
      { id: 'hub', href: '/hub', label: 'Hub', icon: 'home', tab: true },
      { id: 'calendar', href: '/hub/calendar', label: 'Calendar', icon: 'calendar', tab: true },
      { id: 'log', href: '/log', label: 'Log a result', icon: 'log', tab: true },
      { id: 'rankings', href: '/rankings/athletes', label: 'Rankings', icon: 'rankings', tab: true },
      { id: 'network', href: '/hub/network', label: 'Network', icon: 'network' },
      { id: 'qa', href: '/hub/qa', label: 'Q&A', icon: 'qa' },
      { id: 'vault', href: '/hub/resources', label: 'Vault', icon: 'vault' },
    ],
  });

  /* A lead's own chapter. An admin gets this too, scoped by the club switcher,
     rather than a parallel set of admin-only screens saying the same things. */
  if (isLead || isAdmin) {
    groups.push({
      id: 'club',
      label: 'Your chapter',
      items: [
        { id: 'club-entries', href: '/club/entries', label: 'Verify results', icon: 'check', badge: pendingEntries },
        { id: 'club-roster', href: '/club/roster', label: 'Roster', icon: 'roster' },
        { id: 'club-settings', href: '/club/settings', label: 'Club settings', icon: 'settings' },
      ],
    });
  }

  /*
   * Moderation, and the double count it used to cause.
   *
   * An admin is a moderator, so before this they got the Moderation group AND
   * the Admin group, both pointing at /moderate/questions, both carrying a
   * badge for the same queue. `sumBadges` then added the queue to itself and
   * the More tab showed twice the work that existed.
   *
   * So the group is omitted entirely for admins: the Admin group below already
   * carries the queue, with the org-wide count rather than the scoped one.
   */
  if (isModerator && !isAdmin) {
    groups.push({
      id: 'moderation',
      label: 'Moderation',
      items: [
        { id: 'moderate-questions', href: '/moderate/questions', label: 'Questions', icon: 'qa', badge: pendingQuestions },
      ],
    });
  }

  /*
   * Dark launch. The workout tracker is built and gated: an admin can reach
   * it, nobody else can see that it exists.
   *
   * Gated here rather than in the layout, because this function is the only
   * thing that decides what anybody can navigate to, and a link added beside
   * it would be a second answer to that question. It was two disagreeing
   * answers once already.
   *
   * Worth being clear about what this is and is not: it hides the door, not
   * the room. `/hub/workout` is reachable by URL, and the row-level security
   * on `workout_sessions` is what actually protects anything — a member who
   * guesses the path sees their own empty tracker, which is harmless.
   */
  if (isAdmin) {
    groups.push({
      id: 'training',
      label: 'Training',
      items: [
        { id: 'workout', href: '/hub/workout', label: 'Workout', icon: 'log' },
      ],
    });
  }

  if (isAdmin) {
    groups.push({
      id: 'admin',
      label: 'Admin',
      items: [
        { id: 'admin-questions', href: '/moderate/questions', label: 'Questions', icon: 'qa', badge: allPendingQuestions },
        { id: 'admin-users', href: '/admin/users', label: 'Users', icon: 'roster' },
        { id: 'admin-clubs', href: '/admin/clubs', label: 'Clubs', icon: 'clubs' },
      ],
    });
  }

  groups.push({
    id: 'account',
    label: 'You',
    items: [{ id: 'profile', href: '/hub/profile', label: 'Profile', icon: 'profile' }],
  });

  return groups;
}

/**
 * Everything waiting on this viewer, as one number for the More tab.
 *
 * The tab bar holds five destinations and the queues live behind the fifth, so
 * without this a lead's verification queue is invisible on a phone until they
 * think to go looking. The whole point of the aggregate is that nobody has to
 * remember to check.
 *
 * It sums the model rather than the raw counts, so anything omitted from the
 * model — the Moderation group for admins, the club group for members — is
 * omitted from the number too, by construction.
 */
export function sumBadges(nav) {
  return (nav || []).reduce(
    (total, group) => total + (group.items || []).reduce((n, item) => n + (item.badge || 0), 0),
    0,
  );
}

/** "99+" past two digits, and nothing at all at zero. */
export function badgeLabel(count) {
  if (!count || count < 1) return null;
  return count > 99 ? '99+' : String(count);
}

/** What a screen reader should hear instead of a bare numeral. */
export function badgeAriaLabel(count, subject = 'item') {
  if (!count || count < 1) return undefined;
  return `${count} ${subject}${count === 1 ? '' : 's'} needing attention`;
}

/**
 * The five tab-bar entries, in order, drawn from the model.
 *
 * Nothing is invented here. A tab appears only if `navModel` already granted
 * the destination behind it, which is what keeps the bar and the drawer from
 * ever disagreeing about who can reach what — the bug this whole module
 * exists to prevent. The middle seat picks the first action the viewer
 * actually has, and is dropped rather than faked if they have none.
 */
export function mobileTabs(nav) {
  const items = (nav || []).flatMap((g) => g.items || []);
  const center = CENTER_CANDIDATES
    .map((id) => items.find((i) => i.id === id))
    .find(Boolean);

  return MOBILE_TABS
    .map((id) => {
      if (id === 'more') return { id: 'more', label: 'More', icon: 'more' };
      if (id === 'center') return center ? { ...center, center: true, icon: 'plus' } : null;
      return items.find((i) => i.id === id) || null;
    })
    .filter(Boolean);
}
