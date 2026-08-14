# Content Policy

What this site will and will not publish, and why. These are not guidelines. The
exclusions below are enforced by `web/scripts/check-content.ts`, which fails
`npm run verify` on a violation, so that a rule survives being forgotten.

## Why this exists

NCBO's audience is university students, mostly 18–22, in a sport judged on
appearance. Material that would be merely unwise on a general fitness blog is
actively dangerous published under an organisation's name to that audience,
because the organisation's name is what makes it credible.

## Hard exclusions

### 1. No dehydration, water manipulation or electrolyte protocols

Not as instructions. Not as a description of "what people do". Not as a table,
not as a warning that doubles as a method, not in a downloadable template.

The Helms, Aragon & Fitschen review is explicit that the practice **can be
dangerous, and may not improve appearance**. That sentence is the entirety of
what this site says on the subject. A peak-week water protocol published under
NCBO's name is the single worst thing this project could ship.

### 2. No diuretics of any kind

Including over-the-counter products and anything marketed as a "natural"
diuretic. No brands, no dosages, no timing, no "some competitors use".

### 3. No actionable PED, SARM or pro-hormone content

Factual description of **what is banned and why** is fine and appears on
`/resources/competing` — competitors need to know the rules they are subject to.

Anything actionable is not: no dosages, no cycle lengths, no stacking, no
sourcing, no post-cycle protocols, no harm-reduction framing that amounts to
instructions.

### 4. No individual prescriptions

No specific calorie targets, cut timelines or body-fat targets for named
individuals or for the reader. No goal-weight calculators. No "you should weigh"
anything. Population-level ranges from peer-reviewed sources are fine, and are
what `/resources/prep` publishes; individual numbers require knowing a person,
and a website does not know anyone.

### 5. No generic authority badges

The prototype had a "Verified Knowledge" badge on coaches. It is not built and
must not be.

An IFBB pro card is a competition credential. It is not a nutrition or medical
one, and a badge that flattens the difference invites a 19-year-old to take
dietary advice on the strength of someone's stage placing. If credentials are
displayed at all, `Credential.astro` shows the **specific** qualification — RD,
CSCS, MD — and nothing more.

`VERIFIED` in the badge set means *NCBO has checked this membership record*. Its
tooltip says so explicitly.

## Mandatory inclusions

- **Every page making a health, nutrition or training claim carries the medical
  disclaimer and links to `/resources/health`.** This is enforced by the content
  schema (`medicalDisclaimer: true` in frontmatter renders it), not by whoever
  edits the Markdown next.
- **Every external factual claim carries a citation** with a source URL and the
  date it was last checked, rendered visibly on the page.
- **Anything unverifiable is cut**, and where its absence would be noticeable,
  the page says what could not be verified. See the "What we could not verify"
  section on `/resources/competing` for the pattern.

## Help resources

Before publishing any helpline, **verify it is currently operating**. The NEDA
helpline was discontinued in 2023 and still circulates widely in resource lists;
publishing a dead number to someone in difficulty does real harm. Currently
published: the National Alliance for Eating Disorders and ANAD, both checked
2026-08-14, alongside the advice to use campus counselling first.

## On sample data

No number in a production build may be presentable as a real standing. Sample
data lives in `data/samples/`, loads only under `NCBO_DEMO_DATA=1` on the dev
server, renders under a persistent non-dismissible banner, and **throws** if it
is ever reached during a production build. Sample institutions are fictional and
suffixed `(SAMPLE)` so that even a cropped screenshot cannot be mistaken for a
real club's result.

## Changing this policy

Edit this file and `web/scripts/check-content.ts` in the same commit, and say in
the commit message why. If a check produces a false positive, rephrase the copy
or add a narrow allowance in that script with a stated reason — do not delete the
rule.
