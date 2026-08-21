import Link from 'next/link';
import { Seal, Wordmark } from '@/app/brand/marks';
import SignOut from '@/app/hub/sign-out';
import Avatar from '@/app/brand/avatar';

/**
 * The fixed bar across the top of every signed-in page.
 *
 * The shell has reserved 60px for this since the layouts were unified, and
 * for a while nothing rendered into it: the old `hub/nav.js` carried the
 * wordmark, the shell replaced it with a sidebar and a tab bar, and the band
 * was left empty. This is what belongs in it.
 *
 * Navigation is deliberately absent. The sidebar and the tab bar are the
 * navigation, both driven by `navModel`, and a third list of links here is
 * how those two came to disagree in the first place. This bar is identity:
 * whose app this is, which chapter you are in, and the way out.
 */
export default function TopBar({ institution = null, name = '' }) {
  return (
    <header className="fixed inset-x-0 top-0 z-[200] h-[60px] border-b border-edge bg-white/90 shadow-brand-sm backdrop-blur-[12px]">
      <div className="flex h-full items-center gap-4 px-5 sm:px-8 lg:px-6">
        {/* The seal below `lg`, the full lockup above it. The wordmark stacks
            "NCBO" over two subtitle lines, and below roughly 44px of total
            height those lines stop being legible: shrinking it to fit a phone
            would ship an illegible tagline rather than a smaller logo. The
            seal is the mark that survives being small.

            min-h-[44px] because this is a tap target, and 36px of seal is
            under the size a fingertip actually is. */}
        <Link
          href="/hub"
          aria-label="NCBO home"
          className="flex min-h-[44px] shrink-0 items-center lg:w-[248px] lg:pl-1"
        >
          <Seal alt="" className="h-9 w-9 lg:hidden" />
          <Wordmark alt="" className="hidden h-10 w-auto lg:block" />
        </Link>

        {institution && (
          <span className="hidden min-w-0 truncate font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta md:block">
            {institution}
          </span>
        )}

        <div className="ml-auto hidden shrink-0 md:block">
          <SignOut />
        </div>

        {/* Down here the tab bar is the navigation, so this end of the bar is
            the way through to your own profile. Initials, not a photo: there
            is no avatar in the schema, and a generic silhouette says less
            than somebody's own initials do. */}
        <Link href="/hub/profile" aria-label="Your profile" className="ml-auto md:hidden">
          <Avatar name={name} size="xs" tone="wash" />
        </Link>
      </div>
    </header>
  );
}
