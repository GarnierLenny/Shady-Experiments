'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// The room is browser-only (mic, WebRTC, Web Audio, socket.io). Loading it
// without SSR keeps those Node-hostile modules out of the server bundle.
const WhisperRoom = dynamic(
  () => import('@/components/whisper/WhisperRoom').then((m) => m.WhisperRoom),
  {
    ssr: false,
    loading: () => <Booting />,
  },
);

function Booting() {
  return (
    <main className="relative z-10 flex min-h-[100dvh] items-center justify-center text-phosphor/50">
      booting terminal…
    </main>
  );
}

export function RoomClient({ roomId }: { roomId: string }) {
  // Read the handle on the client to avoid a hydration mismatch and to join
  // with the right name on the first try.
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    setName(localStorage.getItem('wh_name') || 'Anonymous');
  }, []);

  if (!name) return <Booting />;

  return <WhisperRoom roomId={roomId} name={name} />;
}
