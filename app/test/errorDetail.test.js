import test from 'node:test';
import assert from 'node:assert/strict';
import { describeError, isForeignKeyViolation } from '../src/lib/errorDetail.js';

/*
 * This runs on the failure path of the one irreversible operation in the app,
 * so the requirement is that it never throws and never returns nothing. An
 * empty diagnostic is what "it does not work" looked like from the outside.
 */

test('it keeps the fields that actually identify the failure', () => {
  /* `message` alone says a foreign key was violated. `details` says WHICH
     table, which is the only part that tells you what to fix. */
  const fk = {
    message: 'update or delete on table "users" violates foreign key constraint',
    code: '23503',
    details: 'Key is still referenced from table "objects".',
    hint: null,
  };
  const out = describeError(fk);
  assert.match(out, /violates foreign key/);
  assert.match(out, /23503/);
  assert.match(out, /table "objects"/);
});

test('a hint is carried through when there is one', () => {
  assert.match(describeError({ message: 'nope', hint: 'try the other thing' }), /hint: try the other thing/);
});

test('a plain string is passed through', () => {
  assert.equal(describeError('something went wrong'), 'something went wrong');
});

test('it never returns an empty string, whatever it is handed', () => {
  for (const input of [null, undefined, {}, [], 0, false, new Error()]) {
    const out = describeError(input);
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0, `empty for ${JSON.stringify(input)}`);
  }
});

test('it does not throw on a circular object', () => {
  /* Supabase errors are plain, but a wrapped fetch failure need not be, and a
     diagnostic that throws on the failure path leaves nothing at all. */
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => describeError(circular));
});

test('a real Error keeps its message', () => {
  assert.match(describeError(new Error('boom')), /boom/);
});

test('a foreign key violation is told apart from everything else', () => {
  /* The distinction that matters: one needs a migration, the other a retry. */
  assert.equal(isForeignKeyViolation({ code: '23503' }), true);
  assert.equal(isForeignKeyViolation({ message: 'violates foreign key constraint' }), true);
  assert.equal(isForeignKeyViolation({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isForeignKeyViolation({ message: 'Database error deleting user' }), false);
  assert.equal(isForeignKeyViolation(null), false);
  assert.equal(isForeignKeyViolation(undefined), false);
});
