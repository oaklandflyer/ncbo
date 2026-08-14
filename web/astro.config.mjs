// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Static output. Every public page is prerendered to HTML at build time, so the
 * public floor is indexable and needs no server, no database and no third-party
 * service at runtime.
 *
 * `site` is the production origin, used for canonical URLs, OG tags and the
 * generated .ics files. `base` is deliberately left at '/' — see docs/DEFERRED.md
 * for the two deployment options (Pages workflow at the root, or a /hub/ subpath);
 * switching to the subpath is a one-line change here.
 */
export default defineConfig({
  site: 'https://thencbo.org',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
