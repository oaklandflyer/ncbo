# Website content manager

Edits the public site's content (`assets/data.js`) through a browser form
instead of by hand. Published at **https://thencbo.org/admin/**, behind a
passphrase.

Nothing here uses Supabase, Vercel, or any other paid service. The page is a
static file on GitHub Pages and talks to exactly one host: `api.github.com`,
with your token, from your browser.

## Two locks, doing different jobs

**The passphrase** (`gate.js`) decides who sees the editor. It is checked in
the browser with WebCrypto — PBKDF2-SHA256, 310,000 iterations — against a salt
and hash committed in `gate.js`.

Be clear about what that is: this repository is public, so those values are
readable by anyone and can be attacked offline. The passphrase is 16 random
characters for that reason. It keeps casual visitors and crawlers out of the
editor UI, and that is its whole job.

**The GitHub token** is what actually protects the live site. Saving requires a
fine-grained personal access token with write access to this repo, typed into
the Content page. Without one, this tool can display the site's content and
change nothing at all. Someone who guessed the passphrase would find a form
they cannot save from.

## Changing the passphrase

In any browser console, with your new passphrase:

```js
const pass = 'your-new-passphrase';
const salt = crypto.getRandomValues(new Uint8Array(16));
const hex  = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const key  = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
console.log('SALT =', hex(salt), '\nHASH =', hex(bits));
```

Paste the two values over `SALT` and `HASH` at the top of `gate.js`, bump the
`?v=` on the `<script src="gate.js?v=...">` line in both admin pages so nobody
keeps a cached copy of the old one, and commit.

## The token

Create a **fine-grained** token at
<https://github.com/settings/personal-access-tokens/new>, scoped to this one
repository, **Contents: Read and write**, nothing else.

- It goes from your browser straight to `api.github.com` and nowhere else.
  Nothing in this repository stores it server-side.
- "Remember token on this device" keeps it in that browser's local storage.
  Don't tick it on a shared machine.
- Revoke it from the same settings page when you no longer need it.

## Running it locally

Not required — it works at the URL above — but useful for testing changes:

```bash
python3 -m http.server 8000     # from the repo root
# then http://localhost:8000/admin/
```

Use a server rather than double-clicking the file: a `file://` page has a
`null` origin, which the GitHub API rejects, and WebCrypto is unavailable
outside a secure context so the passphrase could not be checked either.

## This is not the member hub

The member hub — accounts, the approval queue, the board — is the Next.js app
in `app/`, deployed separately at hub.thencbo.org and signed into with a magic
link. It has its own admin page at `/hub/admin` for approving members. The two
share nothing: this tool edits the marketing site's content, that one manages
people.
