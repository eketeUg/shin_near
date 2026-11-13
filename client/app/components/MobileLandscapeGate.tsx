'use client';

import { useEffect, useState, type MouseEvent } from 'react';

interface MobileLandscapeGateProps {
  forceLandscapeCss?: boolean;
  onForceLandscapeCss?: () => void;
}

export default function MobileLandscapeGate({
  forceLandscapeCss = false,
  onForceLandscapeCss,
}: MobileLandscapeGateProps) {
  const [exitedFullscreen, setExitedFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const isTouchDevice =
      window.matchMedia?.('(pointer: coarse)').matches ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    const supportsFullscreen = Boolean(
      document.fullscreenEnabled ||
        (document as any).webkitFullscreenEnabled ||
        (document.documentElement as any).requestFullscreen,
    );

    if (!isTouchDevice || isStandalone || !supportsFullscreen) return;

    const checkFullscreen = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isLandscape = window.innerWidth > window.innerHeight || forceLandscapeCss;
      // If user is in landscape on a fullscreen-capable mobile browser and is not in fullscreen,
      // prompt them back into fullscreen.
      setExitedFullscreen(isLandscape && !fsEl);
    };

    checkFullscreen();
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    window.addEventListener('resize', checkFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      window.removeEventListener('resize', checkFullscreen);
    };
  }, [forceLandscapeCss]);

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
        void tryLockNative();
        document.addEventListener(
          'fullscreenchange',
          () => {
            void tryLockNative();
          },
          { once: true },
        );
        void fsPromise
          .then(() => {
            setExitedFullscreen(false);
            return tryLockNative();
          })
          .catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        setExitedFullscreen(false);
        void tryLockNative();
      }
    } catch {
      // Ignore browser blocks (e.g. iOS Safari)
    }

    setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerHeight > window.innerWidth && !forceLandscapeCss) {
        onForceLandscapeCss?.();
      }
    }, 350);
  };

  // Portrait mobile: always show via SSR CSS (.mobile-landscape-gate) unless CSS-rotated.
  // Landscape mobile (fullscreen-capable): also show when user exits fullscreen.
  const showOverlay = !forceLandscapeCss || exitedFullscreen;
  if (!showOverlay) {
    return null;
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`${
        exitedFullscreen ? 'flex' : 'mobile-landscape-gate'
      } fixed inset-0 z-[9999] bg-[#0a0807]/95 backdrop-blur-sm flex-col items-center justify-center px-8 py-6 text-center select-none`}
    >
      <style>{`
        @keyframes shinRotatePhone {
          0%, 15% { transform: rotate(0deg); }
          45%, 80% { transform: rotate(-90deg); }
          95%, 100% { transform: rotate(0deg); }
        }
      `}</style>

      {/* Animated Portrait -> Landscape Phone Icon */}
      <div className="mb-5 flex items-center justify-center w-20 h-20">
        <div
          className="w-10 h-16 rounded-xl border-2 border-shin-gold/90 bg-black/60 flex flex-col items-center justify-between py-2 shadow-[0_0_25px_rgba(251,191,36,0.25)] will-change-transform"
          style={{ animation: 'shinRotatePhone 2.4s ease-in-out infinite' }}
        >
          <div className="w-3.5 h-0.5 rounded-full bg-shin-gold/70" />
          <div className="w-1.5 h-1.5 rounded-full bg-shin-gold/40" />
        </div>
      </div>

      <h1 className="text-xl font-cinzel font-black text-shin-gold uppercase tracking-[0.14em] leading-snug mb-3">
        {exitedFullscreen ? (
          'Fullscreen Paused'
        ) : (
          <>
            Rotate to Enter
            <br />
            The Arena
          </>
        )}
      </h1>

      <p className="max-w-xs text-xs sm:text-sm text-gray-300 font-sans leading-relaxed mb-6">
        {exitedFullscreen
          ? 'Return to fullscreen for the best widescreen combat view.'
          : 'SHIN is built for widescreen combat.'}
      </p>

      <button
        type="button"
        onClick={handleGoFullscreen}
        className="px-7 py-3 rounded-xl bg-shin-gold hover:bg-amber-300 active:scale-95 text-black font-cinzel font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(251,191,36,0.3)] transition-all cursor-pointer"
      >
        {exitedFullscreen ? 'Return to Fullscreen' : 'Enter Fullscreen'}
      </button>
    </div>
  );
}
