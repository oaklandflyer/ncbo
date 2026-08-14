/**
 * iCalendar (RFC 5545) generation.
 *
 * Hand-rolled rather than pulled from a service, because "download this event"
 * should not mean "tell a third party which events a student is interested in".
 * Files are produced at build time and served statically.
 *
 * The fiddly parts of RFC 5545, all of which break calendar imports if skipped:
 *   - CRLF line endings, always
 *   - lines folded at 75 octets, continuations starting with a single space
 *   - backslash, semicolon, comma and newline escaped in text values
 *   - UTC timestamps in the basic format, e.g. 20261004T220000Z
 */

export interface IcsEvent {
  /** Globally unique and stable across rebuilds, so re-importing updates rather than duplicates. */
  uid: string;
  title: string;
  description: string;
  location: string;
  /** ISO 8601 with offset. */
  start: string;
  end: string;
  url?: string | undefined;
}

/** RFC 5545 §3.3.5 — the basic UTC form. */
export function toIcsDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date for ICS output: ${iso}`);
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** RFC 5545 §3.3.11 — escape the four characters that are special in TEXT values. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 — fold at 75 octets, not 75 characters. A naive character-based
 * fold corrupts multi-byte UTF-8 when a fold lands mid-sequence, so this measures
 * in bytes and never splits a code point.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = char;
      currentBytes = charBytes;
      // Continuation lines carry a leading space, which counts toward the octet limit.
      limit = 74;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

function line(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

export interface CalendarOptions {
  /** Calendar display name, e.g. "NCBO Events". */
  name: string;
  /** Domain used to build UIDs, e.g. thencbo.org. */
  domain: string;
  /** Fixed timestamp for DTSTAMP so builds are reproducible. */
  stamp?: string;
}

export function buildCalendar(events: readonly IcsEvent[], options: CalendarOptions): string {
  const stamp = toIcsDate(options.stamp ?? '1970-01-01T00:00:00Z');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//NCBO//Member Hub//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    line('X-WR-CALNAME', escapeIcsText(options.name)),
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(line('UID', `${event.uid}@${options.domain}`));
    lines.push(line('DTSTAMP', stamp));
    lines.push(line('DTSTART', toIcsDate(event.start)));
    lines.push(line('DTEND', toIcsDate(event.end)));
    lines.push(line('SUMMARY', escapeIcsText(event.title)));
    lines.push(line('DESCRIPTION', escapeIcsText(event.description)));
    lines.push(line('LOCATION', escapeIcsText(event.location)));
    if (event.url) lines.push(line('URL', event.url));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  // RFC 5545 §3.1: lines are terminated by CRLF, including the last one.
  return `${lines.join('\r\n')}\r\n`;
}
