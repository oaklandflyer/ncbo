import AppShell from '@/app/shell/app-shell';

/**
 * Every signed-in route outside /hub renders inside the one shell.
 *
 * A route group rather than a path segment, so `/log` stays `/log` and the
 * URLs the spec asks for are the URLs members get.
 */
export default async function ShellLayout({ children, ...rest }) {
  return <AppShell searchParams={rest.searchParams}>{children}</AppShell>;
}
