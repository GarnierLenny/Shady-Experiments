'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useDuel } from '@/hooks/useDuel';
import { useWebcam } from '@/hooks/useWebcam';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useHolster, HolsterState, HandMarker } from '@/hooks/useHolster';
import { useFaceFocus } from '@/hooks/useFaceFocus';
import { useDuelAudio } from '@/hooks/useDuelAudio';
import { useDuelClip } from '@/hooks/useDuelClip';
import { useOrientation } from '@/hooks/useOrientation';
import { loadPoseLandmarker, loadHandLandmarker } from '@/lib/mediapipe';
import { DuelStage } from '@/components/DuelStage';
import { ResultScreen } from '@/components/ResultScreen';
import { Button } from '@/components/ui/Button';

// Thud lands just as the frame starts to topple (DuelStage freezes ~1500ms).
const SHOWDOWN_FREEZE_AUDIO_MS = 1450;

/** Snapshot a video frame as a JPEG data URL (mirrored to match the display). */
function grabStill(video: HTMLVideoElement | null, mirror: boolean): string | null {
  if (!video || !video.videoWidth) return null;
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  try {
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

/** A face-framed 4:5 portrait, cropped around the eyes - for the posters. */
function grabPortrait(
  video: HTMLVideoElement | null,
  focus: { x: number; y: number; scale: number; found: boolean },
  mirror: boolean,
): string | null {
  if (!video || !video.videoWidth) return null;
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  // Size the crop from the face (eye separation) → a tight face+bust shot that
  // adapts to distance, instead of grabbing the whole body.
  const eyeDist = focus.found && focus.scale > 0.01 ? focus.scale : 0.08;
  let cropW = eyeDist * 6 * vW;
  let cropH = cropW * 1.25;
  if (cropH > vH * 0.9) {
    cropH = vH * 0.9;
    cropW = cropH * 0.8;
  }
  if (cropW > vW) {
    cropW = vW;
    cropH = cropW * 1.25;
  }
  const fx = focus.found ? focus.x : 0.5;
  const fy = focus.found ? focus.y : 0.4;
  let sx = fx * vW - cropW / 2;
  let sy = fy * vH - cropH * 0.34; // eyes ~a third from the top
  sx = Math.max(0, Math.min(vW - cropW, sx));
  sy = Math.max(0, Math.min(vH - cropH, sy));
  const out = document.createElement('canvas');
  out.width = 480;
  out.height = 600;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, out.width, out.height);
  try {
    return out.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

export function LobbyRoom({
  lobbyId,
  name,
  bestOf,
}: {
  lobbyId: string;
  name: string;
  bestOf?: number;
}) {
  const duel = useDuel(lobbyId, name, bestOf);
  const { stream, error: camError } = useWebcam(true);
  const webrtc = useWebRTC(duel.socket, stream, duel.initiator);
  const audio = useDuelAudio();
  const vertical = useOrientation() === 'portrait';

  const [localEl, setLocalEl] = useState<HTMLVideoElement | null>(null);
  const [remoteEl, setRemoteEl] = useState<HTMLVideoElement | null>(null);
  const [stageCanvas, setStageCanvas] = useState<HTMLCanvasElement | null>(null);
  const onStageReady = useCallback((c: HTMLCanvasElement) => setStageCanvas(c), []);
  // Record the draw → showdown beat into a shareable clip (the TikTok asset).
  const clip = useDuelClip(stageCanvas, duel.phase);

  const [shake, setShake] = useState(false);
  const triggerShake = useCallback((ms = 450) => {
    setShake(false);
    requestAnimationFrame(() => {
      setShake(true);
      window.setTimeout(() => setShake(false), ms);
    });
  }, []);
  const [holster, setHolster] = useState<HolsterState>({
    holstered: false,
    pistol: false,
  });
  const [photos, setPhotos] = useState<{
    winner: string | null;
    loser: string | null;
  }>({ winner: null, loser: null });
  const capturedRef = useRef<{ local: string | null; remote: string | null }>({
    local: null,
    remote: null,
  });

  // Bind streams to the source <video> elements.
  useEffect(() => {
    if (localEl && stream) {
      localEl.srcObject = stream;
      localEl.muted = true;
      localEl.play().catch(() => {});
    }
  }, [localEl, stream]);

  useEffect(() => {
    if (remoteEl && webrtc.remoteStream) {
      remoteEl.srcObject = webrtc.remoteStream;
      remoteEl.play().catch(() => {});
    }
  }, [remoteEl, webrtc.remoteStream]);

  // Eye tracking during the push-in / pull-back...
  const inCinematic = duel.phase === 'zoom' || duel.phase === 'dezoom';
  const focusLocal = useFaceFocus(localEl, inCinematic, 'local');
  const focusRemote = useFaceFocus(remoteEl, inCinematic, 'remote');

  // ...and the holster watcher in the lobby + around the draw.
  const holsterActive =
    duel.phase === 'idle' || duel.phase === 'wait' || duel.phase === 'draw';

  // Flash the hand circles yellow the instant a draw is reported (any method).
  const drewRef = useRef(false);
  const onDraw = useCallback(() => {
    drewRef.current = true;
    duel.reportDraw();
  }, [duel]);

  const markerRef = useHolster({
    video: localEl,
    active: holsterActive,
    charging: duel.phase === 'idle',
    armed: duel.phase === 'draw',
    onHolsterChange: setHolster,
    onDraw,
  });

  // Reset the draw flash at the start of each round.
  useEffect(() => {
    if (duel.phase !== 'draw' && duel.phase !== 'result') drewRef.current = false;
  }, [duel.phase]);

  // Capture each duelist's portrait during the eye-lock (the best, intentional
  // shot), keep both, then assign winner/loser when the duel resolves.
  useEffect(() => {
    if (duel.phase !== 'dezoom') return;
    capturedRef.current = {
      local: grabPortrait(localEl, focusLocal.current, true),
      remote: grabPortrait(remoteEl, focusRemote.current, false),
    };
  }, [duel.phase, localEl, remoteEl, focusLocal, focusRemote]);

  useEffect(() => {
    if (duel.phase !== 'showdown') return;
    const local = capturedRef.current.local ?? grabStill(localEl, true);
    const remote = capturedRef.current.remote ?? grabStill(remoteEl, false);
    const iWon = duel.result?.winnerId === duel.selfId;
    setPhotos({ winner: iWon ? local : remote, loser: iWon ? remote : local });
  }, [duel.phase, duel.result, duel.selfId, localEl, remoteEl]);

  // Warm the vision models on mount so the first duel is responsive.
  useEffect(() => {
    void loadHandLandmarker();
    void loadPoseLandmarker('local');
    void loadPoseLandmarker('remote');
  }, []);

  const me = duel.players.find((p) => p.id === duel.selfId) ?? null;
  const opp = duel.players.find((p) => p.id !== duel.selfId) ?? null;
  const myWins = duel.selfId ? duel.scores[duel.selfId] ?? 0 : 0;
  const oppWins = opp ? duel.scores[opp.id] ?? 0 : 0;

  // Which half topples in the showdown beat (local is always the left half).
  const loserSide: 'left' | 'right' | null =
    duel.result && duel.result.winnerId !== null
      ? duel.result.loserId === duel.selfId
        ? 'left'
        : 'right'
      : null;

  // Unlock audio on the first user gesture (autoplay policies) since readying
  // now happens via a pose, not a click.
  useEffect(() => {
    if (!audio) return;
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audio]);

  // Hand on the hip => ready. Fires once per round (re-arms on rematch/reset).
  useEffect(() => {
    if (duel.phase === 'idle' && holster.holstered && me && !me.ready) {
      audio?.unlock();
      duel.ready();
    }
  }, [duel.phase, holster.holstered, me, audio, duel]);

  // Audio cues follow the phase.
  useEffect(() => {
    if (!audio) return;
    // Any phase other than the silent hold kills the heartbeat.
    audio.stopHeartbeat();
    let distractTimer: number | undefined;
    switch (duel.phase) {
      case 'zoom':
        audio.startTension();
        break;
      case 'dezoom':
      case 'idle':
        audio.stopTension();
        break;
      case 'wait':
        // Pull-back silence: a faint, quickening pulse ratchets the dread.
        audio.heartbeat();
        // ~60% of the time, one random western disturbance (crow, fly, coyote,
        // a hammer cocking) to rattle nerves - lands inside the >=3s hold.
        if (Math.random() < 0.6) {
          distractTimer = window.setTimeout(
            () => audio.distract(),
            700 + Math.random() * 2000,
          );
        }
        break;
      case 'draw':
        audio.gunshot();
        break;
      case 'showdown':
        audio.ambience();
        window.setTimeout(() => audio.thud(), SHOWDOWN_FREEZE_AUDIO_MS);
        break;
      case 'result':
        audio.stopTension();
        if (duel.result?.winnerId === duel.selfId) audio.victory();
        break;
    }
    // Cancel a pending disturbance if the draw fires (or we leave the room)
    // first, so a crow can't caw after the gunshot.
    return () => {
      if (distractTimer !== undefined) window.clearTimeout(distractTimer);
    };
  }, [duel.phase, audio, duel.result, duel.selfId]);

  // Recoil kick on the shot, and again as the body hits the dirt.
  useEffect(() => {
    if (duel.phase === 'draw') triggerShake(450);
    if (duel.phase === 'showdown') {
      const id = window.setTimeout(() => triggerShake(550), SHOWDOWN_FREEZE_AUDIO_MS);
      return () => window.clearTimeout(id);
    }
  }, [duel.phase, triggerShake]);

  // Space bar is a draw fallback while armed.
  useEffect(() => {
    if (duel.phase !== 'draw') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onDraw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duel.phase, onDraw]);

  const onManualReady = useCallback(() => {
    audio?.unlock();
    duel.ready();
  }, [audio, duel]);

  const onRematch = useCallback(() => {
    audio?.unlock();
    duel.rematch();
  }, [audio, duel]);

  const showStage = duel.phase !== 'idle';

  return (
    <main
      className={cn(
        'relative h-[100dvh] w-screen overflow-hidden bg-night',
        shake && 'animate-shake',
      )}
    >
      {/* Source webcams - also the live framing behind the lobby UI. */}
      <video
        ref={setLocalEl}
        autoPlay
        playsInline
        muted
        className={cn(
          'absolute object-cover',
          vertical ? 'left-0 top-0 h-1/2 w-full' : 'left-0 top-0 h-full w-1/2',
        )}
        style={{ transform: 'scaleX(-1)' }}
      />
      <video
        ref={setRemoteEl}
        autoPlay
        playsInline
        className={cn(
          'absolute bg-charcoal object-cover',
          vertical ? 'bottom-0 left-0 h-1/2 w-full' : 'right-0 top-0 h-full w-1/2',
        )}
      />
      <div
        className={cn(
          'absolute bg-black/60',
          vertical
            ? 'left-0 top-1/2 h-px w-full -translate-y-1/2'
            : 'left-1/2 top-0 h-full w-px -translate-x-1/2',
        )}
      />

      {/* Green "ready" frames in the lobby. */}
      {duel.phase === 'idle' && (
        <>
          <FrameRing
            side="left"
            ready={!!me?.ready}
            live={holster.holstered}
            vertical={vertical}
          />
          <FrameRing side="right" ready={!!opp?.ready} vertical={vertical} />
        </>
      )}

      {/* Cinematic canvas sits on top once the duel begins. */}
      {showStage && (
        <DuelStage
          localVideo={localEl}
          remoteVideo={remoteEl}
          remoteReady={!!webrtc.remoteStream}
          phase={duel.phase}
          start={duel.start}
          focusLocal={focusLocal}
          focusRemote={focusRemote}
          selfName={me?.name ?? name}
          oppName={opp?.name ?? 'Rival'}
          loserSide={loserSide}
          onReady={onStageReady}
          vertical={vertical}
        />
      )}

      {/* Hand-tracking circles: amber → green (on hip) → yellow (draw). */}
      {holsterActive && (
        <HandOverlay
          video={localEl}
          markerRef={markerRef}
          drewRef={drewRef}
          vertical={vertical}
        />
      )}

      {/* Camera blocked - hard stop. */}
      {camError && (
        <Overlay>
          <h2 className="font-display text-3xl text-bone">Camera blocked</h2>
          <p className="mt-3 text-sand/70">
            StandoffDuel needs your webcam. Allow access in your browser and
            reload.
          </p>
          <HomeLink />
        </Overlay>
      )}

      {/* Lobby rejected us. */}
      {!camError && duel.error && (
        <Overlay>
          <h2 className="font-display text-3xl text-bone">
            {duel.error.code === 'lobby_full'
              ? 'That lobby is full'
              : duel.error.code === 'in_progress'
                ? 'A duel is underway'
                : 'Something went sideways'}
          </h2>
          <p className="mt-3 text-sand/70">{duel.error.message}</p>
          <HomeLink />
        </Overlay>
      )}

      {/* P2P couldn't connect - don't strand them on a silent blank panel. */}
      {!camError &&
        !duel.error &&
        duel.phase === 'idle' &&
        duel.players.length === 2 &&
        webrtc.status === 'failed' && (
          <Overlay>
            <h2 className="font-display text-3xl text-bone">
              Can&apos;t reach your rival
            </h2>
            <p className="mt-3 max-w-sm text-sand/70">
              The connection couldn&apos;t punch through your networks. A quick
              reconnect usually clears it.
            </p>
            <button
              onClick={webrtc.retry}
              className="mt-6 rounded-sm border-2 border-ember px-6 py-2 font-impact uppercase tracking-widest text-ember transition-colors hover:bg-ember hover:text-night"
            >
              Reconnect
            </button>
            <HomeLink />
          </Overlay>
        )}

      {/* Connecting. */}
      {!camError && !duel.error && duel.status === 'connecting' && (
        <Overlay>
          <p className="font-impact uppercase tracking-[0.3em] text-sand/60">
            Riding into town…
          </p>
        </Overlay>
      )}

      {/* Lobby / waiting room. */}
      {!camError &&
        !duel.error &&
        duel.status !== 'connecting' &&
        duel.phase === 'idle' && (
          <LobbyOverlay
            lobbyId={lobbyId}
            selfName={me?.name ?? name}
            meReady={!!me?.ready}
            oppName={opp?.name ?? null}
            oppReady={!!opp?.ready}
            bothPresent={duel.players.length === 2}
            holstered={holster.holstered}
            pistol={holster.pistol}
            onManualReady={onManualReady}
            bestOf={duel.bestOf}
            myWins={myWins}
            oppWins={oppWins}
          />
        )}

      {/* Draw input - un-holster, or the whole screen is a tap target, or SPACE. */}
      {duel.phase === 'draw' && (
        <button
          onClick={onDraw}
          aria-label="Draw"
          className="absolute inset-0 z-20 flex flex-col items-center justify-end gap-3 pb-[9vh] focus:outline-none"
        >
          <span className="animate-pulse-ring rounded-full border-4 border-ember bg-night/40 px-12 py-5 font-impact text-3xl uppercase tracking-widest text-ember">
            Draw!
          </span>
          <span className="text-stroke font-impact text-sm uppercase tracking-widest text-bone/90">
            Rip your hand off your hip - or tap / press SPACE
          </span>
        </button>
      )}

      {/* Result. */}
      {duel.phase === 'result' && duel.result && (
        <ResultScreen
          result={duel.result}
          selfId={duel.selfId}
          players={duel.players}
          lobbyId={lobbyId}
          onRematch={onRematch}
          winnerPhoto={photos.winner}
          loserPhoto={photos.loser}
          clip={clip}
        />
      )}
    </main>
  );
}

function FrameRing({
  side,
  ready,
  live,
  vertical,
}: {
  side: 'left' | 'right';
  ready: boolean;
  live?: boolean;
  vertical?: boolean;
}) {
  // 'left' is always the local player: left half in landscape, top in portrait.
  const pos = vertical
    ? side === 'left'
      ? 'left-0 top-0 h-1/2 w-full'
      : 'bottom-0 left-0 h-1/2 w-full'
    : side === 'left'
      ? 'left-0 top-0 h-full w-1/2'
      : 'right-0 top-0 h-full w-1/2';
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-10 border-4 transition-colors duration-300',
        pos,
        ready
          ? 'border-green-500 shadow-[inset_0_0_60px_rgba(34,197,94,0.35)]'
          : live
            ? 'animate-pulse border-gold'
            : 'border-transparent',
      )}
    />
  );
}

