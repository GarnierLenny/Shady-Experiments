import { ImageResponse } from 'next/og';
import { OG_SIZE, C, OG_BACKGROUND, loadOgFonts, Star } from '@/lib/og';

// Link preview for a /r/<id> result permalink, rendered from query params so it
// needs no data fetch of its own. This is what makes a shared result unfurl into
// a bragging card - the closing move of the viral loop.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const winner = (searchParams.get('w') || '').slice(0, 24);
  const loser = (searchParams.get('l') || '').slice(0, 24);
  const ms = searchParams.get('ms');
  const reason = searchParams.get('reason') || 'draw';
  const tie = searchParams.get('tie') === '1';
  const fonts = await loadOgFonts();

  const headline = tie ? 'NO BLOOD SPILLED' : (winner || 'THE STREET').toUpperCase();
  const subline = tie
    ? 'TWO GUNS · NEITHER CLEARED LEATHER'
    : reason === 'false_start'
      ? loser
        ? `${loser.toUpperCase()} JUMPED THE GUN`
        : 'JUMPED THE GUN'
      : reason === 'opponent_left'
        ? loser
          ? `${loser.toUpperCase()} FLED TOWN`
          : 'OUTLAW FLED TOWN'
        : loser
          ? `OUT-DREW ${loser.toUpperCase()}`
          : 'FASTEST GUN IN THE WEST';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: OG_BACKGROUND,
          color: C.bone,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, background: '#000' }}
        />
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 54, background: '#000' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Star size={42} />
          <div
            style={{
              display: 'flex',
              fontFamily: 'Oswald',
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 8,
              color: C.ember,
            }}
          >
            STANDOFF DUEL
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 1080,
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: tie ? 'Oswald' : 'Rye',
            fontWeight: 700,
            fontSize: tie ? 84 : 96,
            color: C.ember,
            marginTop: 22,
            lineHeight: 1.02,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: 'flex',
            fontFamily: 'Oswald',
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 5,
            color: C.sand,
            marginTop: 10,
          }}
        >
          {subline}
        </div>

        {ms && !tie ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 30,
              border: `3px solid ${C.gold}`,
              borderRadius: 6,
              padding: '10px 26px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'Oswald',
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 4,
                color: C.sand,
              }}
            >
              DREW IN
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Oswald',
                fontWeight: 700,
                fontSize: 38,
                letterSpacing: 4,
                color: C.gold,
              }}
            >
              {ms} MS
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            fontFamily: 'Rye',
            fontSize: 28,
            color: C.gold,
            marginTop: ms && !tie ? 34 : 44,
          }}
        >
          Think you&apos;re faster?
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
