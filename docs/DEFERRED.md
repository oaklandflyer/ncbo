# Deferred

Seams built and documented rather than stubbed. Nothing here is faked with a
placeholder key or a plausible-looking number.

---

## 1. IPEDS enrollment data — the big one

**Status:** script written and working; `data/enrollment.json` ships empty.

**Why:** the environment this was built in cannot reach `nces.ed.gov` — its
egress proxy returns 403 CONNECT for that host (verified against both the data
centre page and an `HD2023.zip` URL). The alternative, hand-entering enrollment
figures read from search summaries and labelling them IPEDS, is exactly the
invented-fact failure this project refuses.

**Consequence, visible on the site:** no club has a denominator, so no club can be
ranked, and `/standings` says so in as many words. Since there is no season, the
page would be in its pre-season empty state regardless.

**To resolve:** run it from an unrestricted network.

```sh
cd web && npm run fetch:enrollment      # or: npx tsx scripts/fetch-enrollment.ts
git add data/enrollment.json && git commit
```

It probes the current URL pattern rather than trusting a hardcoded one, and fails
loudly with a message distinguishing "network blocked" from "URL pattern changed".
It writes nothing on failure.

**Then:** fill in `ipedsUnitId` on each club in `data/clubs/`. This is the join
key and is currently `null` everywhere. Look each school up in the IPEDS
directory — do not infer a UnitID from a name.

---

## 2. Authentication

**Status:** types, roles, guard, middleware and a dev-only provider. No real auth.

See `docs/AUTH.md` for the intended `.edu` magic-link flow, the domain→school
mapping that has to be built and verified, and the full provisioning list. The
blocking dependency is an email provider.

Note the unresolved overlap with the existing Supabase project in `app/`.

---

## 3. Campus coordinates for two chapters

**Status:** four of six chapters plotted; Penn State and Iowa are not.

Coordinates for Pitt, Purdue, FSU and Slippery Rock were verified against cited
Wikipedia sources and carry their citation in the club data file. For Penn State
(University Park) and the University of Iowa, no citable coordinate could be
confirmed through the search-only access available here.

Both chapters appear in the directory, are named in the map caption as unplotted,
and their club pages say why. **To resolve:** add a `location` block to
`data/clubs/penn-state.json` and `data/clubs/iowa.json` with `lat`, `lng`,
`precision` (`campus` or `city`), `label` and a `source` citation. The schema
requires the citation, so an uncited coordinate will fail the build.

---

## 4. Deployment

**Status:** unchanged. GitHub Pages still serves the repo root, and this build
does not touch that.

The Astro project builds to `web/dist/`. Two ways forward, both requiring a
repository settings change that is the owner's to make:

**Option A — Pages via GitHub Actions, hub at the root.** Copy the existing static
files into `web/public/` (or add a build step that merges them), build, and deploy
`web/dist` with `actions/deploy-pages`. Gives clean URLs: `/standings`,
`/clubs/pitt`. Requires switching Pages from "deploy from branch" to "GitHub
Actions".

**Option B — hub under `/hub/`.** Set `base: '/hub'` in `astro.config.mjs` and
publish `web/dist` into a `hub/` directory on the served branch. Preserves the
current deploy model; URLs become `/hub/standings`.

Recommendation: A. B doubles the deploy surface and the URLs read like a
subdirectory rather than part of the site.

There is also **no CI**. `npm run verify` (types, tests, content policy, contrast)
is the check to wire into a workflow.

---

## 5. Conferences

**Status:** `data/conferences/` is empty on purpose.

NCBO has no conference structure. Regions grouped by geography would read as a
real NCBO decision nobody has made. `/standings` says none are defined;
`/standings/[conference]` generates no pages. Adding a JSON file there and setting
`conference` on club records is all that is needed — the schema will fail the
build on a club referencing a conference that does not exist.

---

## 6. Rank movement

**Status:** computed and tested; never rendered, because there is no history.

`computeMovement` returns an empty array with no previous snapshot, and the table
omits the column entirely rather than showing a row of dashes implying "held
position". Publishing standings snapshots is the missing piece: a real season
needs each published table archived so the next one has something to move against.

---

## 7. Events

**Status:** `data/events/` is empty. Nothing is scheduled.

The schema, listing, detail pages, filters and ICS generation are all built and
exercised by the sample fixtures. Adding a real event is dropping a JSON file in
`data/events/`.

---

## 8. Member ceiling

Not in this pass, by scope. Profile, check-ins and club tools are named in the
route rules (`/hub/*`) and nothing else. The public floor is complete.
