# Auth

## Status: seam built, system not

There is **no working authentication in this build**, and no sign-in button on
the public site. A login that does not work is worse than no login.

What exists:

| Piece | Where | State |
|---|---|---|
| `Member`, `Session`, `Role` types | `web/src/lib/auth/types.ts` | Done |
| Role model + `atLeast` comparison | `web/src/lib/auth/types.ts` | Done |
| Route rules and the guard decision function | `web/src/lib/auth/guard.ts` | Done, unit-tested |
| Route-protection middleware | `web/src/middleware.ts` | Wired, fails closed |
| Dev-only file session provider | `web/src/lib/auth/dev-provider.ts` | Done, refuses in production |
| Email delivery, magic links, real sessions | — | **Not built. Needs an account.** |

## Roles

`member` → `officer` → `coach` → `admin`, ordered least to most privileged.
`atLeast()` compares by index, so **the order of the `ROLES` array is
load-bearing** — inserting a role in the middle silently changes who can reach
what.

- **member** — their own profile, check-ins, club membership
- **officer** — club tools: roster, event submission, club settings
- **coach** — coaching surfaces; deliberately *not* an officer of a club
- **admin** — NCBO staff; verification, sanctioning, everything

## Protected routes

Defined in `PROTECTED_ROUTES`. Longest prefix wins, so `/hub/admin` is not
satisfied by the `/hub` rule. Nothing under these prefixes is built yet — the
rules exist first so that adding a page there is protected by default rather than
by someone remembering.

An unauthenticated request to a protected route gets **404, not 403**, so the
response does not disclose which member surfaces exist. An authenticated request
with an insufficient role gets 403, because at that point the user already knows.

## Two things about the middleware

1. **The site builds to static output.** Middleware runs at build time, not per
   request, so it protects nothing at runtime today. It becomes real the moment
   the member ceiling needs a server adapter. Until then it fails closed: with no
   session provider wired in, every protected prefix refuses.
2. **The dev provider is deliberately not wired into it.** A provider with no
   security properties has no business being the thing that decides access, even
   locally.

## The dev provider

`DevFileSessionProvider` reads sessions from JSON files under `.sessions/`. It
exists so the seam can be exercised without an email provider.

It **throws `DevAuthInProductionError` on construction** when
`NODE_ENV === 'production'`. Not disabled, not warned about — constructing it
fails, because a provider that quietly degrades is one that eventually ships.

## The intended real flow: `.edu` magic link

1. Visitor enters an institutional email address.
2. **Domain check.** The domain must map to a school in `data/clubs/` (see the
   mapping section below). A non-institutional address is refused with an
   explanation, not silently queued.
3. Server generates a single-use token: ≥32 bytes of CSPRNG entropy, stored
   **hashed**, 15-minute expiry, bound to the email and to one use.
4. Email delivers the link. **This is the step that needs a provider.**
5. Callback verifies the token, marks it used, creates a session, sets an
   `HttpOnly; Secure; SameSite=Lax` cookie.
6. First sign-in creates a `Member` with `role: 'member'`, `visibility:
   'private'`, `verified: false`. Verification and role changes are admin actions.

Rate limiting is required at steps 1 and 5 — per address and per IP — or the
endpoint is an email-sending oracle for anyone who wants one.

## Domain → school mapping

Needs a new committed data file, `data/school-domains.json`, mapping email
domains to club slugs:

```json
{ "pitt.edu": "pitt", "psu.edu": "penn-state", "purdue.edu": "purdue" }
```

It is **not** built in this pass, because every entry is a factual claim about a
school's email domain that would have to be verified — and a wrong entry either
locks out a whole campus or admits the wrong one. Verify each domain against the
institution before adding it.

Subdomains need a deliberate decision (`@pitt.edu` vs `@medschool.pitt.edu`), as
do schools with several domains, and alumni domains that must **not** grant
membership.

## What you would need to provision

Everything here is currently ruled out by the no-external-accounts constraint, so
this is the shopping list, not a recommendation to go shopping.

1. **An email provider** for magic links — the blocking dependency. Anything with
   an SMTP or HTTP API. Costs: an account, an API key, and domain verification
   (SPF/DKIM/DMARC on `thencbo.org`) or the links land in spam.
2. **A server runtime.** Static hosting cannot verify a session. Either an Astro
   server adapter on a Node host, or serverless functions.
3. **Session storage.** Postgres, SQLite on a persistent disk, or Redis. Note the
   existing `app/` directory already chose Supabase for this — see below.
4. **Secret management** for the token-signing key and provider credentials.
5. **`data/school-domains.json`**, verified per school.

## The elephant: `app/`

The repository already contains `app/`, a Next.js + Supabase project implementing
magic-link sign-in, an approval queue, four roles and row-level security. It is
further along than this seam in some respects.

It cannot run without a Supabase account and two keys, which this build's
constraints rule out. The two are alternative answers to the same question, and
**someone has to pick one** before either becomes real. This seam is deliberately
provider-agnostic; `app/` is not, and its RLS-in-the-database model is a genuinely
stronger security posture than middleware alone. That is an argument for it, if
the account is acceptable.

## Not built, on purpose

- Session rotation on privilege change
- CSRF tokens on state-changing forms (no such forms exist yet)
- Audit logging of admin actions
- Account deletion (see `docs/PRIVACY.md` — deletion must mean deletion)
