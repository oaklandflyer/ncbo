# Website content manager — a local tool

This edits the public site's content (`assets/data.js`) from a browser form
instead of by hand. It is **not published**: `_config.yml` excludes `admin/`
from the GitHub Pages build, so there is no `thencbo.org/admin/` to find.

That is deliberate. This repository is public, so serving the tool only
advertised that it existed — the URL was never the thing protecting anything.
What actually guards the live site is the **GitHub personal access token** you
paste into the Content page: without a token that has write access to this
repo, the tool can display the site's content but cannot change a byte of it.

## Running it

From your own copy of the repo:

```bash
git clone https://github.com/oaklandflyer/ncbo.git   # or: git pull
cd ncbo
python3 -m http.server 8000
```

Then open **http://localhost:8000/admin/** and pick a tool.

Use a local server rather than double-clicking the file: opening it as
`file://` gives the page a `null` origin, which the GitHub API rejects, so
saving would fail.

## The token

Create a **fine-grained** personal access token at
<https://github.com/settings/personal-access-tokens/new>, scoped to this one
repository, with **Contents: Read and write** and nothing else. Paste it into
the Content page when you save.

- It is sent from your browser straight to `api.github.com`. It is never sent
  anywhere else, and nothing in this repository stores it server-side.
- "Remember token on this device" keeps it in this browser's local storage.
  Don't tick that on a shared machine.
- Revoke it from the same settings page the moment you no longer need it.

## What each page does

| Page | What it edits |
|---|---|
| `photos.html` | Site content and photos — `assets/data.js`, committed straight to `main` |
| `index.html` | The menu of tools |

Saving commits to `main`, which redeploys GitHub Pages. There is no staging
step: what you save is what the site shows a minute later.

## This is not the member hub

The member hub — accounts, the approval queue, the board — is the Next.js app
in `app/`, deployed separately and signed into with a magic link. It has its
own admin page at `/hub/admin` for approving members. The two are unrelated:
this tool edits the marketing site's content, that one manages people.
