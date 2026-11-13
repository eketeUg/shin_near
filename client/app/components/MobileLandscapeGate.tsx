'use client';

import { useState } from 'react';

interface MobileLandscapeGateProps {
  forceLandscapeCss?: boolean;
  onForceLandscapeCss?: () => void;
}

export default function MobileLandscapeGate({
  forceLandscapeCss = false,
  onForceLandscapeCss,
}: MobileLandscapeGateProps) {
  const [statusHint, setStatusHint] = useState<string | null>(null);

  if (forceLandscapeCss) {
    return null;
  }

  const tryLockLandscape = () => {
    const orientation = (screen as any)?.orientation;
    if (orientation && typeof orientation.lock === 'function') {
      return orientation.lock('landscape').catch(() => null);
    }
    return Promise.resolve(null);
  };

  const handleGoFullscreen = () => {
    setStatusHint('Switching to landscape fullscreen...');

    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const onFullscreenDone = () => {
      document.removeEventListener('fullscreenchange', onFullscreenDone);
      tryLockLandscape();
    };
    document.addEventListener('fullscreenchange', onFullscreenDone, { once: true });

    try {
      let fsPromise: Promise<void> | void = undefined;
      if (el.requestFullscreen) {
        fsPromise = el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        fsPromise = el.webkitRequestFullscreen();
      }

      // Call orientation.lock synchronously within the user gesture AND after fullscreen resolves
      tryLockLandscape();
      if (fsPromise && typeof (fsPromise as Promise<void>).then === 'function') {
        (fsPromise as Promise<void>)
          .then(() => tryLockLandscape())
          .catch(() => {});
      }
    } catch {
      // Ignore browser blocks (e.g. iOS Safari requires physical rotation)
    }

    // If the browser didn't rotate within 700ms (e.g. iOS Safari or OS rotation lock), tell the user clearly
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerHeight > window.innerWidth) {
        setStatusHint('Turn your phone sideways — or tap "Continue anyway" below.');
      }
    }, 700);
  };

  return (
    <div className="mobile-landscape-gate fixed inset-0 z-[9999] bg-[#0a0807] flex-col items-center justify-center px-8 py-10 text-center select-none">
      <style>{`
        @keyframes shinRotatePhone {
          0%, 15% { transform: rotate(0deg); }
          45%, 80% { transform: rotate(-90deg); }
          95%, 100% { transform: rotate(0deg); }
        }
      `}</style>

      {/* Animated Portrait -> Landscape Phone Icon */}
      <div className="mb-8 flex items-center justify-center w-24 h-24">
        <div
          className="w-12 h-20 rounded-xl border-2 border-shin-gold/90 bg-black/60 flex flex-col items-center justify-between py-2 shadow-[0_0_25px_rgba(251,191,36,0.25)] will-change-transform"
          style={{ animation: 'shinRotatePhone 2.4s ease-in-out infinite' }}
        >
          <div className="w-4 h-0.5 rounded-full bg-shin-gold/70" />
          <div className="w-1.5 h-1.5 rounded-full bg-shin-gold/40" />
        </div>
      </div>

      <h1 className="text-2xl font-cinzel font-black text-shin-gold uppercase tracking-[0.14em] leading-snug mb-4">
        Turn Your Phone
        <br />
        Sideways
      </h1>

      <p className="max-w-xs text-sm text-gray-300 font-sans leading-relaxed mb-8">
        SHIN plays in landscape: the joystick goes under your left thumb, the skills under your right.
      </p>

      <button
        onClick={handleGoFullscreen}
        className="px-7 py-3 rounded-xl bg-shin-gold hover:bg-amber-300 active:scale-95 text-black font-cinzel font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(251,191,36,0.3)] transition-all cursor-pointer"
      >
        Go full screen
      </button>

      {statusHint && (
        <p className="mt-4 text-xs font-mono text-amber-300/90 max-w-xs">
          {statusHint}
        </p>
      )}

      {onForceLandscapeCss && (
        <button
          onClick={onForceLandscapeCss}
          className="mt-4 text-[11px] font-mono text-gray-400 hover:text-gray-200 underline underline-offset-4 cursor-pointer"
        >
          Rotation locked? Continue anyway
        </button>
      )}
    </div>
  );
}
