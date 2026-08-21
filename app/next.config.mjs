/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      /* `/club/calendar` shipped, and leads have it bookmarked and pasted into
         group chats. The page it named is now one section of a wider settings
         screen, so this is a rename rather than a removal: permanent, and with
         the query string carried through, because the admin switcher links
         here as `?club=<id>` and dropping that would land an admin on somebody
         else's chapter. */
      { source: '/club/calendar', destination: '/club/settings', permanent: true },
    ];
  },
};

export default nextConfig;
