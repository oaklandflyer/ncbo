/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /* Club logos live in a public Supabase bucket, so `next/image` has to be
       told the host is allowed before it will proxy one. Narrowed to the
       public object path: `/storage/v1/object/public/**` is served without a
       token by design, and nothing else on this host should be reachable
       through the optimiser.

       The project ref is the same value already in `supabase/config.toml` and
       in `NEXT_PUBLIC_SUPABASE_URL`. It is not a secret; it is in every API
       request the app makes. */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bjfxgwjnkfjrgrpqubab.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

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
