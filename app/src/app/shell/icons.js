/** Line icons on one 24-box, so their weights match across the two surfaces. */
export const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  calendar: 'M4 8h16M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M8 3v4M16 3v4',
  log: 'M12 5v14M5 12h14',
  rankings: 'M5 20V11m7 9V4m7 16v-6',
  network: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9M3.4 9.4h17.2M3.4 14.6h17.2',
  qa: 'M12 16.5v-2.2c1.9 0 3.2-1.1 3.2-2.8S13.9 8.7 12 8.7 8.8 9.8 8.8 11.5M12 19.4h.01',
  vault: 'M5 5.5h9.5l4.5 4.5v8.5H5v-13Zm0 4.7h14M9.5 5.5v4.7',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  roster: 'M4 6.5h16M4 12h16M4 17.5h16M8 4.5v15',
  /* A person and a plus: somebody asking to join, which is neither the roster
     they are not on yet nor the tick that verifies a result. */
  applications: 'M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20c.5-3 3-4.8 6.5-4.8M17.5 14.5v6M14.5 17.5h6',
  clubs: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2L14.6 3H9.4L9 5.7a7.4 7.4 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2 1.2l.4 2.7h5.2l.4-2.7a7.4 7.4 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z',
  profile: 'M12 12.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM4.8 20.2c.6-3.3 3.6-5.2 7.2-5.2s6.6 1.9 7.2 5.2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  /* The middle button. Same stroke as the rest so it does not read as a
     different icon set, only as a bigger one. */
  plus: 'M12 5v14M5 12h14',
};

export function NavIcon({ name, active = false, size = 22 }) {
  return (
    <svg
      aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.1 : 1.7}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d={ICONS[name] || ICONS.more} />
    </svg>
  );
}
