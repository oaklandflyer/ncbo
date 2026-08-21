import Link from 'next/link';
import { Wordmark } from '@/app/brand/marks';
import SignOut from '@/app/hub/sign-out';

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
export default function TopBar({ institution = null, initials = 'M' }) {
  return (
    <header className="fixed inset-x-0 top-0 z-[200] h-[60px] border-b border-edge bg-white/90 shadow-brand-sm backdrop-blur-[12px]">
      <div className="flex h-full items-center gap-4 px-5 sm:px-8 lg:px-6">
        {/* 44px of tap target around a 30px mark: this is a link, and the
            wordmark alone is under the size a fingertip actually is. */}
        <Link
          href="/hub"
          className="flex min-h-[44px] shrink-0 items-center lg:w-[248px] lg:pl-1"
        >
          <Wordmark height={30} />
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
        <Link
          href="/hub/profile"
          aria-label="Your profile"
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-wash font-display text-[0.8rem] font-bold tracking-[0.04em] text-brand md:hidden"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
