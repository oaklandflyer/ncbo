#!/usr/bin/env bash
# ============================================================================
# NCBO — test/guards.sh
# The things that are true about this repository, checked in a few seconds.
#
#   bash test/guards.sh
#
# Not unit tests: these are the invariants that a careless edit quietly breaks
# and nobody notices until the member hub is broken in production — the load
# order at the end of members.html, the cache-busting query strings, and the
# absence of the password file this project used to ship.
#
#   ok    — as expected
#   warn  — expected for now, does not fail the run (the Supabase project
#           values are filled in per deployment, not committed here)
#   FAIL  — something is wrong; the script exits non-zero
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

fails=0
warns=0

ok()   { printf '  ok    %s\n' "$1"; }
warn() { printf '  warn  %s\n' "$1"; warns=$((warns + 1)); }
fail() { printf '  FAIL  %s\n' "$1"; fails=$((fails + 1)); }

want_absent() {  # want_absent <path> <label>
  if [ -e "$1" ]; then fail "$2 — $1 is still in the working tree"; else ok "$2"; fi
}

want_file() {    # want_file <path> <label>
  if [ -f "$1" ]; then ok "$2"; else fail "$2 — $1 is missing"; fi
}

# Every HTML page on the public site. app/ is a separate Next.js project with
# its own build, and is not part of this check.
pages() { git ls-files '*.html' | grep -v '^app/'; }

# ── 1. the old password gate is gone ────────────────────────────────────────
echo
echo "legacy password gate"
want_absent data/members.json    "the committed password file is gone"
want_absent tools/make-member.py "the account-minting script is gone"
want_absent assets/js/auth.js    "the browser-side PBKDF2 verifier is gone"

if git ls-files -z '*.js' '*.html' | grep -zv '^app/' \
   | xargs -0 grep -lniE 'pbkdf2|derivebits|members\.json' 2>/dev/null | grep -q .; then
  echo "        found in:"
  git ls-files -z '*.js' '*.html' | grep -zv '^app/' \
    | xargs -0 grep -lniE 'pbkdf2|derivebits|members\.json' 2>/dev/null | sed 's/^/        /'
  fail "no PBKDF2 or members.json references remain in site code"
else
  ok "no PBKDF2 or members.json references remain in site code"
fi

if grep -q 'type="password"' members.html; then
  fail "members.html has no password field"
else
  ok "members.html has no password field"
fi

# ── 2. the files the new gate is made of ────────────────────────────────────
echo
echo "auth files"
want_file assets/supabase-config.js "assets/supabase-config.js"
want_file assets/ncbo-auth-core.js  "assets/ncbo-auth-core.js"
want_file assets/ncbo-auth.js       "assets/ncbo-auth.js"
want_file assets/ncbo-review.js     "assets/ncbo-review.js"
want_file review.html               "review.html at the repository root"

# ── 3. members.html markup ──────────────────────────────────────────────────
echo
echo "members.html panels"
for view in loading unconfigured error signed-out link-sent pending suspended approved; do
  if grep -q "data-auth-view=\"$view\"" members.html; then
    ok "panel: $view"
  else
    fail "panel: $view is missing from members.html"
  fi
done

# The hub root has to sit inside the approved panel, or the hub renders for
# people who are signed in but not approved.
if awk '/data-auth-view="approved"/{f=1} f&&/id="app"/{found=1} END{exit !found}' members.html; then
  ok "the hub root (#app) is inside the approved panel"
else
  fail "the hub root (#app) is not inside the approved panel"
fi

# ── 4. load order at the end of members.html ────────────────────────────────
echo
echo "members.html load order"
order_ok=1
prev=0
for src in 'supabase-js' 'assets/supabase-config.js' 'assets/ncbo-auth-core.js' 'assets/ncbo-auth.js'; do
  line=$(grep -n "<script[^>]*src=\"[^\"]*$src" members.html | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    fail "load order: $src is not loaded"
    order_ok=0
  elif [ "$line" -le "$prev" ]; then
    fail "load order: $src is loaded out of order (line $line)"
    order_ok=0
  else
    prev=$line
  fi
done
[ "$order_ok" = 1 ] && ok "supabase-js → config → auth-core → auth, in that order"

last_script=$(grep -n '<script' members.html | tail -1 | cut -d: -f1)
if [ "$last_script" = "$prev" ]; then
  ok "the auth stack is the last thing in the body"
else
  fail "something is loaded after assets/ncbo-auth.js (line $last_script)"
fi

# ── 5. cache busting ────────────────────────────────────────────────────────
echo
echo "cache busting"
stale=0
for page in $(pages); do
  bad=$(grep -oE '<(script|link)[^>]*(src|href)="[^"]+"' "$page" \
        | grep -vE '(src|href)="(https?:)?//' \
        | grep -vE '\?v=[0-9]{4}-[0-9]{2}-[0-9]{2}"' || true)
  if [ -n "$bad" ]; then
    printf '        %s\n' "$page"
    printf '          %s\n' "$bad"
    stale=$((stale + 1))
  fi
done
if [ "$stale" = 0 ]; then
  ok "every local script and stylesheet carries a ?v= query string"
else
  fail "$stale page(s) have local assets with no cache-busting query string"
fi

# ── 6. secrets ──────────────────────────────────────────────────────────────
echo
echo "secrets"
# Prose about the service_role key is fine and is exactly what app/README.md
# contains; a service_role key shipped in something a browser loads is not.
leaked=$(git ls-files -z '*.js' '*.html' '*.json' '*.yml' | grep -zv '^app/' \
         | xargs -0 grep -lI 'service_role' 2>/dev/null || true)
if [ -n "$leaked" ]; then
  printf '        %s\n' "$leaked"
  fail "a service_role key is referenced in a file the browser loads"
else
  ok "no service_role key in the shipped site"
fi

# ── 7. the Supabase project values ──────────────────────────────────────────
# Expected to warn until someone fills in assets/supabase-config.js for their
# project. These are public values (the anon key is meant to ship to browsers),
# they are just not this repository's to guess.
echo
echo "supabase project"
if grep -q 'YOUR-PROJECT-REF' assets/supabase-config.js; then
  warn "assets/supabase-config.js still has the placeholder project URL"
else
  ok "the Supabase project URL is filled in"
fi
if grep -q 'YOUR-SUPABASE-ANON-KEY' assets/supabase-config.js; then
  warn "assets/supabase-config.js still has the placeholder anon key"
else
  ok "the Supabase anon key is filled in"
fi

# ── result ──────────────────────────────────────────────────────────────────
echo
if [ "$fails" -gt 0 ]; then
  echo "  $fails guard(s) failed, $warns warning(s)"
  exit 1
fi
echo "  all guards ok, $warns warning(s)"
