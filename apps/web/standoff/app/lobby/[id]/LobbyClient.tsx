'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// The duel room is browser-only (webcam, WebRTC, MediaPipe, socket.io). Loading
// it without SSR keeps those Node-hostile modules out of the server bundle.
const LobbyRoom = dynamic(
  () => import('@/components/LobbyRoom').then((m) => m.LobbyRoom),
  {
    ssr: false,
    loading: () => <SaddlingUp />,
  },
);

function SaddlingUp() {
  return (
    <main className="flex min-h-screen items-center justify-center text-sand/60">
      Saddling up…
    </main>
  );
}

export function LobbyClient({
  lobbyId,
  bestOf,
}: {
  lobbyId: string;
  bestOf?: number;
}) {
  // Read the player's name on the client to avoid a hydration mismatch, and to
  // make sure the socket joins with the right name on the first try.
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    setName(localStorage.getItem('sd_name') || 'Stranger');
  }, []);

  if (!name) return <SaddlingUp />;

  return <LobbyRoom lobbyId={lobbyId} name={name} bestOf={bestOf} />;
}
