# Privacy

## The decision

**Member profile visibility defaults to `private`, and is opt-in.** The prototype
had public rosters showing name, school, age and division. That is not built, and
the default is inverted from what it proposed.

## Why

Publishing a roster links a named student to bodybuilding participation. That is
not a neutral fact about them:

- **It is appearance-linked.** A public record ties a real name to a sport judged
  on how someone's body looks, indexed and searchable, years after they graduate.
- **It is sometimes PED-adjacent by association.** Bodybuilding carries a public
  assumption about drug use that a member has no way to rebut and did not sign up
  for. A student who joined a campus club to lift with friends should not acquire
  that association by appearing in a directory.
- **Age and division are sensitive in combination.** Name plus school plus age is
  close to identifying on its own; adding a physique division makes a profile of a
  young person's body a public record.
- **Students cannot meaningfully consent at sign-up.** Nobody reads a visibility
  toggle at the moment they join a club. An opt-out default converts inattention
  into publication, which is why the default is opt-in.

The cost of this choice is a less impressive-looking directory. That is a good
trade.

## What is encoded in the schema

In `web/src/lib/schemas.ts`, `memberSchema`:

- `visibility` defaults to `'private'`. Parsing an object with no `visibility`
  field yields a private profile. A future form that forgets to send the field
  produces the safe outcome, not the exposing one.
- **There is no field that can make `email` public.** Not "defaults to private" —
  no such setting exists to be flipped. Same for precise location.
- The schema is `.strict()`. An unknown key like `emailVisibility: 'public'` is a
  **parse error**, not a silently ignored field, so an attempt to add exposure
  fails loudly rather than appearing to work.
- `verified` defaults to `false`. Verification is something NCBO does, never
  something a submitted payload asserts about itself.

These are covered by tests in `web/src/lib/auth/auth.test.ts`, including the
specific case of an omitted `visibility` field.

## Club location precision

Clubs publish a campus or campus-city coordinate — a public institutional
location, not anyone's address. Individual members have no location field of any
precision, and the map plots institutions only.

## What is published today

Only what already appears on the public marketing site: school, club name, club
lead's name, and status. Member counts, contact details, socials and founding
dates are absent because NCBO holds no verified record of them — and when records
exist, publishing them is still a separate decision from holding them.

## Before building the member ceiling

1. Any roster UI must read `visibility` and default to hiding, not showing.
2. A member changing their visibility should see, in plain words, exactly what
   becomes visible and to whom.
3. Deletion should mean deletion, including from any derived standings snapshot
   that carries a name.
4. Under FERPA, an institution's rules about student data may reach further than
   NCBO's own policy where a club is university-recognised. Check before building
   anything that syncs with a university system.
