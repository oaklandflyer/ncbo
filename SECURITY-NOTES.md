# Security notes — what the NCBO sign-in is, and what it isn't

Read this before you decide what to put in the member area.

## The honest limit

This site is static files on GitHub Pages. There is no server that can decide
who gets a page and who doesn't — **every file in this repo is served to anyone
who asks for it**, including:

- `data/members.json`, the account list with the password hashes in it
- `assets/member-data.js`, everything on the member hub
- `admin/photos.html` and `admin/index.html`, the admin pages themselves

The sign-in runs entirely in the visitor's browser. That means anyone can
download `data/members.json` and attack the hashes offline, at whatever speed
their hardware allows, without the site ever knowing.

What we do about it: passwords are stored as **PBKDF2-SHA256, 210,000
iterations, 32-byte output, with a 16-byte random salt per user**. The salt
being per-user means one cracked password tells an attacker nothing about the
others, and no precomputed table helps. The iteration count means each guess
costs real time. A good password stays out of reach; `password1` does not.

So the gate is worth having, and it is **"members only, please"**, not access
control. Concretely:

**Fine behind it:** meeting notes, internal links, the season calendar,
resource drafts, the Q&A board, club operations documents.

**Not fine behind it:** anything you'd be upset to see forwarded — member
contact details, addresses, dues or payment information, health or body-
composition data, judging keys, credentials or API tokens for anything, and
personal information about members generally.

**If you need actual access control**, it's a hosting change, not a code
change: put the site behind something that authenticates *before* it serves the
page — Cloudflare Access, Netlify password protection, or a host with real
accounts. Only then is a page genuinely withheld from someone who hasn't signed
in. (The `app/` directory in this repo is the other route: a real Next.js +
Supabase application with server-side accounts and row-level security.)

## Admins vs members

Every account has a `kind`, either `admin` or `member`.

| | member | admin |
|---|---|---|
| `members.html` after sign-in | yes | yes |
| pages under `admin/` | "admins only" screen | yes |
| lands on, after sign-in | the member hub | `admin/index.html` |

`admin/gate.js` is the first script in the `<head>` of every admin page. It
hides the body before anything renders, loads `assets/js/auth.js`, and only
removes the hiding style for an admin session. Anything else — no session, a
member session, auth.js failing to load — leaves the body hidden behind an
overlay. It fails closed, so an error never reveals the page.

That said, per the section above: the admin HTML is a static file anyone can
fetch and read. **The thing that actually protects the live site is the GitHub
personal access token**, which each admin enters on the page and which is never
stored in this repo. The sign-in decides who sees the admin UI; the token
decides who can change anything. Keep tokens fine-grained, scoped to this one
repository, `Contents: Read and write` and nothing else.

## Managing accounts

All accounts live in `data/members.json`. Use the CLI — it writes the exact
format the browser reads, and it never stores, echoes or logs a plaintext
password.

```bash
# add or replace an account (prompts twice for the password, minimum 8 chars)
python3 tools/make-member.py --user jdoe --name "J Doe" --role Curator --kind admin

# a plain member
python3 tools/make-member.py --user rlee --name "R Lee" --role Member --kind member

# see who exists
python3 tools/make-member.py --list

# remove someone
python3 tools/make-member.py --remove jdoe
```

Notes:

- Usernames are lowercased, and re-running `--user` for an existing name
  **replaces** that record rather than adding a duplicate. That's how you reset
  someone's password.
- `--password` exists for scripting, but prefer the prompt — a password passed
  on the command line lands in your shell history.
- Each record stores its own `iter`. You can raise the default in
  `tools/make-member.py` later and existing accounts keep working; they move to
  the new count next time their password is set.
- Commit and push `data/members.json` for a change to take effect — it's the
  live site's account list.
- Removing an account takes effect on the next page load. It does not kill a
  session already open in someone's browser; those expire on their own (12
  hours for a normal sign-in, 30 days if they ticked "keep me signed in").

## Starter accounts — replace these

The repo ships with two accounts so you can test the flow end to end:

| username | password | kind |
|---|---|---|
| `admin` | `barbell-stagelight-7945` | admin |
| `member` | `preacher-chalkbag-7281` | member |

**These passwords are public.** They are written down here, in a repository
anyone can read, which means they protect nothing at all. They exist so you can
click through the sign-in once and confirm it works. Replace both before the
site is doing anything real:

```bash
python3 tools/make-member.py --user admin  --name "Your Name" --role Curator --kind admin
python3 tools/make-member.py --user member --name "NCBO Member" --role Member --kind member
```

Each command prompts for the new password twice and overwrites the existing
record. Then delete the table above, commit, and push.

If you'd rather use your own usernames, add them first and remove the seeds:

```bash
python3 tools/make-member.py --user acoutinho --name "Andrew Coutinho" --role "Chief Executive Officer" --kind admin
python3 tools/make-member.py --remove admin
python3 tools/make-member.py --remove member
```

## How the pieces fit

| File | What it does |
|---|---|
| `data/members.json` | The account list: username, display name, role, kind, salt, iterations, hash. No plaintext, ever. |
| `assets/js/auth.js` | The whole sign-in: PBKDF2 via the browser's WebCrypto, session storage, `isAdmin`, `homeFor`. First-party, no libraries. |
| `assets/app.js` | The member page: sign-in form, then the hub. Member content stays `hidden` and `member-data.js` isn't even fetched until sign-in succeeds. |
| `admin/gate.js` | The admin gate. One line in each admin page's `<head>`. |
| `tools/make-member.py` | Account management, writing the same format Python-side. |

A few deliberate details, so nobody "simplifies" them away later:

- **An unknown username still runs a full PBKDF2 derivation** against a dummy
  salt, so a wrong username and a wrong password take about the same time. A
  stopwatch can't be used to enumerate who has an account.
- **The hash comparison is constant-time** — it XOR-accumulates across the
  whole string with no early return, so timing can't be used to guess a hash
  character by character.
- **The error message never says which field was wrong.** "That username and
  password didn't match." is the only failure the page reports.
- **Sign-out clears the old shared-passcode key too** (`ncbo-member-access`),
  so a browser left "unlocked" under the previous gate doesn't stay in.
- **WebCrypto needs a secure context.** The sign-in works over `https` and over
  `http://localhost`, but not over plain `http` on a LAN address — the page
  says so up front rather than failing silently.

## What changed from the old gate

The member area used to be one shared access code (`NCBO2026`), stored in
`assets/member-data.js` in plaintext and readable by anyone who opened the file.
It's gone: `access.codes` has been removed, and rotating a code is no longer how
you remove someone's access — remove their account instead. The admin pages
were previously not gated at all; they are now behind an admin account.