function HandOverlay({
  video,
  markerRef,
  drewRef,
  vertical,
}: {
  video: HTMLVideoElement | null;
  markerRef: MutableRefObject<HandMarker[]>;
  drewRef: MutableRefObject<boolean>;
  vertical?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let stopped = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (stopped) return;
      raf = requestAnimationFrame(render);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (!video || !video.videoWidth) return;

      // Match the video's object-cover + horizontal mirror.
      const s = Math.max(W / video.videoWidth, H / video.videoHeight);
      const offX = (W - video.videoWidth * s) / 2;
      const offY = (H - video.videoHeight * s) / 2;
      const drew = drewRef.current;
      for (const marker of markerRef.current) {
        const px = W - (marker.x * video.videoWidth * s + offX); // mirrored
        const py = marker.y * video.videoHeight * s + offY;
        const radius = W * 0.055; // fixed size, one circle per hand
        const color = drew
          ? '#facc15'
          : marker.holstered
            ? '#22c55e'
            : '#e8843c';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = color + '22';
        ctx.fill();
        ctx.lineWidth = Math.max(3, W * 0.008);
        ctx.strokeStyle = color;
        ctx.stroke();

        // hold-steady-to-ready charge ring
        if (marker.charge > 0) {
          const start = -Math.PI / 2;
          ctx.beginPath();
          ctx.arc(
            px,
            py,
            radius + Math.max(4, W * 0.013),
            start,
            start + marker.charge * Math.PI * 2,
          );
          ctx.strokeStyle = marker.charge >= 1 ? '#22c55e' : '#facc15';
          ctx.lineWidth = Math.max(3, W * 0.015);
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
      }
    };
    raf = requestAnimationFrame(render);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [video, markerRef, drewRef]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pointer-events-none absolute left-0 top-0 z-20',
        vertical ? 'h-1/2 w-full' : 'h-full w-1/2',
      )}
    />
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-night/85 px-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function HomeLink() {
  return (
    <Link
      href="/"
      className="mt-6 inline-block text-xs uppercase tracking-widest text-sand/50 hover:text-sand"
    >
      ← Back to town
    </Link>
  );
}

