/**
 * Everything a Supabase or Postgres error knows, in one line.
 *
 * Its own module because it is the difference between a bug report that says
 * "it does not work" and one that says which constraint refused. `message`
 * alone is frequently the least useful field: a foreign key still set to
 * RESTRICT reports `update or delete on table "users" violates foreign key
 * constraint`, and the name of the table actually blocking it is in
 * `details`. Dropping that is how an afternoon goes.
 *
 * Never throws, whatever it is handed, because it runs on the failure path
 * and a diagnostic that fails is worse than none.
 */
export function describeError(err) {
  if (err == null) return 'no error given, which is itself a bug';
  if (typeof err === 'string') return err;

  const parts = [];
  const message = err.message || err.error_description || err.error;
  parts.push(message ? String(message) : safeStringify(err));
  if (err.code) parts.push(`code ${err.code}`);
  if (err.details) parts.push(String(err.details));
  if (err.hint) parts.push(`hint: ${err.hint}`);

  return parts.filter(Boolean).join(' · ');
}

/**
 * Is this the database refusing because something still points at the row?
 *
 * Worth naming on its own, because it is the one failure in a hard delete that
 * a migration fixes and a retry never will. Telling those apart is the whole
 * difference between "try again" and "stop and write a migration".
 */
export function isForeignKeyViolation(err) {
  if (!err) return false;
  return err.code === '23503' || /foreign key/i.test(String(err.message || ''));
}

function safeStringify(value) {
  try {
    const json = JSON.stringify(value);
    return json && json !== '{}' ? json : 'an error with no message';
  } catch {
    return 'an error that could not be described';
  }
}
