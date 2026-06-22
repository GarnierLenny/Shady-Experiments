import { ImageResponse } from 'next/og';
import { OG_SIZE, C, OG_BACKGROUND, loadOgFonts, Star } from '@/lib/og';

// Dynamic, personalized link preview for a shared lobby: "<name> challenges you
// to a duel" with the lobby code. This is what turns a pasted invite link into a
// click - the core of the viral loop.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get('code') || '').slice(0, 24).toUpperCase();
  const by = (searchParams.get('by') || '').slice(0, 24);
  const fonts = await loadOgFonts();

  const title = by ? `${by.toUpperCase()} CHALLENGES YOU` : "YOU'VE BEEN CHALLENGED";

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
            width: 1040,
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: 'Oswald',
            fontWeight: 700,
            fontSize: 66,
            letterSpacing: 1,
            color: C.bone,
            marginTop: 28,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Oswald',
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 6,
            color: C.sand,
            marginTop: 6,
          }}
        >
          TO A WEBCAM DUEL
        </div>

        {code ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 34,
              border: `3px solid ${C.gold}`,
              borderRadius: 6,
              padding: '12px 28px',
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
              LOBBY
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Oswald',
                fontWeight: 700,
                fontSize: 36,
                letterSpacing: 6,
                color: C.gold,
              }}
            >
              {code}
            </div>
          </div>
        ) : null}

        <div
          style={{ display: 'flex', fontFamily: 'Rye', fontSize: 30, color: C.ember, marginTop: 40 }}
        >
          Draw first — or get drawn on
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
