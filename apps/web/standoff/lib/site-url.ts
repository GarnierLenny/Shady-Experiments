/**
 * Canonical public origin of the web app. Explicit env wins (custom domains);
 * otherwise fall back to Vercel's production URL, then localhost for dev. Used
 * for `metadataBase` so OG/Twitter image links resolve to absolute URLs.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // The zone is publicly served through the SE landing (root zone) on :3001.
  return 'http://localhost:3001';
}
