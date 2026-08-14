import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeIcsText, foldLine, toIcsDate, type IcsEvent } from './ics.js';

const event: IcsEvent = {
  uid: 'sample-event',
  title: 'Posing Practice',
  description: 'Open to all members.',
  location: 'Campus Rec Studio B',
  start: '2026-10-04T18:00:00-04:00',
  end: '2026-10-04T20:00:00-04:00',
  url: 'https://thencbo.org/events/sample-event',
};

describe('toIcsDate', () => {
  it('converts an offset timestamp to basic-format UTC', () => {
    expect(toIcsDate('2026-10-04T18:00:00-04:00')).toBe('20261004T220000Z');
  });

  it('throws on an unparseable date rather than emitting a broken calendar', () => {
    expect(() => toIcsDate('not a date')).toThrow();
  });
});

describe('escapeIcsText', () => {
  it('escapes the four special characters', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes backslashes before the characters it introduces', () => {
    // Order matters: escaping the comma first would leave \\, double-escaped.
    expect(escapeIcsText('\\,')).toBe('\\\\\\,');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds long lines with a leading space on continuations', () => {
    const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.length).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true);
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  it('measures octets, not characters, and never splits a multi-byte character', () => {
    const folded = foldLine(`SUMMARY:${'é'.repeat(80)}`);
    for (const part of folded.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    // Round-tripping the unfold must give the original text back intact.
    expect(folded.split('\r\n ').join('')).toBe(`SUMMARY:${'é'.repeat(80)}`);
  });
});

describe('buildCalendar', () => {
  const ics = buildCalendar([event], { name: 'NCBO Events', domain: 'thencbo.org' });

  it('emits a well-formed VCALENDAR wrapper', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//NCBO//Member Hub//EN');
  });

  it('uses CRLF everywhere, with no bare newlines', () => {
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('carries the event fields', () => {
    expect(ics).toContain('UID:sample-event@thencbo.org');
    expect(ics).toContain('DTSTART:20261004T220000Z');
    expect(ics).toContain('DTEND:20261005T000000Z');
    expect(ics).toContain('SUMMARY:Posing Practice');
    expect(ics).toContain('LOCATION:Campus Rec Studio B');
  });

  it('is byte-identical across builds, so the file does not churn in git', () => {
    const again = buildCalendar([event], { name: 'NCBO Events', domain: 'thencbo.org' });
    expect(again).toBe(ics);
    expect(ics).toContain('DTSTAMP:19700101T000000Z');
  });

  it('produces a valid empty calendar when there are no events', () => {
    const empty = buildCalendar([], { name: 'NCBO Events', domain: 'thencbo.org' });
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('BEGIN:VEVENT');
  });

  it('has matching BEGIN and END markers for every event', () => {
    const many = buildCalendar([event, { ...event, uid: 'second' }], {
      name: 'NCBO Events',
      domain: 'thencbo.org',
    });
    expect(many.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(many.match(/END:VEVENT/g)).toHaveLength(2);
  });
});