function LobbyOverlay({
  lobbyId,
  selfName,
  meReady,
  oppName,
  oppReady,
  bothPresent,
  holstered,
  pistol,
  onManualReady,
  bestOf,
  myWins,
  oppWins,
}: {
  lobbyId: string;
  selfName: string;
  meReady: boolean;
  oppName: string | null;
  oppReady: boolean;
  bothPresent: boolean;
  holstered: boolean;
  pistol: boolean;
  onManualReady: () => void;
  bestOf: number;
  myWins: number;
  oppWins: number;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // Tag the link with the sharer's name so the preview reads
      // "<name> challenges you to a duel" when it lands in a chat. Keep existing
      // params (e.g. ?bo=3) so the match mode survives if the invitee's socket
      // happens to create the lobby first.
      const url = new URL(window.location.href);
      if (selfName && selfName !== 'Stranger') url.searchParams.set('by', selfName);
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - the code is shown anyway */
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-6">
      {/* Top: code + share */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-sm border-2 border-dust bg-night/70 px-4 py-2 backdrop-blur-sm">
        <span className="font-impact text-xs uppercase tracking-widest text-sand/60">
          Lobby
        </span>
        <span className="font-impact text-xl tracking-widest text-bone">
          {lobbyId}
        </span>
        {bestOf > 1 && (
          <span className="rounded-sm border border-gold/60 px-2 py-1 font-impact text-xs uppercase tracking-widest text-gold">
            Best of {bestOf} · {myWins}–{oppWins}
          </span>
        )}
        <button
          onClick={copy}
          className="ml-1 rounded-sm border border-dust px-2 py-1 text-xs uppercase tracking-widest text-sand/70 hover:border-ember hover:text-ember"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Bottom: readiness + action */}
      <div className="pointer-events-auto w-full max-w-md rounded-sm border-2 border-dust bg-night/75 p-5 text-center backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-center gap-4">
          <PlayerChip label="You" ready={meReady} present />
          <span className="font-display text-2xl text-ember">vs</span>
          <PlayerChip
            label={oppName ?? 'Waiting…'}
            ready={oppReady}
            present={bothPresent}
          />
        </div>

        {!bothPresent ? (
          <p className="text-sm text-sand/70">
            Share the code{' '}
            <span className="font-impact text-bone">{lobbyId}</span> with a
            friend to begin.
          </p>
        ) : meReady ? (
          <p className="font-impact uppercase tracking-widest text-gold">
            {oppReady ? 'Both armed - draw incoming…' : 'Waiting on your rival…'}
          </p>
        ) : (
          <>
            <p
              className={cn(
                'font-impact uppercase tracking-widest transition-colors',
                holstered ? 'text-green-400' : 'text-sand/70',
              )}
            >
              {holstered
                ? `Locked in - ready${pistol ? ' 🔫' : ''}`
                : '🤠 Hold a hand steady on your hip'}
            </p>
            <p className="mt-1 text-xs text-sand/50">
              Keep it still - the ring fills as you hold.
            </p>
            <button
              onClick={onManualReady}
              className="mt-3 text-xs uppercase tracking-widest text-sand/50 underline hover:text-sand"
            >
              camera can’t see you? ready manually
            </button>
          </>
        )}

        <p className="mt-4 border-t border-dust/50 pt-3 text-xs leading-relaxed text-sand/60">
          At the <span className="font-impact text-ember">DRAW</span> flash,{' '}
          <span className="text-bone">rip your hand off your hip</span> to fire -
          or tap anywhere / press{' '}
          <span className="font-impact text-bone">SPACE</span>.
        </p>
      </div>
    </div>
  );
}

function PlayerChip({
  label,
  ready,
  present,
}: {
  label: string;
  ready: boolean;
  present: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-28 rounded-sm border-2 px-4 py-2',
        ready ? 'border-green-500 bg-green-500/10' : 'border-dust bg-charcoal/50',
        present ? '' : 'opacity-50',
      )}
    >
      <p className="truncate font-impact uppercase tracking-wider text-bone">
        {label}
      </p>
      <p className="text-xs uppercase tracking-widest text-sand/60">
        {ready ? 'Armed' : present ? 'Not ready' : 'Empty'}
      </p>
    </div>
  );
}
