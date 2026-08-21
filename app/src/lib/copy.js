/**
 * NCBO's canonical marketing copy — one file, so the next wording change is a
 * one-file edit rather than a hunt through components.
 *
 * What belongs here: the organisation's own description of itself, which is
 * the same wherever it appears and is signed off outside engineering.
 *
 * What does NOT belong here: the hub's functional copy ("Your club, then the
 * league", "Who's out there"). That is interface writing — it changes with the
 * screen it sits on, and hoisting it into a shared constants file would make
 * every screen's voice everybody's business.
 *
 * Apostrophes are curly (’) throughout, matching display copy across the app.
 */
export const TAGLINE = 'Clubs. Competition. Community.';

export const SUBTITLE = 'The governing body for college bodybuilding clubs.';

export const MISSION =
  'The National Collegiate Bodybuilding Organization exists to educate and support '
  + 'college students in the sport of bodybuilding, providing accessible coaching, safe '
  + 'training and nutrition resources, and a structured community where students develop '
  + 'discipline, confidence, and lifelong health habits.';

export const PITCH =
  'NCBO is the overarching governing body for collegiate bodybuilding, acting as a '
  + 'national resource network designed to support student-run clubs without replacing '
  + 'them. We provide independent campus clubs with an institutional pathway, covering '
  + 'everything from a first training split to a competitive stage season, while allowing '
  + 'local chapters to retain complete operational autonomy. By unifying campus lifters, '
  + 'we are building the definitive collegiate era for the sport.';

/** Long enough to say what NCBO is, short enough that search engines keep it. */
export const META_DESCRIPTION = `${SUBTITLE} ${MISSION}`.slice(0, 300);

export const ORG_NAME = 'National Collegiate Bodybuilding Organization';
export const ORG_SHORT = 'NCBO';
