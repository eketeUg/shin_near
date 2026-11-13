'use client';

import type { MouseEvent } from 'react';

interface MobileLandscapeGateProps {
  forceLandscapeCss?: boolean;
  onForceLandscapeCss?: () => void;
}

export default function MobileLandscapeGate({
  forceLandscapeCss = false,
  onForceLandscapeCss,
}: MobileLandscapeGateProps) {
  if (forceLandscapeCss) {
    return null;
  }

  const handleGoFullscreen = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const tryLockNative = () => {
      try {
        const orientation = (screen as any)?.orientation;
        if (orientation && typeof orientation.lock === 'function') {
          return orientation.lock('landscape').catch(() => false);
        }
      } catch {
        // Ignore
      }
      return Promise.resolve(false);
    };

    try {
      if (el.requestFullscreen) {
        const fsPromise = el.requestFullscreen({ navigationUI: 'hide' }).catch(() =>
          el.requestFullscreen(),
        );
        // Fire orientation.lock synchronously in the tap gesture AND after fullscreen settles
        void tryLockNative();
        document.addEventListener(
          'fullscreenchange',
          () => {
            void tryLockNative();
          },
          { once: true },
        );
        void fsPromise.then(() => tryLockNative()).catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        void tryLockNative();
      }
    } catch {
      // Ignore browser blocks (e.g. iOS Safari)
    }

    // If native rotation didn't happen within 350ms (e.g. iOS Safari or Android requiring 2nd tap
    // after fullscreen), immediately rotate via CSS shell so 1 tap always opens the game in landscape.
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerHeight > window.innerWidth) {
        onForceLandscapeCss?.();
      }
    }, 350);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mobile-landscape-gate fixed inset-0 z-[9999] bg-[#0a0807] flex-col items-center justify-center px-8 py-10 text-center select-none"
    >
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
        Rotate to Enter
        <br />
        The Arena
      </h1>

      <p className="max-w-xs text-sm text-gray-300 font-sans leading-relaxed mb-8">
        SHIN is built for widescreen combat—your left thumb guides your stance, while your right unleashes strikes and techniques.
      </p>

      <button
        type="button"
        onClick={handleGoFullscreen}
        className="px-7 py-3 rounded-xl bg-shin-gold hover:bg-amber-300 active:scale-95 text-black font-cinzel font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(251,191,36,0.3)] transition-all cursor-pointer"
      >
        Enter Fullscreen
      </button>
    </div>
  );
}
