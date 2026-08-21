import AppShell from '@/app/shell/app-shell';

/**
 * The hub renders inside the same shell as everything else.
 *
 * It used to carry its own gate, its own top bar and its own tab bar, which is
 * how the two navigation surfaces came to disagree about who could see the
 * review queue. There is one shell now, and one `navModel` behind it.
 */
export default async function HubLayout({ children, ...rest }) {
  return <AppShell searchParams={rest.searchParams}>{children}</AppShell>;
}
