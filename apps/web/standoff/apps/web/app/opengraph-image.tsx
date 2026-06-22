import { ImageResponse } from 'next/og';
import { OG_SIZE, C, OG_BACKGROUND, loadOgFonts, Star } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'StandoffDuel - the webcam western duel';

// The link preview card. Without this, pasting standoffduel anywhere renders a
// naked link - the single highest-leverage fix for a "built to be shared" app.
export default async function Image() {
  const fonts = await loadOgFonts();
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
        {/* Cinematic letterbox bars */}
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, background: '#000' }}
        />
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: '#000' }}
        />

        <Star size={104} />
        <div
          style={{
            display: 'flex',
            fontFamily: 'Rye',
            fontSize: 112,
            color: C.ember,
            marginTop: 6,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Standoff Duel
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>
          <div style={{ width: 64, height: 2, background: C.dust }} />
          <div
            style={{
              display: 'flex',
              fontFamily: 'Oswald',
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: 8,
              color: C.sand,
            }}
          >
            TWO WEBCAMS · ONE DRAW
          </div>
          <div style={{ width: 64, height: 2, background: C.dust }} />
        </div>

        <div
          style={{
            display: 'flex',
            fontFamily: 'Oswald',
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 4,
            color: C.gold,
            marginTop: 44,
          }}
        >
          BE THE FASTEST GUN ON THE INTERNET
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
