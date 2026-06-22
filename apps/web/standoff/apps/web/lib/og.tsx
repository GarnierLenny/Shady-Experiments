/**
 * Shared building blocks for the `next/og` (satori) image routes: the western
 * palette, the sheriff star, and lazily-fetched Google fonts. Fonts are fetched
 * once per server lifetime and degrade gracefully - if Google is unreachable the
 * card still renders with satori's default font instead of erroring.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Mirrors the spaghetti-western palette in globals.css. */
export const C = {
  night: '#0c0a09',
  charcoal: '#1c1917',
  dust: '#44403c',
  sand: '#e7d8b5',
  bone: '#f5efe1',
  ember: '#e8843c',
  gold: '#d8a13a',
  blood: '#7c1d12',
} as const;

/** Dark, faintly-lit saloon backdrop shared by both cards. */
export const OG_BACKGROUND =
  'radial-gradient(120% 90% at 50% -10%, #2a211a 0%, #14100c 55%, #0c0a09 100%)';

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

let fontsPromise: Promise<OgFont[]> | null = null;

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=${family.replace(
      / /g,
      '+',
    )}:wght@${weight}`;
    // A plain UA (no woff2 hint) makes Google serve a ttf satori can parse.
    // Bound both hops so a slow CDN never stalls the OG response.
    const css = await (
      await fetch(api, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(2500),
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (
      await fetch(url, { signal: AbortSignal.timeout(2500) })
    ).arrayBuffer();
  } catch {
    return null;
  }
}

/** Oswald 700 (impact headlines) + Rye 400 (display wordmark), best-effort. */
export function loadOgFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const specs: { name: string; weight: 400 | 700 }[] = [
        { name: 'Oswald', weight: 700 },
        { name: 'Rye', weight: 400 },
      ];
      const results = await Promise.allSettled(
        specs.map((s) => fetchFont(s.name, s.weight)),
      );
      const fonts: OgFont[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          fonts.push({
            name: specs[i].name,
            data: r.value,
            weight: specs[i].weight,
            style: 'normal',
          });
        }
      });
      return fonts;
    })();
  }
  return fontsPromise;
}

/** Sheriff star, matching the on-screen / share-card SVG. */
export function Star({ size = 88, color = C.gold }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polygon
        points="50,4 60.6,35.4 93.8,35.8 67.1,55.6 77,87.2 50,68 23,87.2 32.9,55.6 6.2,35.8 39.4,35.4"
        fill={color}
      />
    </svg>
  );
}
