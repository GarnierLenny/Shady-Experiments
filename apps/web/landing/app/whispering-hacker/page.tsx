'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateRoomId,
  isValidRoomId,
  normalizeRoomId,
} from '@shadyexperiments/shared';
import { track } from '@/lib/track';

export default function WhisperingHackerEntry() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('wh_name');
    if (stored) setName(stored);
  }, []);

  const remember = (n: string) => {
    setName(n);
    localStorage.setItem('wh_name', n.trim().slice(0, 24));
  };

  const go = (id: string) => {
    if (name.trim()) localStorage.setItem('wh_name', name.trim().slice(0, 24));
    router.push(`/whispering-hacker/room/${id}`);
  };

  const create = () => {
    track('whisperinghacker', 'room_created');
    go(generateRoomId());
  };

  const join = () => {
    const id = normalizeRoomId(joinId);
    if (!isValidRoomId(id)) {
      setJoinErr('Try a code like CIPHER-07');
      return;
    }
    track('whisperinghacker', 'room_join_submitted');
    go(id);
  };

  return (
    <div className="device">
      <div className="top">
        <div className="brand">WHISPERING HACKER <em>EXP #002</em></div>
        <div className="spacer" />
        <span className="toppill accent">CO-OP · VOICE ONLY</span>
      </div>

      <div className="center-stage">
        <div className="lobby">
          <div style={{ textAlign: 'center' }}>
            <p className="faint" style={{ letterSpacing: '.4em', fontSize: 12 }}>
              // SHADYEXPERIMENTS · EXPERIMENT #002
            </p>
            <h1
              className="amber"
              style={{ fontSize: 'clamp(34px,6vw,54px)', letterSpacing: '.04em', margin: '12px 0 0', fontWeight: 700 }}
            >
              WHISPERING HACKER
            </h1>
            <p className="muted" style={{ marginTop: 14, lineHeight: 1.7, fontSize: 14, maxWidth: 460, marginInline: 'auto' }}>
              Two of you. One drives a hacker terminal with no answers; the other holds the
              manual but can&apos;t touch a thing. You can only talk by voice — and the line
              keeps getting worse. Bring a friend and a headset.
            </p>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <div className="lbl muted">Your handle</div>
            <input
              value={name}
              onChange={(e) => remember(e.target.value)}
              maxLength={24}
              placeholder="anonymous"
              className="mono-input"
              style={{ marginTop: 8 }}
            />
            <button className="btn submit" onClick={create} style={{ marginTop: 16 }}>
              OPEN A SECURE ROOM →
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0', color: 'var(--faint)', fontSize: 11, letterSpacing: '.24em' }}>
              <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
              OR JOIN A ROOM
              <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={joinId}
                onChange={(e) => {
                  setJoinId(e.target.value);
                  setJoinErr(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                placeholder="CIPHER-07"
                className="mono-input"
                style={{ textTransform: 'uppercase' }}
              />
              <button className="btn" onClick={join} style={{ padding: '0 22px', whiteSpace: 'nowrap' }}>
                JOIN
              </button>
            </div>
            {joinErr && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{joinErr}</p>}
          </div>

          <p className="faint" style={{ textAlign: 'center', marginTop: 22, fontSize: 11, letterSpacing: '.24em' }}>
            HEADPHONES RECOMMENDED · MIC REQUIRED · ~10 MIN
          </p>
        </div>
      </div>

      <div className="bot">
        <div className="wlogo">W</div>
        <div>PROTOCOL &nbsp; WHSP v1.0</div>
        <div className="spacer" />
        <div>CLEARANCE &nbsp; OPERATOR-PAIR</div>
      </div>
    </div>
  );
}
