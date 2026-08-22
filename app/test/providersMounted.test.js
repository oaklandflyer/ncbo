import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * React context providers, and whether anything actually mounts them.
 *
 * This exists because `ProfilePopupProvider` was mounted nowhere. Every
 * `UserChip` in the app — the directory, the roster, both leaderboards, the
 * Q&A board, the admin table, the hub — rendered as an underlined button that
 * did nothing when tapped, because `useProfilePopup()` fell back to a no-op.
 *
 * No unit test could see it: the provider was correct, the consumer was
 * correct, and the fault was that the two were never connected. The only
 * evidence is in the source, so that is what this reads.
 */

const SRC = new URL('../src', import.meta.url).pathname;

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).map((f) => [f, readFileSync(f, 'utf8')]);

test('every exported Provider is rendered somewhere', () => {
  const declared = new Map();
  for (const [file, source] of files) {
    for (const match of source.matchAll(/export function (\w*Provider)\b/g)) {
      declared.set(match[1], file);
    }
  }
  assert.ok(declared.size > 0, 'no providers found; has the pattern changed?');

  const unmounted = [];
  for (const [name, declaredIn] of declared) {
    const mounted = files.some(([file, source]) => (
      file !== declaredIn && new RegExp(`<${name}[\\s>]`).test(source)
    ));
    if (!mounted) unmounted.push(`${name} (declared in ${declaredIn.replace(SRC, 'src')})`);
  }

  assert.deepEqual(unmounted, [], `providers nothing mounts:\n${unmounted.join('\n')}`);
});

test('the profile popup provider is mounted in the one shell every route uses', () => {
  /* Specifically the shell, not "somewhere". Mounted per page it would be
     seven places to remember and seven chances to forget one; the shell is
     rendered by both /hub and the (shell) group, so it is the only mount that
     covers every chip. */
  const shell = readFileSync(new URL('../src/app/shell/app-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /<ProfilePopupProvider>/, 'the shell must mount the popup provider');
  assert.match(shell, /<\/ProfilePopupProvider>/, 'and must close it around the children');
});

test('UserChip renders plain text when there is no provider', () => {
  /* The guard that turns this failure from a dead button into a missing one.
     If the fallback ever goes back to a no-op function, a future unmounting
     is silent again. */
  const popup = readFileSync(new URL('../src/app/hub/profile-popup/popup.js', import.meta.url), 'utf8');
  assert.match(popup, /if \(!userId \|\| !open\)/, 'UserChip must fall back to text without a provider');
  assert.doesNotMatch(
    popup,
    /return open \|\| \(\(\) => \{\}\)/,
    'useProfilePopup must not return a no-op: that is what hid the bug',
  );
});
