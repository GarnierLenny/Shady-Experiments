import { ImageResponse } from 'next/og';

// Link preview for a run permalink, rendered from query params so it needs no
// data fetch. Terminal-green card — the closing move of the share loop. Fonts
// are best-effort: if Google is unreachable the card renders in satori's default.

const SIZE = { width: 1200, height: 630 } as const;

let fontPromise: Promise<ArrayBuffer | null> | null = null;
async function shareTechMono(): Promise<ArrayBuffer | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const css = await (
          await fetch('https://fonts.googleapis.com/css2?family=Share+Tech+Mono', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(2500),
          })
        ).text();
        const url = css.match(
          /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
        )?.[1];
        if (!url) return null;
        return await (
          await fetch(url, { signal: AbortSignal.timeout(2500) })
        ).arrayBuffer();
      } catch {
        return null;
      }
    })();
  }
  return fontPromise;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const time = (searchParams.get('t') || '00:00').slice(0, 8);
  const puzzles = (searchParams.get('n') || '').slice(0, 3);
  const hacker = (searchParams.get('h') || '').slice(0, 24);
  const operator = (searchParams.get('o') || '').slice(0, 24);

  const crew =
    hacker && operator
      ? `${hacker.toUpperCase()} & ${operator.toUpperCase()}`
      : 'TWO OPERATIVES';

  const fontData = await shareTechMono();
  const fontFamily = fontData ? 'Share Tech Mono' : 'monospace';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(120% 90% at 50% -10%, #0c1a10 0%, #060a07 60%, #020403 100%)',
          color: '#3bf67a',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          position: 'relative',
        }}
      >
        {/* scanline hint bars */}
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: '#000' }}
        />
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: '#000' }}
        />

        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 10, color: '#1c8f43' }}>
          ▚ WHISPERING HACKER
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 116,
            letterSpacing: 6,
            color: '#3bf67a',
            marginTop: 18,
          }}
        >
          ACCESS GRANTED
        </div>

        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: '#b9ffd0', marginTop: 10 }}>
          {crew} BREACHED THE NODE
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 34,
            border: '3px solid #1c8f43',
            padding: '12px 30px',
          }}
        >
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#b9ffd0' }}>
            TIME
          </div>
          <div style={{ display: 'flex', fontSize: 46, letterSpacing: 4, color: '#3bf67a' }}>
            {time}
          </div>
          {puzzles ? (
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#1c8f43' }}>
              · {puzzles} PUZZLES
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: '#f5a524', marginTop: 40 }}>
          THINK YOU CAN DO IT FASTER?
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: fontData
        ? [{ name: 'Share Tech Mono', data: fontData, weight: 400, style: 'normal' }]
        : [],
    },
  );
}
