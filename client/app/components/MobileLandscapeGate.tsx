'use client';

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

  const handleGoFullscreen = async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) {
        await el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen().catch(() => {});
      }
      const orientation = (screen as any)?.orientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore browser blocks (e.g. iOS Safari requires physical rotation)
    }
  };

  return (
    <div className="mobile-landscape-gate fixed inset-0 z-[9999] bg-[#0a0807] flex-col items-center justify-center px-8 py-10 text-center select-none">
      {/* Landscape Phone Icon */}
      <div className="mb-8 flex items-center justify-center">
        <div className="w-20 h-12 rounded-xl border-2 border-shin-gold/90 bg-black/60 flex items-center justify-end pr-2 shadow-[0_0_25px_rgba(251,191,36,0.2)]">
          <div className="w-0.5 h-3.5 rounded-full bg-shin-gold/80" />
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

      {onForceLandscapeCss && (
        <button
          onClick={onForceLandscapeCss}
          className="mt-5 text-[11px] font-mono text-gray-500 hover:text-gray-300 underline underline-offset-4 cursor-pointer"
        >
          Rotation locked? Continue anyway
        </button>
      )}
    </div>
  );
}
