'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { generateRoomId } from '@shadyexperiments/shared';

// Browser-only (mic, WebRTC, Web Audio, socket.io) — keep it out of the server bundle.
const VoiceLab = dynamic(() => import('@/components/whisper/VoiceLab').then((m) => m.VoiceLab), {
  ssr: false,
  loading: () => <Booting />,
});

function Booting() {
  return (
    <div className="center-stage"><span className="faint">booting voice lab…</span></div>
  );
}

export default function VoiceDebugPage() {
  const [room, setRoom] = useState<string | null>(null);
  const [name, setName] = useState('');

  // Read the room from ?room=… (generate + pin one if absent) and a display name,
  // on the client, so both tabs/devices land in the same room.
  useEffect(() => {
    const url = new URL(window.location.href);
    let r = url.searchParams.get('room');
    if (!r) {
      r = generateRoomId();
      url.searchParams.set('room', r);
      window.history.replaceState({}, '', url.toString());
    }
    setRoom(r);
    setName(localStorage.getItem('wh_name') || `Tester-${Math.floor(10 + Math.random() * 90)}`);
  }, []);

  if (!room) return <Booting />;
  return <VoiceLab room={room} name={name} />;
}
