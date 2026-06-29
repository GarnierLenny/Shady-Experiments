'use client';

// Route-segment error boundary for Whispering Hacker. A render/effect throw here
// is caught and shown as a recoverable panel instead of white-screening the whole
// app via the global error page. `reset()` re-renders the segment WITHOUT a full
// page reload, so the socket reconnects and (with a durable sessionId) resumes the
// run instead of voiding it.
import { useEffect } from 'react';
import Link from 'next/link';

export default function WhisperingHackerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('whispering-hacker route error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        fontFamily: 'monospace',
        color: '#e9ba4c',
        background: '#0a0b0c',
      }}
    >
      <p style={{ letterSpacing: '.3em', fontSize: 12, opacity: 0.6 }}>// WHISPERING HACKER</p>
      <h1 style={{ fontSize: 28, letterSpacing: '.04em', margin: 0 }}>SIGNAL DISRUPTED</h1>
      <p style={{ color: '#9a9a98', maxWidth: 440, lineHeight: 1.6 }}>
        Something glitched in the terminal. Your room is still alive — reconnect
        without leaving.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{
            padding: '12px 22px',
            background: '#e9ba4c',
            color: '#0a0b0c',
            border: 'none',
            borderRadius: 4,
            fontFamily: 'monospace',
            letterSpacing: '.1em',
            cursor: 'pointer',
          }}
        >
          RECONNECT
        </button>
        <Link
          href="/whispering-hacker"
          style={{
            padding: '12px 22px',
            border: '1px solid #2a2a2a',
            borderRadius: 4,
            color: '#e9ba4c',
            textDecoration: 'none',
            letterSpacing: '.1em',
          }}
        >
          NEW ROOM
        </Link>
      </div>
    </div>
  );
}
