/**
 * Where the app's images come from.
 *
 * `site_settings` holds a path in the public `brand_assets` bucket, or null.
 * Null means nobody has uploaded anything, and the built-in file in /public is
 * used — so the app renders correctly before the CMS has ever been opened,
 * and keeps rendering if the bucket is unreachable.
 */
const FALLBACK = { logo: '/brand/ncbo-seal.svg', hero: null };

export function publicBase() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand_assets`;
}

export function brandUrls(settings) {
  const base = publicBase();
  return {
    logo: settings?.logo_path ? `${base}/${settings.logo_path}` : FALLBACK.logo,
    hero: settings?.hero_path ? `${base}/${settings.hero_path}` : FALLBACK.hero,
  };
}

/** Read once, server-side. Never throws — branding is not worth a 500. */
export async function getBranding(supabase) {
  try {
    const { data } = await supabase
      .from('site_settings').select('logo_path, hero_path').eq('id', true).single();
    return brandUrls(data);
  } catch {
    return brandUrls(null);
  }
}
